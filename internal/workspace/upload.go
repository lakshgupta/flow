package workspace

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

// ResolveAssetDir returns the absolute directory and the relative-to-flow
// directory for storing an uploaded asset. When documentPath is non-empty the
// asset is placed alongside the referenced document; otherwise it lands in
// data/uploads/. An error is returned when documentPath fails validation.
func ResolveAssetDir(flowPath string, documentPath string) (absDir string, relDir string, err error) {
	if documentPath != "" {
		cleaned := filepath.Clean(filepath.FromSlash(documentPath))
		if cleaned == "." || strings.HasPrefix(cleaned, "..") {
			return "", "", fmt.Errorf("documentPath is invalid")
		}
		absoluteDocPath := filepath.Join(flowPath, cleaned)
		relativeToFlow, relErr := filepath.Rel(flowPath, absoluteDocPath)
		if relErr != nil || strings.HasPrefix(relativeToFlow, "..") {
			return "", "", fmt.Errorf("documentPath is invalid")
		}
		return filepath.Dir(absoluteDocPath), filepath.ToSlash(filepath.Dir(cleaned)), nil
	}

	absDir = filepath.Join(flowPath, DataDirName, "uploads")
	relDir = filepath.ToSlash(filepath.Join(DataDirName, "uploads"))
	return absDir, relDir, nil
}

// BuildAssetURL returns the public API URL for an asset stored at the given
// relative-to-flow path.
func BuildAssetURL(relativePath string) string {
	return "/api/files?path=" + url.QueryEscape(filepath.ToSlash(relativePath))
}

// SanitizeAssetFileName normalises a file name to lowercase alphanumeric
// characters with dashes, keeping the extension lowercase.
func SanitizeAssetFileName(name string) string {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return "file.bin"
	}

	base := filepath.Base(trimmed)
	extension := strings.ToLower(filepath.Ext(base))
	stem := strings.TrimSuffix(base, filepath.Ext(base))
	stem = strings.ToLower(stem)
	builder := strings.Builder{}
	for _, r := range stem {
		switch {
		case (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9'):
			builder.WriteRune(r)
		case r == '-' || r == '_':
			builder.WriteRune(r)
		case r == ' ' || r == '.':
			builder.WriteRune('-')
		}
	}

	cleanStem := strings.Trim(builder.String(), "-_")
	if cleanStem == "" {
		cleanStem = "file"
	}

	if extension == "" {
		extension = ".bin"
	}
	return cleanStem + extension
}

// MakeUniqueFileName appends a numeric suffix (-2, -3, …) when a file with the
// candidate name already exists in uploadsDir.
func MakeUniqueFileName(uploadsDir string, candidate string) string {
	base := strings.TrimSuffix(candidate, filepath.Ext(candidate))
	ext := strings.ToLower(filepath.Ext(candidate))
	if base == "" {
		base = "file"
	}
	if ext == "" {
		ext = ".bin"
	}

	for index := 0; ; index++ {
		name := base + ext
		if index > 0 {
			name = fmt.Sprintf("%s-%d%s", base, index+1, ext)
		}

		absolutePath := filepath.Join(uploadsDir, name)
		if _, err := os.Stat(absolutePath); errors.Is(err, os.ErrNotExist) {
			return name
		}
	}
}

// ValidateFileName returns an error when the file name is empty or invalid
// (e.g. "." or ".." after cleaning).
func ValidateFileName(name string) error {
	cleaned := filepath.Base(strings.TrimSpace(name))
	if cleaned == "" || cleaned == "." {
		return fmt.Errorf("invalid file name")
	}
	return nil
}
