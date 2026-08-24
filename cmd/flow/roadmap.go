package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/lex/flow/internal/core"
	"github.com/lex/flow/internal/markdown"
	"github.com/lex/flow/internal/workspace"
)

func runRoadmap(global bool, args []string, env commandEnv) error {
	flagSet := flag.NewFlagSet("roadmap", flag.ContinueOnError)
	flagSet.SetOutput(io.Discard)
	flagSet.Usage = func() {
		writeRoadmapHelp(env.stdout)
	}

	graphFilter := flagSet.String("graph", "", "limit to one feature slug (first path segment)")
	next := flagSet.Bool("next", false, "print the full execution packet for the next ready task")
	claim := flagSet.Bool("claim", false, "claim the next ready task (status Running + session stamp)")
	sessionFlag := flagSet.String("session", "", "session token for claims (default: derived from hostname)")
	staleHours := flagSet.Int("stale-hours", int(core.DefaultClaimStaleness.Hours()), "claims older than this surface as stale (default: 4)")
	asJSON := flagSet.Bool("json", false, "machine-readable output")

	helpShown, err := parseFlagSetWithHelp(flagSet, args, env, writeRoadmapHelp)
	if err != nil {
		return err
	}
	if helpShown {
		return nil
	}

	root, err := resolveRoot(global, env)
	if err != nil {
		return err
	}

	documents, err := workspace.LoadDocuments(root.FlowPath)
	if err != nil {
		return err
	}

	view, err := core.BuildRoadmapView(documents)
	if err != nil {
		return fmt.Errorf("build roadmap view: %w", err)
	}

	if strings.TrimSpace(*graphFilter) != "" {
		view = filterRoadmapView(view, *graphFilter)
	}

	switch {
	case *claim:
		return roadmapClaim(root, documents, view, *sessionFlag, time.Duration(*staleHours)*time.Hour, *asJSON, env)
	case *next:
		return roadmapNext(view, *asJSON, env)
	default:
		return roadmapSummary(view, *asJSON, env)
	}
}

func filterRoadmapView(view core.RoadmapView, slug string) core.RoadmapView {
	filtered := core.RoadmapView{}
	for _, feature := range view.Features {
		if feature.Slug == slug {
			filtered.Features = append(filtered.Features, feature)
			break
		}
	}
	for _, packet := range view.NextReady {
		if featureSlugOfGraph(packet.Graph) == slug {
			filtered.NextReady = append(filtered.NextReady, packet)
		}
	}
	return filtered
}

func featureSlugOfGraph(graphPath string) string {
	parts := strings.Split(graphPath, "/")
	if len(parts) >= 2 {
		return parts[1]
	}
	return parts[0]
}

func defaultSessionToken() string {
	host, err := os.Hostname()
	if err != nil || strings.TrimSpace(host) == "" {
		return fmt.Sprintf("session-%d", os.Getpid())
	}
	return "session@" + host
}

// staleRunningClaims returns task ids of Running tasks whose claim is older
// than the threshold (or has an unparsable timestamp).
func staleRunningClaims(documents []markdown.WorkspaceDocument, now time.Time, threshold time.Duration) []core.RoadmapPacket {
	stale := []core.RoadmapPacket{}
	for _, item := range documents {
		taskDocument, ok := item.Document.(markdown.TaskDocument)
		if !ok || taskDocument.Metadata.Status != "Running" || taskDocument.Metadata.SessionAt == "" {
			continue
		}
		isStale, err := core.ClaimIsStale(taskDocument.Metadata.SessionAt, now, threshold)
		if !isStale || err != nil {
			if err == nil && !isStale {
				continue
			}
			if err != nil {
				// Unparsable timestamps surface as stale for human resolution.
			} else {
				continue
			}
		}
		stale = append(stale, core.RoadmapPacket{
			TaskID:    taskDocument.Metadata.ID,
			Title:     taskDocument.Metadata.Title,
			Graph:     taskDocument.Metadata.Graph,
			Status:    taskDocument.Metadata.Status,
			Session:   taskDocument.Metadata.Session,
			SessionAt: taskDocument.Metadata.SessionAt,
		})
	}
	return stale
}

func roadmapClaim(root workspace.Root, documents []markdown.WorkspaceDocument, view core.RoadmapView, sessionToken string, staleness time.Duration, asJSON bool, env commandEnv) error {
	now := time.Now().UTC()
	token := strings.TrimSpace(sessionToken)
	if token == "" {
		token = defaultSessionToken()
	}

	candidate := core.SelectClaimCandidate(view)
	if candidate == nil {
		stale := staleRunningClaims(documents, now, staleness)
		return reportNoClaimCandidate(stale, asJSON, env)
	}

	sessionAt := now.Format(time.RFC3339)
	updated, err := workspace.UpdateDocumentByIDFromCorePatch(root, candidate.TaskID, core.UpdateDocumentPatch{
		Status:    stringPointer("Running"),
		Session:   stringPointer(token),
		SessionAt: stringPointer(sessionAt),
	})
	if err != nil {
		return fmt.Errorf("claim task %s: %w", candidate.TaskID, err)
	}
	candidate.Status = "Running"
	candidate.Session = token
	candidate.SessionAt = sessionAt
	candidate.Path = updated.Path

	fmt.Fprintf(env.stdout, "claimed %s\n", candidate.TaskID)
	return writePacket(candidate, asJSON, env)
}

