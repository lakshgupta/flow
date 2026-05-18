# Build Guide

This document describes how to build Flow from source and how to produce installable desktop packages.

## Build Targets

Flow supports three target families in this repository:

- CLI + web service binary (`flow`)
- Desktop-capable binary (`flow` with Wails build tags)
- Installable desktop packages:
  - Linux `.deb`
  - macOS `.dmg` (`amd64` and `arm64`)

## Prerequisites

Required for all builds:

- Go (version from `go.mod`)
- Node.js 22+
- npm

Linux desktop/release builds additionally require:

- `libwebkit2gtk-4.1-dev`
- `build-essential`

Install on Ubuntu:

```bash
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-dev build-essential
```

macOS desktop/release builds:

- no extra WebKit install is required (`WebKit.framework` is part of macOS)

## 1) Build The App From Source

### Build frontend assets

```bash
cd frontend
npm ci
npm run build
cd ..
```

This writes generated files to `internal/httpapi/static/`.

### Build a local CLI + web binary

```bash
go build ./cmd/flow
```

Run it:

```bash
./flow version
./flow service
```

## 2) Build Release Binaries

The release binary builder compiles a desktop-capable `flow` binary and stages release archives under `dist/`.

Linux amd64:

```bash
bash ./scripts/build-release.sh linux amd64
```

macOS amd64 and arm64 (run on macOS):

```bash
FLOW_SKIP_FRONTEND_BUILD=1 bash ./scripts/build-release.sh darwin amd64
FLOW_SKIP_FRONTEND_BUILD=1 bash ./scripts/build-release.sh darwin arm64
```

Notes:

- `FLOW_SKIP_FRONTEND_BUILD=1` skips `npm ci && npm run build` when assets were already built.
- The script uses `internal/buildinfo/VERSION` by default, or `FLOW_VERSION` if set.

## 3) Build Installable Packages

### Linux: build `.deb`

The Linux package script expects the release binary to already exist at `dist/linux-<arch>/flow`.

```bash
# 1) Build release binary
bash ./scripts/build-release.sh linux amd64

# 2) Build .deb package
bash ./scripts/build-package-linux.sh amd64
```

Output:

- `dist/flow_<version>_amd64.deb`

Linux package metadata and launcher:

- manifest: `packaging/linux/nfpm.yaml`
- desktop entry: `packaging/linux/flow.desktop`
- icon source: `frontend/src/assets/flow_logo_linux.png`

Install/uninstall example on Ubuntu:

```bash
sudo apt install ./dist/flow_<version>_amd64.deb
sudo apt remove flow
```

### macOS: build `.dmg`

The macOS packaging script expects the release binary to already exist at `dist/darwin-<arch>/flow` and must run on macOS.

```bash
# 1) Build release binary
FLOW_SKIP_FRONTEND_BUILD=1 bash ./scripts/build-release.sh darwin amd64
FLOW_SKIP_FRONTEND_BUILD=1 bash ./scripts/build-release.sh darwin arm64

# 2) Build .dmg packages
bash ./scripts/build-package-macos.sh amd64
bash ./scripts/build-package-macos.sh arm64
```

Outputs:

- `dist/flow_<version>_darwin_amd64.dmg`
- `dist/flow_<version>_darwin_arm64.dmg`

macOS package metadata and icon source:

- app bundle template: `packaging/macos/Info.plist`
- icon source: `frontend/src/assets/flow_logo_macos.png`

Install/uninstall behavior on macOS:

- Open `.dmg`, drag `Flow.app` to Applications
- Uninstall by moving `Flow.app` to Trash

## 4) Run Desktop Mode

Once the binary is built and installed:

```bash
flow desktop
```

Stop desktop app from CLI:

```bash
flow desktop stop
```

Use the web service mode instead:

```bash
flow service
flow service stop
```

## CI Release Packaging

The release workflow (`.github/workflows/release.yml`) publishes:

- `.tar.gz` + `.sha256` archives for Linux/macOS
- Linux `.deb`
- macOS `.dmg` (`amd64` and `arm64`)
- shared `install.sh`
