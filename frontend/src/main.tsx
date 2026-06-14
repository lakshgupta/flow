// Polyfill window.crypto.subtle in non-secure contexts (e.g. desktop custom scheme wails://)
if (typeof window !== "undefined") {
  if (!window.crypto) {
    (window as any).crypto = {} as any;
  }
  if (!window.crypto.subtle) {
    const mockSubtle = {
      encrypt: () => Promise.resolve(new ArrayBuffer(0)),
      decrypt: () => Promise.resolve(new ArrayBuffer(0)),
      sign: () => Promise.resolve(new ArrayBuffer(0)),
      verify: () => Promise.resolve(new ArrayBuffer(0)),
      digest: () => Promise.resolve(new ArrayBuffer(0)),
      generateKey: () => Promise.resolve({}),
      deriveKey: () => Promise.resolve({}),
      deriveBits: () => Promise.resolve(new ArrayBuffer(0)),
      importKey: () => Promise.resolve({}),
      exportKey: () => Promise.resolve({}),
      wrapKey: () => Promise.resolve(new ArrayBuffer(0)),
      unwrapKey: () => Promise.resolve({}),
    };
    Object.defineProperty(window.crypto, "subtle", {
      value: mockSubtle,
      configurable: true,
      writable: true,
    });
  }
}

import React from "react";
import ReactDOM from "react-dom/client";
import "@xyflow/react/dist/style.css";


import { App } from "./App";
import { ThemeProvider } from "./lib/theme";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);