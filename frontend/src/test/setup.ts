import "@testing-library/jest-dom/vitest";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = ResizeObserverStub as typeof ResizeObserver;
}

if (!("matchMedia" in window)) {
  window.matchMedia = () => ({
    matches: false,
    media: "",
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false;
    },
  });
}

if (!("elementFromPoint" in document)) {
  document.elementFromPoint = () => document.body;
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
  HTMLElement.prototype.getBoundingClientRect = zeroRect;
}

if (!("getClientRects" in HTMLElement.prototype)) {
  HTMLElement.prototype.getClientRects = () => ({
    item: () => null,
    length: 0,
    [Symbol.iterator]: function* iterator() {},
  }) as DOMRectList;
}

if (!("getBoundingClientRect" in Range.prototype)) {
  Range.prototype.getBoundingClientRect = zeroRect;
}

if (!("getClientRects" in Range.prototype)) {
  Range.prototype.getClientRects = () => ({
    item: () => null,
    length: 0,
    [Symbol.iterator]: function* iterator() {},
  }) as DOMRectList;
}
