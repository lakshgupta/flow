type MermaidModule = {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, definition: string) => Promise<{
    svg: string;
    bindFunctions?: (element: Element) => void;
  }>;
};

const MERMAID_RIGHT_VIEWBOX_PADDING = 32;

let mermaidModulePromise: Promise<MermaidModule> | null = null;

function addPaddingToNumericLength(length: string, padding: number): string | null {
  const match = length.trim().match(/^(-?\d*\.?\d+)([a-z%]*)$/i);
  if (match === null) {
    return null;
  }

  const numericLength = Number(match[1]);
  if (Number.isNaN(numericLength)) {
    return null;
  }

  return `${numericLength + padding}${match[2]}`;
}

function addPaddingToMaxWidthStyle(style: string, padding: number): string {
  return style.replace(/max-width\s*:\s*(-?\d*\.?\d+)px/gi, (_match, value: string) => {
    const numericWidth = Number(value);
    if (Number.isNaN(numericWidth)) {
      return _match;
    }

    return `max-width: ${numericWidth + padding}px`;
  });
}

export function addRightPaddingToMermaidSVG(svg: string): string {
  const parser = new DOMParser();
  const document = parser.parseFromString(svg, "image/svg+xml");
  const svgElement = document.documentElement;

  if (svgElement.tagName.toLowerCase() !== "svg") {
    return svg;
  }

  const viewBox = svgElement.getAttribute("viewBox");
  if (viewBox === null) {
    return svg;
  }

  const values = viewBox
    .trim()
    .split(/\s+/)
    .map((value) => Number(value));

  if (values.length !== 4 || values.some((value) => Number.isNaN(value))) {
    return svg;
  }

  const [minX, minY, width, height] = values;
  const paddedWidth = width + MERMAID_RIGHT_VIEWBOX_PADDING;

  svgElement.setAttribute("viewBox", `${minX} ${minY} ${paddedWidth} ${height}`);

  const widthAttribute = svgElement.getAttribute("width");
  if (widthAttribute !== null) {
    const paddedWidth = addPaddingToNumericLength(widthAttribute, MERMAID_RIGHT_VIEWBOX_PADDING);
    if (paddedWidth !== null && !widthAttribute.trim().endsWith("%")) {
      svgElement.setAttribute("width", paddedWidth);
    }
  }

  const styleAttribute = svgElement.getAttribute("style");
  if (styleAttribute !== null) {
    svgElement.setAttribute("style", addPaddingToMaxWidthStyle(styleAttribute, MERMAID_RIGHT_VIEWBOX_PADDING));
  }

  return svgElement.outerHTML;
}

async function loadMermaidModule(): Promise<MermaidModule> {
  if (mermaidModulePromise === null) {
    mermaidModulePromise = import("mermaid").then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        suppressErrorRendering: true,
        theme: "neutral",
      });
      return mermaid as MermaidModule;
    });
  }

  return mermaidModulePromise;
}

export async function renderMermaidDiagramSource(source: string, id: string): Promise<{
  svg: string;
  bindFunctions?: (element: Element) => void;
}> {
  const mermaid = await loadMermaidModule();
  const rendered = await mermaid.render(id, source.trim());
  return {
    ...rendered,
    svg: addRightPaddingToMermaidSVG(rendered.svg),
  };
}