func reportNoClaimCandidate(stale []core.RoadmapPacket, asJSON bool, env commandEnv) error {
	if asJSON {
		payload := struct {
			Claimed bool                 `json:"claimed"`
			Stale   []core.RoadmapPacket `json:"stale,omitempty"`
			Options []string             `json:"options,omitempty"`
		}{Claimed: false}
		if len(stale) > 0 {
			payload.Stale = stale
			payload.Options = []string{"resume", "revert", "handoff"}
		}
		return json.NewEncoder(env.stdout).Encode(payload)
	}

	if len(stale) == 0 {
		fmt.Fprintln(env.stdout, "no ready tasks; nothing to claim")
		return nil
	}
	fmt.Fprintln(env.stdout, "no unclaimed ready tasks. Stale claims detected:")
	for _, packet := range stale {
		fmt.Fprintf(env.stdout, "  %s %q claimed by %s at %s\n", packet.TaskID, packet.Title, packet.Session, packet.SessionAt)
	}
	fmt.Fprintln(env.stdout, "options:")
	fmt.Fprintln(env.stdout, "  flow node update --id <task-id> --status Running --session <token> --session-at <RFC3339>   # resume")
	fmt.Fprintln(env.stdout, "  flow node update --id <task-id> --status Ready --session \"\" --session-at \"\"                # revert")
	return nil
}

func roadmapNext(view core.RoadmapView, asJSON bool, env commandEnv) error {
	if len(view.NextReady) == 0 {
		if asJSON {
			return json.NewEncoder(env.stdout).Encode(struct {
				Next *core.RoadmapPacket `json:"next"`
			}{})
		}
		fmt.Fprintln(env.stdout, "no ready tasks")
		return nil
	}
	packet := &view.NextReady[0]
	if !asJSON {
		fmt.Fprintf(env.stdout, "next: %s\n", packet.TaskID)
	}
	return writePacket(packet, asJSON, env)
}

func writePacket(packet *core.RoadmapPacket, asJSON bool, env commandEnv) error {
	if asJSON {
		encoder := json.NewEncoder(env.stdout)
		encoder.SetIndent("", "  ")
		return encoder.Encode(packet)
	}

	fmt.Fprintf(env.stdout, "task:    %s\n", packet.TaskID)
	fmt.Fprintf(env.stdout, "title:   %s\n", packet.Title)
	fmt.Fprintf(env.stdout, "graph:   %s\n", packet.Graph)
	fmt.Fprintf(env.stdout, "layer:   %d\n", packet.Layer)
	fmt.Fprintf(env.stdout, "status:  %s\n", packet.Status)
	if packet.Session != "" {
		fmt.Fprintf(env.stdout, "session: %s (at %s)\n", packet.Session, packet.SessionAt)
	}
	for _, dependency := range packet.Dependencies {
		fmt.Fprintf(env.stdout, "depends-on: %s [%s]\n", dependency.ID, dependency.Status)
	}
	for _, gap := range packet.ReadinessGap {
		fmt.Fprintf(env.stdout, "context: %s\n", gap)
	}
	if packet.Body != "" {
		fmt.Fprintln(env.stdout, "---")
		fmt.Fprint(env.stdout, packet.Body)
		if !strings.HasSuffix(packet.Body, "\n") {
			fmt.Fprintln(env.stdout)
		}
		fmt.Fprintln(env.stdout, "---")
	}
	return nil
}

func roadmapSummary(view core.RoadmapView, asJSON bool, env commandEnv) error {
	if asJSON {
		encoder := json.NewEncoder(env.stdout)
		encoder.SetIndent("", "  ")
		return encoder.Encode(view)
	}

	totalTasks := 0
	for _, feature := range view.Features {
		totalTasks += feature.TotalTasks
	}
	fmt.Fprintf(env.stdout, "roadmap: %d features, %d tasks\n", len(view.Features), totalTasks)

	for _, feature := range view.Features {
		fmt.Fprintf(env.stdout, "  %-60s %-11s done %d/%d ready %d blocked %d\n",
			feature.Slug, feature.Status, feature.DoneTasks, feature.TotalTasks, feature.ReadyTasks, feature.BlockedTasks)
		for _, gap := range feature.ReadinessGaps {
			fmt.Fprintf(env.stdout, "    gap: %s\n", gap)
		}
	}

	if len(view.NextReady) == 0 {
		fmt.Fprintln(env.stdout, "next ready: none")
		return nil
	}
	fmt.Fprintln(env.stdout, "next ready:")
	for _, packet := range view.NextReady {
		suffix := ""
		if packet.Session != "" {
			suffix = fmt.Sprintf(" [claimed by %s]", packet.Session)
		}
		fmt.Fprintf(env.stdout, "  layer %d  %s  %s%s\n", packet.Layer, packet.TaskID, packet.Title, suffix)
	}
	return nil
}
