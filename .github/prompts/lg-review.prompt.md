---
name: lg-review
description: Review code for best practices, security issues, architecture improvements, duplicate code, simplification opportunities, and legacy code removal
argument-hint: Code, feature, diff, or area to review
agent: agent
---

Review the requested code, feature, change, or area of the project.

Start by reviewing:

- The relevant code, tests, and documentation
- [docs/architecture.md](../../docs/architecture.md) when architectural intent or system boundaries matter
- Any related diffs, changed files, or issue context if they are available

Follow this workflow:

1. Review the code with a code-review mindset focused on correctness, maintainability, clarity, and operational risk.
2. Check whether the implementation follows strong coding practices for the language and project conventions in the repository.
3. Check for security issues, including unsafe input handling, data exposure, broken trust boundaries, insecure defaults, injection risks, access-control gaps, or misuse of secrets.
4. Check whether the architecture could be improved, including unclear responsibilities, poor boundaries, weak abstractions, or design choices that conflict with [docs/architecture.md](../../docs/architecture.md).
5. Check for duplicate code that should be consolidated or extracted.
6. Check whether the code can be simplified further without reducing clarity or changing behavior.
7. Ask the user whether there is legacy code in the reviewed area that is safe to remove or intentionally kept for compatibility. Do this when that context is not already clear from the repository or conversation.
8. If you identify issues, prioritize findings by severity and user impact.
9. If no issues are found, state that explicitly and mention any residual risk or testing gaps.

Review rules:

- Prefer identifying root problems over surface-level style commentary.
- Focus first on bugs, regressions, security problems, architectural risks, and maintainability issues.
- Do not propose removals of apparently unused or legacy code as a required change until the user confirms it is safe to remove.
- Keep suggestions practical and proportional to the code under review.
- Avoid nitpicks unless they point to a real maintainability or correctness problem.

Use this response structure:

## Findings

List findings first, ordered by severity.

For each finding include:

- Severity: High, Medium, or Low
- Area: security, architecture, duplication, simplification, correctness, maintainability, or testing
- Explanation of the issue
- Why it matters
- Recommended fix or direction

If there are no findings, say: `No material findings.`

## Legacy Code Check

Ask whether there is any legacy code in the reviewed area that can be removed, or note that no likely legacy code was identified.

## Residual Risks

Call out any uncertainty, untested paths, missing context, or assumptions that limit confidence in the review.

## Summary

Give a short overall assessment of code quality and the most important next step.

Example response:

## Findings

1. Severity: High
   Area: security
   The request handler accepts a raw sort field and concatenates it into a database query without constraining it to an allowlist.
   Why it matters: This creates an injection path and allows callers to alter query behavior outside the intended API contract.
   Recommended fix or direction: Restrict sort fields to an explicit allowlist and reject unsupported values before query construction.

2. Severity: Medium
   Area: duplication
   The same export normalization logic appears in both the API handler and the background job entry point.
   Why it matters: The behavior can drift over time and increases the chance of inconsistent validation.
   Recommended fix or direction: Extract the normalization into a shared helper with focused tests.

3. Severity: Low
   Area: simplification
   The filter transformation path uses nested conditionals that can be reduced to a smaller set of early returns.
   Why it matters: The current structure is harder to reason about and increases maintenance cost.
   Recommended fix or direction: Collapse the branching into a simpler normalization flow while preserving tests.

## Legacy Code Check

There appears to be an older export formatting path that may no longer be used. Is that legacy code safe to remove, or is it still needed for compatibility?

## Residual Risks

The review did not verify runtime behavior against production-sized datasets, so performance and scale characteristics are still uncertain.

## Summary

The code is close to acceptable, but the query-construction issue should be fixed first because it is a direct security risk.