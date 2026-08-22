---
id: development/20260822-002-FEAT-roadmap-batch-parallel-dev/build-roadmap-view
type: task
graph: development/20260822-002-FEAT-roadmap-batch-parallel-dev
title: Build RoadmapView in internal/core
description: 'Build RoadmapView in internal/core (Done 2026-08-22; evidence: unit tests in internal/core/roadmap_test.go, go test ./... green). Groups tasks by sub-graph slug, classifies feature status, computes readiness gaps (missing acceptance criteria, open question-tagged notes), next-ready queue ordered by layer then updatedAt via graph.BuildTaskLayerView.'
tags:
    - implementation
    - core
status: Done
---

