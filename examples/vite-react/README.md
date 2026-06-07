# react-specter — Vite example

A minimal Vite + React app wired up with react-specter, for testing the full
select-to-edit loop against a local checkout of the framework.

`react-specter` is linked from the repo root (`link:../..`), so the root
package must be built first.

## Run it

```sh
# 1. From the repo root: install + build the framework
pnpm install
pnpm build

# 2. From this folder: install + start the dev server
cd examples/vite-react
pnpm install
pnpm dev
```

Open the printed URL, press **⌘⇧E** (Ctrl⇧E) or click the **✦** button — a
floating prompt box appears. Hit **Inspect** and hover around — every element
shows its source `file:line`.

The overlay is mounted via the render-nothing `<Specter />` wrapper in
[`src/main.tsx`](./src/main.tsx), guarded by `import.meta.env.DEV` so
production builds tree-shake it away entirely. Its commented-out props show
the customization points (`agentLabel`, a custom `onSend` action).

## Test the agent loop

`.mcp.json` and `.claude/commands/apply-edit.md` are already in place. Start
Claude Code **in this folder** (so it picks up the MCP bridge), then:

1. `pnpm dev`, open the prompt box (✦ / ⌘⇧E), hit *Inspect*, click an element
2. Type a change request, hit *Send to Claude*
3. In Claude Code, run `/apply-edit`
4. Confirm the echoed plan, watch the source file change, refresh

**Auto-apply** (Claude Code ≥ 2.1.80, research preview): start the session as
`claude --channels server:specter` instead — then *Send to Claude* starts the
edit immediately, no `/apply-edit` or confirmation step.

## Things worth trying

- **Drag it:** grab the box by its header and park it anywhere; the ✕ in the
  corner hides it (draft and selection survive) and ✦ brings it back.
- **Breadcrumb:** inspect the counter button — the ancestor walk shows
  `Counter → App`.
- **Instance vs shared:** the three feature cards render from a single
  `<FeatureCard>` call site — inspecting one asks whether the change targets
  just that instance or the component everywhere.
- **Clipboard fallback:** stop the bridge (quit Claude Code) and send again —
  the assembled instruction lands on your clipboard instead.
- **Clean production build:** `pnpm build && grep -ri "data-specter" dist/ | wc -l`
  must print `0`.

After editing framework source at the repo root, re-run `pnpm build` there —
the example consumes the built `dist/`, and Vite picks the change up on reload.
