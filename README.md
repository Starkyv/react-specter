# react-specter

**Select-to-edit for React apps.** Click an element in your running dev app, type a change in plain language, and your AI coding agent (Claude Code or any MCP-capable agent) edits the real source file — no hunting for "where is this button in the code?".

```
pnpm dev  →  ✦ / ⌘⇧E opens the prompt box  →  Inspect  →  click an element
→  describe the change  →  Send  →  Claude starts the edit automatically
   (--channels session — else run /apply-edit)  →  refresh & test
```

Works with **every React framework**: Vite, Next.js (webpack *and* Turbopack), Remix, Astro, CRA, Gatsby, or any Babel/webpack pipeline.

## How it works

| Part | What it does |
|---|---|
| **Annotation** (build plugin) | In dev, every *host* JSX element (`<div>`, `<button>`, …) is stamped at compile time with `data-specter-file` / `data-specter-line` / `data-specter-component`. Component JSX (`<Button>`) is never given props; spreads can't clobber the stamps; the transform is idempotent. |
| **Overlay** (runtime) | A floating prompt box (✦ button / ⌘⇧E) in its own React root, fully outside your app tree — drag it anywhere, hide it via the ✕ in its corner (draft and selection survive). Its **Inspect** button arms selection: hover outlines elements, click captures one into the box, a breadcrumb walks the ancestor components, then you type the change — **attach images** (paste, drop, or pick; e.g. a design mock) — and send. If the same JSX call site renders N times you're asked: *just this instance, or the component everywhere?* |
| **Bridge** (local MCP server) | One process, two faces: MCP over stdio for your agent (`get_pending_edit` / `clear_pending_edit`) and HTTP on `127.0.0.1:7331` for the overlay's POST. Every Send is **pushed straight into the session** as a Claude Code channel event (auto-applies in `--channels` sessions) *and* queued latest-wins for the `/apply-edit` pull path. Dies with the agent session; off-localhost the overlay falls back to copying the assembled instruction to your clipboard. |
| **`/apply-edit`** (agent command) | A shipped command template: pull the selection, anchor on `file:line`, trace the change to where it actually belongs, **echo a plan and wait for confirmation**, edit, self-check, clear the queue. |

Default production builds ship **zero** specter bytes — annotation is dev-only and the overlay refuses to mount when `NODE_ENV === 'production'` (both overridable for deliberately stamped internal builds).

## Quick start (Vite + Claude Code)

```sh
pnpm add -D react-specter
npx react-specter init   # writes .claude/commands/apply-edit.md + .mcp.json entry
```

```ts
// vite.config.ts — specter() BEFORE the React plugin
import react from '@vitejs/plugin-react'; // or plugin-react-swc — both work
import { defineConfig } from 'vite';
import specter from 'react-specter/vite';

export default defineConfig({
  plugins: [specter(), react()],
});
```

```ts
// src/main.tsx (or any client entry) — dev-only dynamic import
if (import.meta.env.DEV) {
  import('react-specter').then(m => m.mountSpecter());
}
```

Or, if you prefer JSX, the render-nothing **component wrapper** (this is what [`examples/vite-react`](./examples/vite-react) uses):

```tsx
// src/main.tsx
import { Specter } from 'react-specter';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {import.meta.env.DEV && <Specter />}
  </StrictMode>,
);
```

Both ship zero bytes to production: the dynamic import is never fetched, and the wrapper's statically-false `DEV` guard lets the import tree-shake away (`sideEffects: false`).

Restart your agent session (so it picks up the MCP server), run `pnpm dev`, press **⌘⇧E** to open the prompt box, hit **Inspect**, click an element, type the change, *Send to Claude*, then type `/apply-edit` in Claude Code.

## Install per framework

The annotation must run **before** JSX is compiled away. Pick the adapter for your build:

### Vite (also Remix, Astro, TanStack Start)

As in the quick start — `specter()` first in `plugins`. Active for the dev server only; `specter({ enabled: true })` forces stamping into a build (for deployed internal dev environments).

### Next.js

```js
// next.config.mjs
import { withSpecter } from 'react-specter/next';

export default withSpecter({
  /* your config */
});
```

Covers `next dev` with **webpack and Turbopack** (Next 15+ `turbopack.rules`; pass `{ turbopack: false }` as the second argument on Next 13/14). Both server and client compilations are stamped, so SSR'd HTML and hydration match. `next build` is untouched.

Mount the overlay with the render-nothing client component:

```tsx
// app/layout.tsx
import { Specter } from 'react-specter';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        {process.env.NODE_ENV === 'development' && <Specter />}
      </body>
    </html>
  );
}
```

### Create React App (via craco), plain webpack, Rspack

`react-specter/webpack` is a standard transform loader — add it with `enforce: 'pre'` so it sees raw source, dev config only:

```js
// craco.config.js / webpack.config.js (dev)
module.exports = {
  webpack: {
    configure: config => {
      config.module.rules.push({
        test: /\.[jt]sx$/,
        exclude: /node_modules/,
        enforce: 'pre',
        use: [{ loader: 'react-specter/webpack' }],
      });
      return config;
    },
  },
};
```

### Gatsby, Parcel, or any Babel pipeline

`react-specter/babel` is a plain Babel plugin — enable it for development only:

```js
// babel.config.js
module.exports = {
  env: {
    development: {
      plugins: ['react-specter/babel'],
    },
  },
};
```

