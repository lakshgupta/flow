import { useEffect, useRef, useState } from "react";

import { joinClassNames } from "./ui/utils";
import { renderMermaidDiagramSource } from "../lib/mermaid";

type MermaidState =
  | { status: "loading" }
  | { status: "ready"; svg: string }
  | { status: "error"; error: string };

type MermaidDiagramProps = {
  source: string;
  className?: string;
};

export function MermaidDiagram({ source, className }: MermaidDiagramProps) {
  const [state, setState] = useState<MermaidState>({ status: "loading" });
  const renderIDRef = useRef(`flow-mermaid-${Math.random().toString(36).slice(2)}`);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setState({ status: "loading" });
    renderMermaidDiagramSource(source, renderIDRef.current)
      .then(({ svg }) => {
        if (!mountedRef.current) return;
        setState({ status: "ready", svg });
      })
      .catch((error: unknown) => {
        if (!mountedRef.current) return;
        setState({ status: "error", error: error instanceof Error ? error.message : String(error) });
      });
    return () => {
      mountedRef.current = false;
    };
  }, [source]);

  const rootClassName = joinClassNames("flow-mermaid-diagram", className);

  if (state.status === "error") {
    return (
      <div className={joinClassNames(rootClassName, "flow-mermaid-diagram-error")}>
        <p className="flow-mermaid-diagram-message">Unable to render Mermaid diagram.</p>
        <p className="flow-mermaid-diagram-detail">{state.error}</p>
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div className={joinClassNames(rootClassName, "flow-mermaid-diagram-loading")}>
        <p className="flow-mermaid-diagram-message">Rendering diagram...</p>
      </div>
    );
  }

  return (
    <div
      className={joinClassNames(rootClassName, "flow-mermaid-diagram-ready")}
      dangerouslySetInnerHTML={{ __html: state.svg }}
    />
  );
}
