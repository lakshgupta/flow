import {
  EventTarget as EventTargetShim,
  Element as ElementShim,
  HTMLElement as HTMLElementShim,
  CustomElementRegistry as CustomElementRegistryShim,
  customElements as customElementsShim,
  Event as EventShim,
  CustomEvent as CustomEventShim,
  MediaList as MediaListShim,
  StyleSheet as StyleSheetShim,
  CSSRule as CSSRuleShim,
  CSSRuleList as CSSRuleListShim,
  CSSStyleSheet as CSSStyleSheetShim,
} from '@lit-labs/ssr-dom-shim'

function getGlobal(name, shim) {
  return (
    (typeof globalThis !== 'undefined' && globalThis[name]) || (typeof window !== 'undefined' && window[name]) || shim
  )
}

const EventTarget_ = /* @__PURE__ */ getGlobal('EventTarget', EventTargetShim)
const Element_ = /* @__PURE__ */ getGlobal('Element', ElementShim)
const HTMLElement_ = /* @__PURE__ */ getGlobal('HTMLElement', HTMLElementShim)
const CustomElementRegistry_ = /* @__PURE__ */ getGlobal('CustomElementRegistry', CustomElementRegistryShim)
const customElements_ = /* @__PURE__ */ getGlobal('customElements', customElementsShim)
const Event_ = /* @__PURE__ */ getGlobal('Event', EventShim)
const CustomEvent_ = /* @__PURE__ */ getGlobal('CustomEvent', CustomEventShim)
const MediaList_ = /* @__PURE__ */ getGlobal('MediaList', MediaListShim)
const StyleSheet_ = /* @__PURE__ */ getGlobal('StyleSheet', StyleSheetShim)
const CSSRule_ = /* @__PURE__ */ getGlobal('CSSRule', CSSRuleShim)
const CSSRuleList_ = /* @__PURE__ */ getGlobal('CSSRuleList', CSSRuleListShim)
const CSSStyleSheet_ = /* @__PURE__ */ getGlobal('CSSStyleSheet', CSSStyleSheetShim)

export {
  EventTarget_ as EventTarget,
  Element_ as Element,
  HTMLElement_ as HTMLElement,
  CustomElementRegistry_ as CustomElementRegistry,
  customElements_ as customElements,
  Event_ as Event,
  CustomEvent_ as CustomEvent,
  MediaList_ as MediaList,
  StyleSheet_ as StyleSheet,
  CSSRule_ as CSSRule,
  CSSRuleList_ as CSSRuleList,
  CSSStyleSheet_ as CSSStyleSheet,
}
