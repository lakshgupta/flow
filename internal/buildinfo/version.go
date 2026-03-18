package buildinfo

import (
	_ "embed"
	"strings"
)

const devSuffix = "-dev"

//go:embed VERSION
var projectVersionFile string

func ProjectVersion() string {
	return strings.TrimSpace(projectVersionFile)
}

func DevVersion() string {
	projectVersion := ProjectVersion()
	if projectVersion == "" {
		return "dev"
	}

	return projectVersion + devSuffix
}
