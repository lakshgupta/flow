package httpapi

import (
	"embed"
	"io/fs"
)

//go:embed all:static
var embeddedAssets embed.FS

func staticFS() (fs.FS, error) {
	return fs.Sub(embeddedAssets, "static")
}
