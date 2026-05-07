import { describe, expect, it } from "vitest";

import { addRightPaddingToMermaidSVG } from "./mermaid";

describe("addRightPaddingToMermaidSVG", () => {
  it("expands the SVG viewport and width to prevent right-edge clipping", () => {
    const svg = '<svg viewBox="0 0 100 80" width="100" height="80"><g><text x="96">Label</text></g></svg>';

    const padded = addRightPaddingToMermaidSVG(svg);

    expect(padded).toContain('viewBox="0 0 132 80"');
    expect(padded).toContain('width="132"');
    expect(padded).toContain('<text x="96">Label</text>');
  });

  it("pads Mermaid percent-width SVGs by updating the viewBox and max-width style", () => {
    const svg = '<svg viewBox="0 0 146.48959350585938 402.4895935058594" width="100%" style="max-width: 146.48959350585938px;"><g /></svg>';

    const padded = addRightPaddingToMermaidSVG(svg);

    expect(padded).toContain('viewBox="0 0 178.48959350585938 402.4895935058594"');
    expect(padded).toContain('width="100%"');
    expect(padded).toContain('style="max-width: 178.48959350585938px;"');
  });

  it("leaves SVGs without a viewBox unchanged", () => {
    const svg = '<svg width="100" height="80"><g /></svg>';

    expect(addRightPaddingToMermaidSVG(svg)).toBe(svg);
  });
});