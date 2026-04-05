# server-dom-shim

[![NPM version](https://img.shields.io/npm/v/server-dom-shim?color=a1b858&label=)](https://www.npmjs.com/package/server-dom-shim)

A simple shim for the server-side DOM API. No more `HTMLElement is not defined` error during server-side rendering.

```ts
import {
  EventTarget,
  Element,
  HTMLElement,
  CustomElementRegistry,
  customElements,
  Event,
  CustomEvent,
  MediaList,
  StyleSheet,
  CSSRule,
  CSSRuleList,
  CSSStyleSheet,
} from 'server-dom-shim'
```

This package uses [Node.js conditional exports](https://nodejs.org/docs/latest-v20.x/api/packages.html#conditional-exports) to export different versions of the DOM API depending on the environment.

In Node.js environments, this package exports [`@lit-labs/ssr-dom-shim`](https://www.npmjs.com/package/@lit-labs/ssr-dom-shim) package. In browser environments, this package exports native DOM API.

## License

MIT
