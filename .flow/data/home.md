---
id: home
type: home
title: Home

## Backlog

- [x] Remove the text "Special Section" from mermaid and excalidraw sections
- [x] drawings on excalidraw should be saved in the same graph directory. Currently whatever I draw does not show up in the excalidraw canvas.
- [ ] changing the workspace should also update the home and graph content to the selected workspace
- [ ] two errors in the gui
```
index-B_gaQLZO.js:615 [Violation] Permissions policy violation: unload is not allowed in this document.
Hf @ index-B_gaQLZO.js:615
index-B_gaQLZO.js:455 [prosemirror-highlight] Error resolving parser: ShikiError: Language `excalidraw` is not included in this bundle. You may want to load it from external source.
    at f (index-B_gaQLZO.js:466:3436)
    at Array.map (<anonymous>)
    at Object.loadLanguage (index-B_gaQLZO.js:466:3947)
    at f (shiki-highlighter-chunk-fFkRtR7A.js:1:234)
    at d (shiki-highlighter-chunk-fFkRtR7A.js:1:448)
    at g0r (index-B_gaQLZO.js:608:557)
    at index-B_gaQLZO.js:608:670
    at TLt (index-B_gaQLZO.js:455:35603)
    at pu.apply (index-B_gaQLZO.js:455:34930)
    at jL.applyInner (index-B_gaQLZO.js:345:24941)
    at jL.applyTransaction (index-B_gaQLZO.js:345:24223)
    at jL.apply (index-B_gaQLZO.js:345:23898)
    at hYt.dispatch (index-B_gaQLZO.js:349:49942)
    at f (index-B_gaQLZO.js:455:35108)
    at index-B_gaQLZO.js:455:35235
(anonymous) @ index-B_gaQLZO.js:455
index-B_gaQLZO.js:455 [prosemirror-highlight] Error resolving parser: ShikiError: Language `excalidraw` is not included in this bundle. You may want to load it from external source.
    at f (index-B_gaQLZO.js:466:3436)
    at Array.map (<anonymous>)
    at Object.loadLanguage (index-B_gaQLZO.js:466:3947)
    at f (shiki-highlighter-chunk-fFkRtR7A.js:1:234)
    at d (shiki-highlighter-chunk-fFkRtR7A.js:1:448)
    at g0r (index-B_gaQLZO.js:608:557)
    at index-B_gaQLZO.js:608:670
    at TLt (index-B_gaQLZO.js:455:35603)
    at pu.apply (index-B_gaQLZO.js:455:34930)
    at jL.applyInner (index-B_gaQLZO.js:345:24941)
    at jL.applyTransaction (index-B_gaQLZO.js:345:24223)
    at jL.apply (index-B_gaQLZO.js:345:23898)
    at hYt.dispatch (index-B_gaQLZO.js:349:49942)
    at f (index-B_gaQLZO.js:455:35108)
    at index-B_gaQLZO.js:455:35235
(anonymous) @ index-B_gaQLZO.js:455
index-B_gaQLZO.js:455 [prosemirror-highlight] Error resolving parser: ShikiError: Language `excalidraw` is not included in this bundle. You may want to load it from external source.
    at f (index-B_gaQLZO.js:466:3436)
    at Array.map (<anonymous>)
    at Object.loadLanguage (index-B_gaQLZO.js:466:3947)
    at f (shiki-highlighter-chunk-fFkRtR7A.js:1:234)
    at d (shiki-highlighter-chunk-fFkRtR7A.js:1:448)
    at g0r (index-B_gaQLZO.js:608:557)
    at index-B_gaQLZO.js:608:670
    at TLt (index-B_gaQLZO.js:455:35603)
    at pu.apply (index-B_gaQLZO.js:455:34930)
    at jL.applyInner (index-B_gaQLZO.js:345:24941)
    at jL.applyTransaction (index-B_gaQLZO.js:345:24223)
    at jL.apply (index-B_gaQLZO.js:345:23898)
    at hYt.dispatch (index-B_gaQLZO.js:349:49942)
    at f (index-B_gaQLZO.js:455:35108)
    at index-B_gaQLZO.js:455:35235
(anonymous) @ index-B_gaQLZO.js:455
```
- [x] workspace-shell-header and the right-sidebar-icons should not overlap over each other. they may merge into each other or should be separate.
- [x] update the dark and light theme similar to github theme.
- [ ] sometime when I click on the markdown editor I am not able to trigger the markdown options using `/` trigger or `##` headings. I have to press enter to be able to have these show up.
- [ ] check the margin in the section for mermaid and excelidraw. the UI should look sleek. remove the drop down in these 2 section because we know what these sections are about.
- [ ] could image, mermaid diagram and ecalidraw sections be dragged and resized
- [ ] why does home.md content is changed to `<p><br></p>`? if there is a test case which is changing the content, then change the test case.

