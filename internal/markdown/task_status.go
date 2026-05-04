package markdown

import "strings"

var canonicalTaskStatuses = []string{"Ready", "Running", "Done", "Success", "Failed", "Interrupted"}

var normalizedTaskStatusByLowerValue = map[string]string{
	"ready":       "Ready",
	"running":     "Running",
	"done":        "Done",
	"success":     "Success",
	"failed":      "Failed",
	"interrupted": "Interrupted",
	"todo":        "Ready",
	"doing":       "Running",
}

// AllowedTaskStatuses returns the canonical task status values.
func AllowedTaskStatuses() []string {
	return append([]string(nil), canonicalTaskStatuses...)
}

// NormalizeTaskStatus maps known aliases and case variants to canonical task statuses.
// Unknown non-empty values are returned unchanged so validation can reject them.
func NormalizeTaskStatus(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}

	normalized, ok := normalizedTaskStatusByLowerValue[strings.ToLower(trimmed)]
	if ok {
		return normalized
	}

	return trimmed
}

// IsAllowedTaskStatus reports whether a value is empty or maps to an allowed task status.
func IsAllowedTaskStatus(value string) bool {
	if strings.TrimSpace(value) == "" {
		return true
	}

	normalized := NormalizeTaskStatus(value)
	_, ok := normalizedTaskStatusByLowerValue[strings.ToLower(normalized)]
	return ok
}