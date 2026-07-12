import "@testing-library/jest-dom/vitest";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = ResizeObserverStub as typeof ResizeObserver;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const doc = document as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const HTMLElementProto = HTMLElement.prototype as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RangeProto = Range.prototype as any;

if (!("elementFromPoint" in document)) {
  doc.elementFromPoint = () => document.body;
}

if (!("getAnimations" in HTMLElement.prototype)) {
  HTMLElementProto.getAnimations = () => [];
}

const zeroRect = () => ({
  bottom: 0,
  height: 0,
  left: 0,
  right: 0,
  top: 0,
  width: 0,
  x: 0,
  y: 0,
  toJSON() {
    return this;
  },
});

if (!("getBoundingClientRect" in HTMLElement.prototype)) {
  HTMLElementProto.getBoundingClientRect = zeroRect;
}

if (!("scrollIntoView" in HTMLElement.prototype)) {
  HTMLElementProto.scrollIntoView = function() {};
}

if (!("getClientRects" in HTMLElement.prototype)) {
  HTMLElementProto.getClientRects = () => ({
    item: () => null,
    length: 0,
    [Symbol.iterator]: function* iterator() {},
  }) as DOMRectList;
}

if (!("getBoundingClientRect" in Range.prototype)) {
  RangeProto.getBoundingClientRect = zeroRect;
}

if (!("getClientRects" in Range.prototype)) {
  RangeProto.getClientRects = () => ({
    item: () => null,
    length: 0,
    [Symbol.iterator]: function* iterator() {},
  }) as DOMRectList;
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
