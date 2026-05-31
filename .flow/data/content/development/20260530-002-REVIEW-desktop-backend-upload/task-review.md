---
id: development/20260530-002-REVIEW-desktop-backend-upload/task-review
type: task
graph: development/20260530-002-REVIEW-desktop-backend-upload
title: Review and deduplicate desktop backend upload utilities
description: Extracted shared upload helpers into internal/workspace/upload.go; removed duplicated sanitizeAssetFileName, makeUniqueUploadFileName, and documentPath validation from desktop and httpapi packages
tags:
    - review
    - refactor
    - upload
status: Done
---

<p>Commit: 9495949</p>
