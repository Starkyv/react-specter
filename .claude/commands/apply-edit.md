---
description: Pull the pending Specter selection (element + change request captured in the browser overlay) from the local MCP bridge and apply the edit to the real source, with a plan-echo confirmation gate.
argument-hint: (no arguments — the selection comes from the bridge)
disable-model-invocation: true
allowed-tools: mcp__specter__get_pending_edit, mcp__specter__clear_pending_edit, Read, Edit, Write, Glob, Grep
---

Apply the pending Specter edit (react-specter select-to-edit).

## Step 1 — Pull the selection

Call `mcp__specter__get_pending_edit`.

- `{"pending": false}` → relay the `note` to the user (select an element in the browser overlay first, or use the other session that owns the bridge port) and STOP.
- Otherwise you have: `sourceFile`, `sourceLine`, `component`, `elementSnippet`, `tagName`, `textContent`, `classList`, `ancestorComponents`, `instanceVsShared`, `userRequest`, `route`, `instanceCount`.

## Step 2 — Anchor, then relocate if needed

Open `sourceFile` at `sourceLine`. Line numbers come from the last compiled build and can drift — confirm you're on the right element using `component`, `tagName`, `elementSnippet`, and `classList`. If the line doesn't match, locate the element by those signals within the file; if the file itself moved, use `ancestorComponents` to find it. Never edit on a coordinate you haven't visually confirmed.

## Step 3 — Trace to where the change actually belongs

The anchor is a starting point, not the fix location. Trace through the project's layers:

- **Styling change** → wherever this component's styles live (its CSS/SCSS module, styled-component, theme token, utility classes — follow the project's existing approach).
- **Content/label change** → the JSX, or the constants/i18n file the text comes from.
- **Prop/behavior change** → may belong in the parent (walk `ancestorComponents`).
- **Data/payload change** (add a field, change what's submitted) → trace the full chain: form component → state/hook → model/type → API layer. Missing one layer is the classic failure — list every file in the plan.

## Step 4 — Project rules (hard)

<!-- CUSTOMIZE: add your repo's hard rules here (styling system, component
     reuse policy, file conventions, decision log, …). The two below are
     Specter-inherent — keep them. -->

- **Respect `instanceVsShared`.** `"instance"` → do NOT modify a shared component or another instance; change only this usage (extract a feature-local variant if needed, and flag it). `"shared"` → the component-wide change was explicitly chosen; still list every visible call site in the plan.
- New business logic, a new API endpoint, or a new shared component implied by the request → do NOT improvise: state it and ask the user how to proceed.

## Step 5 — Echo the plan, then WAIT

Before any edit, state: the selected element (component + file:line), your reading of the request, and the exact files you'll touch with one line each on what changes. Then stop and wait for the user to confirm or correct. Do not edit before confirmation.

## Step 6 — Edit and self-check

After confirmation: make the edits, then run the project's typecheck/lint (and the relevant test if one covers the touched files). Fix what breaks; report honestly anything still failing.

## Step 7 — Clear and hand back

Call `mcp__specter__clear_pending_edit`, then tell the user: refresh the browser (the dev server hot-reloads) and test the change.

## Multi-turn behavior

- **Follow-ups on this edit** ("make it required", "rename it", "move it above the title") arrive as plain messages — treat them as refinements of the in-progress change using the context you already have. Re-echo a brief plan only if the follow-up is multi-file. Do NOT re-run this command or re-call `get_pending_edit` for refinements.
- **A new element** means the user re-selected in the browser and will run `/apply-edit` again — that fresh call pulls the new (latest-wins) selection.
- Reuse what you've already established this session (files touched, instanceVsShared answer) instead of re-deriving it.
