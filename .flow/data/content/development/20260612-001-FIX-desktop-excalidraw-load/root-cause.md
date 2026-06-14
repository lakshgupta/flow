---
id: development/20260612-001-FIX-desktop-excalidraw-load/root-cause
type: note
graph: development/20260612-001-FIX-desktop-excalidraw-load
title: Excalidraw Loading Root Cause
description: Why Excalidraw crashes the desktop app editor
tags:
    - note
links:
    - node: development/20260612-001-FIX-desktop-excalidraw-load/fix-excalidraw-load
      context: Notes root cause and fix implementation details
      relationships:
        - evolves-to
---
In the desktop application (Linux/Wails), the application runs under custom protocols like `wails://` which are not recognized as secure contexts. As a result, `window.isSecureContext` evaluates to `false`, and `window.crypto.subtle` is `undefined`.

When `@excalidraw/excalidraw` is imported/rendered, it attempts to access `window.crypto.subtle` during module initialization or setup. This throws a `TypeError` which bubbles up through the React `lazy` / `Suspense` boundary. Since there is no Error Boundary enclosing `<LazyExcalidraw>`, the crash bubbles to the root editor component, making the entire editor go blank (and removing existing elements like Mermaid).

### Resolution Plan

1. **Polyfill `window.crypto.subtle`**: In the early entry point (`frontend/src/main.tsx`), if `window.crypto.subtle` is undefined, polyfill it with a dummy implementation of the Web Crypto API methods (encrypt, decrypt, digest, etc.) returning resolved promises. Since Flow is a local-first markdown app, it does not use Excalidraw's E2EE collaboration/sharing backend, making stubs safe.
2. **Implement React `ErrorBoundary`**: Wrap `ExcalidrawInner` in `ErrorBoundary` inside `LazyExcalidraw.tsx` so that any dynamic chunk load failure or rendering exception is caught locally and does not crash the outer rich-text editor context.
