---
id: development/20260821-002-FIX-desktop-workspace-switch-writes/wire-workspace-switch-notification
type: task
graph: development/20260821-002-FIX-desktop-workspace-switch-writes
title: Notify desktop backend on workspace switch
description: 'httpapi.Options gains OnRootChanged, fired by /api/workspace/select and local deregistration; runner_wails wires it to app.backend.SetRoot (commit: 98c8aa1)'
tags:
    - implementation
status: Done
links:
    - node: development/20260821-002-FIX-desktop-workspace-switch-writes/make-backend-root-switchable
      context: Notification hook stores into the shared root that SetRoot makes available
      relationships:
        - depends-on
---

