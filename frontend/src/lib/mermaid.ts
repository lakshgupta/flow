import { addRightPaddingToMermaidSVG } from "./mermaid-pad";

type MermaidModule = typeof import("mermaid").default;

let mermaidModulePromise: Promise<MermaidModule> | null = null;

function loadMermaidModule(): Promise<MermaidModule> {
  if (mermaidModulePromise === null) {
    mermaidModulePromise = import("mermaid").then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "neutral",
        fontFamily: "inherit",
      });
      return mermaid as MermaidModule;
    });
  }
  return mermaidModulePromise;
}

export type RenderedMermaidDiagram = {
  svg: string;
};

export async function renderMermaidDiagramSource(
  source: string,
  id: string,
): Promise<RenderedMermaidDiagram> {
  const mermaid = await loadMermaidModule();
  const rendered = await mermaid.render(id, source.trim());
  return { svg: addRightPaddingToMermaidSVG(rendered.svg) };
}
