# Release

This document is for maintainers preparing a tagged Flow release.

## Supported Release Artifacts

The release workflow publishes these assets for each version:

- `flow-<version>-linux-amd64.tar.gz`
- `flow-<version>-linux-amd64.sha256`
- `flow-<version>-darwin-amd64.tar.gz`
- `flow-<version>-darwin-amd64.sha256`
- `flow-<version>-darwin-arm64.tar.gz`
- `flow-<version>-darwin-arm64.sha256`
- `install.sh`

`install.sh` auto-detects `linux/amd64`, `darwin/amd64`, and `darwin/arm64`.

## Release Order

1. Set the release version in `internal/buildinfo/VERSION`.
2. Build and validate the frontend and Go packages locally.
3. Build all release archives locally.
4. Review the worktree and keep only tracked release-source changes.
5. Commit the version change and any generated release updates.
6. Create and push the matching git tag.
7. Let GitHub Actions publish the release assets.
8. Verify the uploaded archives, checksums, and installer asset on the GitHub release page.

## What To Commit

Keep these changes if they changed as part of the release prep:

- `internal/buildinfo/VERSION`
- `.github/workflows/release.yml`
- `.github/release.yml`
- `docs/release.md`
- `README.md`
- `docs/reference.md`
- `scripts/`

Do not commit disposable local build output:

- `dist/`
- `internal/httpapi/static/` emitted bundles (`index.html`, `assets/**`)
- temporary install directories used to test `scripts/install-local-release.sh`

Before committing, inspect the boundary explicitly:

```bash
git status --short
git diff -- . ':(exclude)dist/**'
```

## Exact Commands

Update the version file:

```bash
printf '0.1.0\n' > internal/buildinfo/VERSION
version="$(tr -d '[:space:]' < internal/buildinfo/VERSION)"
```

Run local validation:

```bash
cd frontend
npm ci
npm run build

cd ..
go test ./internal/config ./internal/workspace ./internal/markdown ./internal/graph ./internal/execution ./internal/index ./internal/httpapi ./cmd/flow
```

Build release archives locally:

```bash
bash ./scripts/build-release.sh linux amd64
FLOW_SKIP_FRONTEND_BUILD=1 bash ./scripts/build-release.sh darwin amd64
FLOW_SKIP_FRONTEND_BUILD=1 bash ./scripts/build-release.sh darwin arm64
```

Optional local install from the archive built for the current machine:

```bash
bash ./scripts/install-local-release.sh
```

Create the release commit and tag:

```bash
git add internal/buildinfo/VERSION docs/release.md README.md docs/reference.md scripts/ .github/workflows/release.yml .github/release.yml
git commit -m "Prepare release ${version}"
git tag "v${version}"
git push origin HEAD
git push origin "v${version}"
```

If you need to publish the workflow manually instead of pushing a tag, run the `Release` workflow in GitHub Actions and pass either `${version}` or `v${version}` as `release_tag`.

## Expected GitHub Actions Behavior

The workflow at `.github/workflows/release.yml`:

- accepts either `${version}` or `v${version}` tags,
- verifies the tag matches `internal/buildinfo/VERSION`,
- builds Linux and macOS archives in order,
- uploads the per-target `.tar.gz` and `.sha256` files,
- uploads one shared `install.sh` asset.

## Installer Commands

From a downloaded release asset:

```bash
bash ./install.sh
bash ./install.sh 0.1.0
bash ./install.sh v0.1.0
```

From a repository checkout:

```bash
bash ./scripts/install.sh v0.1.0
```