For the overlay in webpack/Babel setups, use the same guarded dynamic import as Vite (with your bundler's dev flag, e.g. `process.env.NODE_ENV === 'development'`).

## Agent setup

`npx react-specter init` does both steps; manually they are:

**1. Register the bridge** — `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "specter": { "command": "npx", "args": ["react-specter", "bridge"] }
  }
}
```

**2. Install the `/apply-edit` command** — copy [`templates/apply-edit.md`](./templates/apply-edit.md) to `.claude/commands/apply-edit.md` and customize its *Project rules* section with your repo's conventions (styling system, reuse policy, …).

Any MCP-capable agent works the same way: spawn `react-specter bridge` over stdio and call `get_pending_edit` / `clear_pending_edit`.

**Images:** attachments (up to 4 × 5 MB — paste, drop, or pick in the prompt box) ride along with the selection. The bridge writes them to `node_modules/.cache/react-specter/images/` and hands the agent `imagePaths` to view with its Read tool; files are replaced latest-wins and deleted on `clear_pending_edit`. The clipboard fallback is text-only — attached images are noted but not carried.

If two agent sessions run at once, the second bridge can't bind the port — it stays alive and its `get_pending_edit` tells you which session to use instead. Port override: `SPECTER_BRIDGE_PORT` env (keep the overlay's `bridgeUrl` in sync).

### Auto-apply — skip `/apply-edit` entirely

Claude Code's **channels** (research preview, ≥ 2.1.80) let the bridge push each Send straight into your running session. Start the session with:

```sh
claude --channels server:specter
# some versions require, for project-local servers:
claude --dangerously-load-development-channels server:specter
```

Now clicking *Send to Claude* delivers the selection as a `<channel source="specter">` event and **Claude starts the edit immediately** (as soon as its current turn finishes) — no `/apply-edit`, no confirmation step. Mind the trade-offs:

- The pushed instruction asks Claude to state a one-line plan and make the minimal edit — but nobody confirms before files change. Prefer the `/apply-edit` flow when you want the echoed-plan checkpoint.
- Anything that can POST to `127.0.0.1:7331` can inject a prompt into your session. The bridge binds localhost-only; still, treat `--channels` sessions as dev-machine-only.
- MCP being pull-based is why this needs channels: an MCP server cannot otherwise make an interactive session act. Sessions started *without* `--channels` silently drop the push — the selection stays queued, and `/apply-edit` keeps working unchanged.

## Options

### `mountSpecter(options)` / `<Specter {...options} />`

Two equivalent ways to mount — imperative, or the render-nothing component wrapper (options are read once, at first mount):

```tsx
mountSpecter({ agentLabel: 'Claude', hotkey: true });
// or, anywhere in JSX:
<Specter agentLabel="Claude" hotkey />
```

| Option | Default | What it does |
|---|---|---|
| `enabled` | `true` | Hard off-switch. |
| `force` | `false` | Allow mounting in a production build (deliberately stamped internal deploys). |
| `bridgeUrl` | `http://127.0.0.1:7331/pending-edit` | Bridge endpoint. When set explicitly, the bridge is always attempted; by default only when the page runs on localhost. |
| `rulesPreamble` | generic rules | Text prepended to every clipboard instruction — encode your repo's conventions here. |
| `agentLabel` | `"Claude"` | Display name on the send button. |
| `hotkey` | `true` | ⌘⇧E / Ctrl⇧E shows/hides the prompt box. |
| `onSend` | – | Custom send action — **replaces** the default bridge/clipboard delivery; see below. |

`mountSpecter` returns an unmount function; `unmountSpecter()` is also exported.

### Custom send action (`onSend`)

When `onSend` is set, clicking the send button calls it with the assembled payload instead of the bridge/clipboard path — wire it to your own backend, agent, or queue. Return a string to show as the feedback line (omit it for a plain "Sent ✓"); throw to show a failure. The button shows *Sending…* while a returned promise is in flight. Pair with `agentLabel` to relabel the button.

```ts
import { mountSpecter, type SpecterPayload } from 'react-specter';

mountSpecter({
  agentLabel: 'DevBot',
  onSend: async (payload: SpecterPayload) => {
    await fetch('/api/devbot/edits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return 'Queued for DevBot ✓';
  },
});
```

### Build adapters

- `specter({ enabled?, include?, parserPlugins? })` (Vite) — `include` defaults to `/\.[jt]sx$/`; `parserPlugins` for non-standard syntax (e.g. `['decorators-legacy']`).
- `react-specter/webpack` loader — same `include` / `parserPlugins` via loader `options`.
- `withSpecter(nextConfig, { enabled?, turbopack? })`.
- A failed annotation never breaks your build — the file is served unstamped with a warning.

## Tickets

For testers (e.g. on a deployed, stamped dev environment), **Copy for ticket** puts paste-ready markdown (element, component, `source file:line`, route, ancestors) on the clipboard — paste it into any tracker. For deeper integrations (sending to your own backend or tracker API), use the `onSend` callback above.

## Stamped internal builds & production safety

For a deployed **internal dev environment** where testers should inspect elements:

1. Build with stamping forced on (`specter({ enabled: true })` / `withSpecter(cfg, { enabled: true })` behind your own env flag, in a **separate CI build** — never an artifact later promoted to prod).
2. Mount the overlay with `force: true` behind the same flag.

Trade-offs: slightly larger bundles (three attributes per host element) and repo file paths visible in the DOM — fine internally, never for customer-facing deploys.

Verify any build is clean:

```sh
grep -ri "data-specter" dist/ | wc -l   # must print 0
```

## Requirements

- React ≥ 18 (overlay uses `createRoot`)
- Node ≥ 18.17 (bridge/CLI)
- The annotation adapters need no React at all — they run in your bundler's Node process.

## License

[MIT](./LICENSE)
