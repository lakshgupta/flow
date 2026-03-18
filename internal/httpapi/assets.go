package httpapi

import (
	"embed"
	"io/fs"
)

//go:embed static static/*
var embeddedAssets embed.FS

func staticFS() (fs.FS, error) {
	return fs.Sub(embeddedAssets, "static")
}
