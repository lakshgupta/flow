package markdown

import (
	"fmt"
	"slices"
	"strings"
)

const referenceBreadcrumbSeparator = " > "

// RewriteInlineReferenceTargets replaces exact inline reference targets while preserving non-matching tokens.
func RewriteInlineReferenceTargets(body string, replacements map[string]string) string {
	if body == "" || len(replacements) == 0 {
		return body
	}

	return inlineReferencePattern.ReplaceAllStringFunc(NormalizeInlineReferenceTokens(body), func(token string) string {
		rawTarget := strings.TrimSpace(token[2 : len(token)-2])
		replacement, ok := replacements[rawTarget]
		if !ok || strings.TrimSpace(replacement) == "" || replacement == rawTarget {
			return token
		}

		return "[[" + replacement + "]]"
	})
}

// ReferenceTarget describes one graph-backed document that can be resolved from an inline reference token.
type ReferenceTarget struct {
	ID         string       `json:"id"`
	Type       DocumentType `json:"type"`
	Graph      string       `json:"graph"`
	Title      string       `json:"title"`
	Path       string       `json:"path"`
	Breadcrumb string       `json:"breadcrumb"`
}

// ResolvedInlineReference describes one inline token together with its resolved target.
type ResolvedInlineReference struct {
	Token  string
	Raw    string
	Target ReferenceTarget
}

// ReferenceBreadcrumb returns the canonical breadcrumb form for inline references.
func ReferenceBreadcrumb(graphPath string, title string) string {
	trimmedTitle := strings.TrimSpace(title)
	trimmedGraph := strings.TrimSpace(graphPath)
	if trimmedGraph == "" {
		return trimmedTitle
	}
	if trimmedTitle == "" {
		return trimmedGraph
	}
	return trimmedGraph + referenceBreadcrumbSeparator + trimmedTitle
}

// LookupReferenceTargets returns graph-backed documents that match an inline-reference authoring query.
func LookupReferenceTargets(documents []WorkspaceDocument, query string, sourceGraph string, limit int) ([]ReferenceTarget, error) {
	targets, err := collectReferenceTargets(documents)
	if err != nil {
		return nil, err
	}

	trimmedQuery := normalizeReferenceLookupKey(query)
	if trimmedQuery == "" {
		return nil, fmt.Errorf("reference lookup query must not be empty")
	}

	trimmedSourceGraph := strings.TrimSpace(sourceGraph)
	matches := make([]ReferenceTarget, 0, len(targets))
	for _, target := range targets {
		if referenceTargetMatchesQuery(target, trimmedQuery) {
			matches = append(matches, target)
		}
	}

	slices.SortFunc(matches, func(left, right ReferenceTarget) int {
		leftScore := referenceLookupScore(left, trimmedQuery, trimmedSourceGraph)
		rightScore := referenceLookupScore(right, trimmedQuery, trimmedSourceGraph)
		if leftScore != rightScore {
			return leftScore - rightScore
		}
		if left.Graph != right.Graph {
			return strings.Compare(left.Graph, right.Graph)
		}
		if left.Title != right.Title {
			return strings.Compare(left.Title, right.Title)
		}
		return strings.Compare(left.ID, right.ID)
	})

	if limit <= 0 || limit > len(matches) {
		limit = len(matches)
	}

	return matches[:limit], nil
}

// ResolveReferenceTarget resolves one inline reference target using exact id, exact breadcrumb,
// same-graph title, then globally unique title matching.
func ResolveReferenceTarget(documents []WorkspaceDocument, rawTarget string, sourceGraph string) (ReferenceTarget, bool, error) {
	targets, err := collectReferenceTargets(documents)
	if err != nil {
		return ReferenceTarget{}, false, err
	}

	lookupKey := normalizeReferenceLookupKey(rawTarget)
	if lookupKey == "" {
		return ReferenceTarget{}, false, nil
	}

	if match, ok := uniqueReferenceTarget(targets, func(target ReferenceTarget) bool {
		return normalizeReferenceLookupKey(target.ID) == lookupKey
	}); ok {
		return match, true, nil
	}

	if match, ok := uniqueReferenceTarget(targets, func(target ReferenceTarget) bool {
		return normalizeReferenceLookupKey(target.Breadcrumb) == lookupKey
	}); ok {
		return match, true, nil
	}

	trimmedSourceGraph := strings.TrimSpace(sourceGraph)
	if trimmedSourceGraph != "" {
		if match, ok := uniqueReferenceTarget(targets, func(target ReferenceTarget) bool {
			return target.Graph == trimmedSourceGraph && normalizeReferenceLookupKey(target.Title) == lookupKey
		}); ok {
			return match, true, nil
		}
	}

	if match, ok := uniqueReferenceTarget(targets, func(target ReferenceTarget) bool {
		return normalizeReferenceLookupKey(target.Title) == lookupKey
	}); ok {
		return match, true, nil
	}

	return ReferenceTarget{}, false, nil
}

