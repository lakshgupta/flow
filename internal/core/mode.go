package core

import (
	"fmt"
	"strings"
)

// SurfaceMode identifies which user-facing surface should run.
type SurfaceMode string

const (
	ModeCLI     SurfaceMode = "cli"
	ModeServer  SurfaceMode = "server"
	ModeDesktop SurfaceMode = "desktop"
)

const supportedModesLabel = "cli, server, desktop"

type ModeRequest struct {
	// Mode is the selected runtime surface.
	Mode SurfaceMode
	// Args are remaining arguments after mode flag normalization.
	Args []string
	// Global indicates whether global workspace resolution is requested.
	Global bool
}

// ParseModeRequest normalizes surface mode selection from CLI arguments.
//
// Supported forms:
//   - --mode=<value>
//   - --mode <value>
//
// For non-CLI surfaces, only the optional -g flag is accepted.
func ParseModeRequest(rawArgs []string) (ModeRequest, error) {
	mode := ModeCLI
	remaining := make([]string, 0, len(rawArgs))
	for index := 0; index < len(rawArgs); index++ {
		arg := rawArgs[index]
		switch {
		case strings.HasPrefix(arg, "--mode="):
			parsedMode, err := parseModeValue(strings.TrimPrefix(arg, "--mode="))
			if err != nil {
				return ModeRequest{}, err
			}
			mode = parsedMode
		case arg == "--mode":
			parsedMode, consumed, err := parseModeFromSeparateArg(rawArgs, index)
			if err != nil {
				return ModeRequest{}, err
			}
			mode = parsedMode
			index += consumed
		default:
			remaining = append(remaining, arg)
		}
	}

	request := ModeRequest{Mode: mode, Args: remaining}
	if mode == ModeCLI {
		return request, nil
	}

	nonGlobalArgs := make([]string, 0, len(remaining))
	for _, arg := range remaining {
		if arg == "-g" {
			request.Global = true
			continue
		}
		nonGlobalArgs = append(nonGlobalArgs, arg)
	}

	if len(nonGlobalArgs) > 0 {
		return ModeRequest{}, fmt.Errorf("flow --mode %s does not accept extra arguments: %s", mode, strings.Join(nonGlobalArgs, " "))
	}

	request.Args = nonGlobalArgs
	return request, nil
}

func parseModeFromSeparateArg(rawArgs []string, modeFlagIndex int) (SurfaceMode, int, error) {
	valueIndex := modeFlagIndex + 1
	if valueIndex >= len(rawArgs) {
		return "", 0, fmt.Errorf("--mode requires one of: %s", supportedModesLabel)
	}

	parsedMode, err := parseModeValue(rawArgs[valueIndex])
	if err != nil {
		return "", 0, err
	}

	// One additional argument was consumed for the mode value.
	return parsedMode, 1, nil
}

func parseModeValue(value string) (SurfaceMode, error) {
	switch SurfaceMode(strings.ToLower(strings.TrimSpace(value))) {
	case ModeCLI:
		return ModeCLI, nil
	case ModeServer:
		return ModeServer, nil
	case ModeDesktop:
		return ModeDesktop, nil
	default:
		return "", fmt.Errorf("unknown --mode %q (expected: %s)", value, supportedModesLabel)
	}
}
