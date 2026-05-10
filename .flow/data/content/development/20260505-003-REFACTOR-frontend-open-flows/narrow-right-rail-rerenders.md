---
id: development/20260505-003-REFACTOR-frontend-open-flows/narrow-right-rail-rerenders
type: task
graph: development/20260505-003-REFACTOR-frontend-open-flows
title: Narrow right-rail rerender surface
description: Extract memoized right-rail search/calendar content from App.tsx to reduce unrelated rerenders
tags:
    - performance
    - frontend
links:
    - node: development/20260505-003-REFACTOR-frontend-open-flows/extract-thread-panel-rendering
      context: Continue narrowing App.tsx rerender surfaces after the right-rail extraction
      relationships:
        - depends-on
---

- Extracted the right-rail search results and calendar content from `frontend/src/App.tsx` into memoized components in `frontend/src/components/RightRailPanels.tsx`.
- Kept the extracted panels behind stable bridge callbacks so unrelated `App.tsx` rerenders do not force the right-rail subtree to re-render from new inline handler identities.
- Removed the stale `HomeCalendarPanel` import and obsolete `handleSearchResultNavigate` wrapper left behind by the extraction.

Validation

- cd frontend && npm test -- src/App.test.tsx -t "searches graph canvas nodes by title|opens a sidebar file in the center pane on single click and keeps it open when calendar is toggled|switches to the Home workspace from a Graph and renders the HomeRichTextEditor properly"

