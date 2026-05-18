---
id: development/20260518-001-FIX-content-tree-loading/root-cause
type: note
graph: development/20260518-001-FIX-content-tree-loading
title: 'Root cause: ensureIndexExists TOCTOU race'
description: Two concurrent startup requests race on index rebuild; ensureIndexExists has no mutex
tags:
    - analysis
---

