import { Component, lazy, Suspense, useEffect, useRef, useState } from "react";

import { joinClassNames } from "./ui/utils";
import {
  DEFAULT_EXCALIDRAW_HEIGHT,
  type ExcalidrawElement,
  createEmptyExcalidrawSource,
  parseExcalidrawSource,
  serializeExcalidrawScene,
  setExcalidrawSourceHeight,
} from "../lib/excalidraw";

const Excalidraw = lazy(async () => {
  const mod = await import("@excalidraw/excalidraw");
  return { default: mod.Excalidraw };
});

class ExcalidrawErrorBoundary extends Component<
  { children: React.ReactNode; onError?: (error: unknown) => void; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

type LazyExcalidrawProps = {
  source: string;
  onSourceChange?: (nextSource: string) => void;
  className?: string;
  readOnly?: boolean;
};

export function LazyExcalidraw({ source, onSourceChange, className, readOnly }: LazyExcalidrawProps) {
  const [elements, setElements] = useState<ExcalidrawElement[]>([]);
  const [appState, setAppState] = useState<Record<string, unknown>>({});
  const [files, setFiles] = useState<Record<string, unknown>>({});
  const [height, setHeight] = useState<number>(DEFAULT_EXCALIDRAW_HEIGHT);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const isExcalidrawSyncRef = useRef(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    parseExcalidrawSource(source)
      .then((parsed) => {
        if (cancelled) return;
        isExcalidrawSyncRef.current = false;
        setElements(parsed.elements);
        setAppState(parsed.appState);
        setFiles(parsed.files);
        setHeight(parsed.height);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [source]);

  const handleChange = (nextElements: ExcalidrawElement[], nextAppState: Record<string, unknown>, nextFiles: Record<string, unknown>) => {
    if (!isExcalidrawSyncRef.current) {
      isExcalidrawSyncRef.current = true;
      return;
    }
    if (!onSourceChange) return;
    const nextHeight = typeof nextAppState.height === "number" ? nextAppState.height : height;
    const nextSource = serializeExcalidrawScene(nextElements, nextHeight);
    onSourceChange(nextSource);
    setElements(nextElements);
    setAppState(nextAppState);
    setFiles(nextFiles);
    setHeight(nextHeight);
  };

  const rootClassName = joinClassNames("flow-excalidraw-diagram", className);

  if (error !== null) {
    return (
      <div className={joinClassNames(rootClassName, "flow-excalidraw-diagram-error")}>
        <p className="flow-excalidraw-diagram-message">Unable to load Excalidraw.</p>
        <p className="flow-excalidraw-diagram-detail">{error}</p>
      </div>
    );
  }

  return (
    <ExcalidrawErrorBoundary
      fallback={
        <div className={joinClassNames(rootClassName, "flow-excalidraw-diagram-error")}>
          <p className="flow-excalidraw-diagram-message">Excalidraw failed to render.</p>
        </div>
      }
      onError={(err) => setError(err instanceof Error ? err.message : String(err))}
    >
      <Suspense
        fallback={
          <div className={joinClassNames(rootClassName, "flow-excalidraw-diagram-loading")}>
            <p className="flow-excalidraw-diagram-message">Loading Excalidraw...</p>
          </div>
        }
      >
        <div
          className={joinClassNames(rootClassName, "flow-excalidraw-editor-shell")}
          data-flow-editor-interactive="true"
          style={{ height }}
        >
          {loading ? (
            <div className="flow-excalidraw-diagram-loading">
              <p className="flow-excalidraw-diagram-message">Parsing diagram...</p>
            </div>
          ) : (
            <Excalidraw
              initialData={{
                elements,
                appState: { ...appState, height },
                files,
              }}
              onChange={handleChange}
              viewModeEnabled={readOnly ?? false}
            />
          )}
        </div>
      </Suspense>
    </ExcalidrawErrorBoundary>
  );
}

export { createEmptyExcalidrawSource, setExcalidrawSourceHeight };
