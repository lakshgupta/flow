import { useEffect, useRef, useState } from "react";

import { renderMermaidDiagramSource } from "../lib/mermaid";
import { toErrorMessage } from "../lib/utils";

type MermaidDiagramProps = {
  source: string;
  className?: string;
};

type MermaidDiagramState = {
  svg: string;
  error: string;
  bindFunctions?: (element: Element) => void;
};

function joinClassNames(...values: Array<string | undefined>): string {
  return values.filter((value) => value && value.trim() !== "").join(" ");
}

export function MermaidDiagram({ source, className }: MermaidDiagramProps) {
  const svgRef = useRef<HTMLDivElement>(null);
  const renderIDRef = useRef(`flow-mermaid-${Math.random().toString(36).slice(2)}`);
  const [state, setState] = useState<MermaidDiagramState>({ svg: "", error: "" });

  useEffect(() => {
    const trimmedSource = source.trim();
    if (trimmedSource === "") {
      setState({ svg: "", error: "" });
      return;
    }

    let cancelled = false;
    setState({ svg: "", error: "" });

    void (async () => {
      try {
        const rendered = await renderMermaidDiagramSource(trimmedSource, renderIDRef.current);
        if (cancelled) {
          return;
        }

        setState({ svg: rendered.svg, error: "", bindFunctions: rendered.bindFunctions });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState({ svg: "", error: toErrorMessage(error) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [source]);

  useEffect(() => {
    if (state.svg === "" || state.bindFunctions === undefined || svgRef.current === null) {
      return;
    }

    state.bindFunctions(svgRef.current);
  }, [state.bindFunctions, state.svg]);

  const rootClassName = joinClassNames("flow-mermaid-diagram", className);

  if (state.error !== "") {
    return (
      <div className={joinClassNames(rootClassName, "flow-mermaid-diagram-error")}>
        <p className="flow-mermaid-diagram-message">Unable to render Mermaid diagram.</p>
        <p className="flow-mermaid-diagram-detail">{state.error}</p>
      </div>
    );
  }

  if (state.svg === "") {
    return (
      <div className={joinClassNames(rootClassName, "flow-mermaid-diagram-loading")}>
        <p className="flow-mermaid-diagram-message">Rendering diagram...</p>
      </div>
    );
  }

  return (
    <div className={rootClassName}>
      <div ref={svgRef} dangerouslySetInnerHTML={{ __html: state.svg }} />
    </div>
  );
}