// ResolveInlineReferences resolves all unique inline-reference tokens present in the source document body.
func ResolveInlineReferences(documents []WorkspaceDocument, source WorkspaceDocument) ([]ResolvedInlineReference, error) {
	normalizedSource, err := NormalizeWorkspaceDocument(source)
	if err != nil {
		return nil, err
	}

	body, sourceGraph := documentBodyAndGraph(normalizedSource.Document)
	if body == "" {
		return nil, nil
	}

	rawTargets := InlineReferenceIDs(body)
	if len(rawTargets) == 0 {
		return nil, nil
	}

	resolved := make([]ResolvedInlineReference, 0, len(rawTargets))
	for _, rawTarget := range rawTargets {
		target, ok, err := ResolveReferenceTarget(documents, rawTarget, sourceGraph)
		if err != nil {
			return nil, err
		}
		if !ok {
			continue
		}
		resolved = append(resolved, ResolvedInlineReference{
			Token:  "[[" + rawTarget + "]]",
			Raw:    rawTarget,
			Target: target,
		})
	}

	return resolved, nil
}

func collectReferenceTargets(documents []WorkspaceDocument) ([]ReferenceTarget, error) {
	normalizedDocuments := make([]WorkspaceDocument, 0, len(documents))
	for _, item := range documents {
		normalizedItem, err := NormalizeWorkspaceDocument(item)
		if err != nil {
			return nil, err
		}
		normalizedDocuments = append(normalizedDocuments, normalizedItem)
	}

	targets := make([]ReferenceTarget, 0, len(normalizedDocuments))
	for _, item := range normalizedDocuments {
		target, ok := referenceTargetFromDocument(item)
		if ok {
			targets = append(targets, target)
		}
	}

	return targets, nil
}

func referenceTargetFromDocument(item WorkspaceDocument) (ReferenceTarget, bool) {
	switch document := item.Document.(type) {
	case NoteDocument:
		return buildReferenceTarget(item.Path, document.Metadata.ID, document.Metadata.Type, document.Metadata.Graph, document.Metadata.Title), true
	case TaskDocument:
		return buildReferenceTarget(item.Path, document.Metadata.ID, document.Metadata.Type, document.Metadata.Graph, document.Metadata.Title), true
	case CommandDocument:
		return buildReferenceTarget(item.Path, document.Metadata.ID, document.Metadata.Type, document.Metadata.Graph, document.Metadata.Title), true
	default:
		return ReferenceTarget{}, false
	}
}

func buildReferenceTarget(path string, id string, documentType DocumentType, graphPath string, title string) ReferenceTarget {
	trimmedTitle := strings.TrimSpace(title)
	if trimmedTitle == "" {
		trimmedTitle = strings.TrimSpace(id)
	}
	trimmedGraph := strings.TrimSpace(graphPath)
	return ReferenceTarget{
		ID:         strings.TrimSpace(id),
		Type:       documentType,
		Graph:      trimmedGraph,
		Title:      trimmedTitle,
		Path:       path,
		Breadcrumb: ReferenceBreadcrumb(trimmedGraph, trimmedTitle),
	}
}

func uniqueReferenceTarget(targets []ReferenceTarget, predicate func(ReferenceTarget) bool) (ReferenceTarget, bool) {
	var match ReferenceTarget
	found := false
	for _, target := range targets {
		if !predicate(target) {
			continue
		}
		if found {
			return ReferenceTarget{}, false
		}
		match = target
		found = true
	}
	return match, found
}

func referenceTargetMatchesQuery(target ReferenceTarget, normalizedQuery string) bool {
	if normalizedQuery == "" {
		return false
	}

	return strings.Contains(normalizeReferenceLookupKey(target.Title), normalizedQuery) ||
		strings.Contains(normalizeReferenceLookupKey(target.Breadcrumb), normalizedQuery) ||
		strings.Contains(normalizeReferenceLookupKey(target.ID), normalizedQuery) ||
		strings.Contains(normalizeReferenceLookupKey(target.Graph), normalizedQuery) ||
		strings.Contains(normalizeReferenceLookupKey(target.Path), normalizedQuery)
}

func referenceLookupScore(target ReferenceTarget, normalizedQuery string, sourceGraph string) int {
	titleKey := normalizeReferenceLookupKey(target.Title)
	breadcrumbKey := normalizeReferenceLookupKey(target.Breadcrumb)
	idKey := normalizeReferenceLookupKey(target.ID)

	switch {
	case breadcrumbKey == normalizedQuery:
		return 0
	case target.Graph == sourceGraph && titleKey == normalizedQuery:
		return 1
	case titleKey == normalizedQuery:
		return 2
	case idKey == normalizedQuery:
		return 3
	case target.Graph == sourceGraph && strings.HasPrefix(titleKey, normalizedQuery):
		return 4
	case strings.HasPrefix(titleKey, normalizedQuery):
		return 5
	case strings.Contains(breadcrumbKey, normalizedQuery):
		return 6
	default:
		return 7
	}
}

func normalizeReferenceLookupKey(value string) string {
	return strings.ToLower(strings.Join(strings.Fields(strings.TrimSpace(value)), " "))
}

func documentBodyAndGraph(document Document) (string, string) {
	switch value := document.(type) {
	case HomeDocument:
		return value.Body, ""
	case NoteDocument:
		return value.Body, value.Metadata.Graph
	case TaskDocument:
		return value.Body, value.Metadata.Graph
	case CommandDocument:
		return value.Body, value.Metadata.Graph
	default:
		return "", ""
	}
}
