/**
 * Adds right padding to a rendered Mermaid SVG by inflating its viewBox and
 * inner width declarations. Mermaid's renderer emits a tight viewBox that
 * clips labels and arrow heads, so we pad it to avoid visual cropping in the
 * editor.
 */
export function addRightPaddingToMermaidSVG(svg: string, padding = 24): string {
  if (!svg) return svg;
  const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
  if (!viewBoxMatch) return svg;
  const [, vb] = viewBoxMatch;
  const [minX, minY, width, height] = vb.split(/\s+/).map(Number);
  if (!Number.isFinite(width)) return svg;
  const padded = `${minX} ${minY} ${width + padding} ${height}`;
  const withViewBox = svg.replace(viewBoxMatch[0], `viewBox="${padded}"`);
  const withWidth = withViewBox.replace(
    /<svg([^>]*)\swidth="([^"]+)"/,
    (_match, attrs, w) => {
      const numericWidth = Number(w);
      if (!Number.isFinite(numericWidth)) return `<svg${attrs} width="${w}"`;
      return `<svg${attrs} width="${numericWidth + padding}"`;
    },
  );
  return withWidth.replace(
    /<svg([^>]*)\sstyle="([^"]*)"/,
    (_match, attrs, style) => {
      const updated = style.replace(
        /max-width:\s*([0-9.]+)px/g,
        (_s: string, px: string) => `max-width: ${Number(px) + padding}px`,
      );
      return `<svg${attrs} style="${updated}"`;
    },
  );
}
