# Karabiner Config Refactor & Cleanup — Design

**Date**: 2026-04-26
**Branch**: `refactor-and-cleanup`
**Scope**: Refactor only. No functionality changes. Verified via byte-equal JSON snapshot diff at every commit.

## Goal

Reduce duplication and improve organization in `karabiner-config.ts` (746 lines) and `utils.ts` (260 lines) without changing the generated Karabiner profile. The three target areas:

- **A. Reduce app-rule boilerplate** via a shared `appCommons` helper.
- **B. Unify Leader and Hyper** around a shared shape and shared internal helpers, while preserving each engine's distinct state-machine mechanic.
- **C. Reorganize file structure** into three top-level files with clear responsibilities.

## Non-goals

- No new features.
- No behavior changes (verified byte-for-byte).
- No reorganization beyond the three targeted files (no `src/` subdirectories).
- No resolution of the Leader-App / Hyper-Open content overlap (out of scope; functionality preservation requires keeping both).

## Verification mechanism

Every commit on this branch must produce an empty `diff` against a baseline snapshot of the generated Karabiner profile.

### Setup

`main()` accepts the write target as a parameter, selected from an env var:

```ts
function main(target: string = 'Default') {
  writeToProfile(target, [...rules], { ...params })
}
const target = process.env.KARABINER_DRY_RUN ? '--dry-run' : 'Default'
main(target)
```

`package.json` gets a snapshot script:

```json
"snapshot": "KARABINER_DRY_RUN=1 tsx karabiner-config.ts"
```

`writeToProfile('--dry-run', ...)` is a built-in karabiner.ts mode that prints the full computed profile JSON to stdout without touching `~/.config/karabiner/karabiner.json`. Output is deterministic (`JSON.stringify(config, null, 2)`).

### Workflow

1. Before any source changes: `npm run snapshot > /tmp/before.json`
2. After each refactor commit: `npm run snapshot > /tmp/after.json && diff /tmp/before.json /tmp/after.json`
3. Empty diff → commit accepted. Non-empty diff → step is wrong; fix or revert.

`npm run build` (the existing live-write script) is unaffected: it does not set `KARABINER_DRY_RUN`, so `process.env.KARABINER_DRY_RUN` is `undefined`, and `main()` receives the default `'Default'` profile target.

### Why this is sufficient

Karabiner evaluates manipulators in the order they appear in the JSON. A byte-equal snapshot is therefore a strict superset of behavioral equivalence — anything that could affect runtime behavior must produce a JSON diff. The converse is not true (some JSON diffs are functionally equivalent), but treating any diff as a regression keeps the bar high and avoids subjective judgment calls during the refactor.

## File layout (C)

Three top-level files, all flat (no `src/`):

### `karabiner-config.ts` — entry point

Contains `main()` and the rule-definition functions:
- `rule_duoModifiers()`
- `layer_vim()`, `layer_symbol()`, `layer_digitAndDelete()`, `layer_snippet()`, `layer_system()`
- `app_chrome()`, `app_safari()`, `app_jetBrainsIDE()`, `app_zed()`, `app_vsCode()`, `app_cursor()`, `app_slack()`, `app_warp()`, `app_spark()`, `app_zoom()`, `app_chatGPT()`
- `app_raycast()`, `app_homerow()`
- `keyboard_apple()`, `keyboard_moonlander()`

Removed (replaced by direct engine calls): `rule_leaderKey()`, `rule_hyperLayer()` wrappers.

### `layer-engines.ts` — project-specific nested-layer machinery

New file. Exports:
- `createLeaderLayer(config: LeaderConfig): RuleBuilder`
- `createHyperLayer(config: HyperConfig): RuleBuilder[]`
- `type LeaderConfig`
- `type HyperConfig`

Internal (not exported):
- `formatTopHint(entries)` — produces `"a_App e_Emoji g_Gitmoji ..."`
- `formatSubHint(mapping, label)` — produces sublayer hint strings
- `escapeBindings(condition, vars)` — produces `⎋`/`⇪` manipulators that unset state vars and remove notification messages
- `hyperSubVar(key)` — `hyper_sub_<key>` naming convention

### `utils.ts` — generic helpers usable in any karabiner.ts project

Retained (unchanged behavior, possibly relocated within the file):
- `historyNavi`, `tabNavi`, `switcher`
- `tapModifiers`
- `duoModifiers`
- `raycastExt`, `raycastWin`
- `toResizeWindow`
- `toClearNotifications`
- `toSystemSetting`

Added:
- `appCommons(opts)` — see Section A below.

Removed (moved to `layer-engines.ts`):
- `createHyperLayer`, `HyperSubLayer`, `hyperSubVar`

## A. `appCommons` helper

**Canonical manipulator order** (fixed by the helper):
```
history → tab → switcher → prependExtras → taps → appendExtras
```

The helper has no dedicated `resize` slot — the position of the resize manipulator relative to other app-specific extras varies per app (JetBrains/Zed have it after an escape-remap; Warp has it before a ⏎ remap; ChatGPT has it before taps). Treating resize as just another manipulator the caller composes into `prependExtras`/`appendExtras` keeps the helper's contract simple ("nav block, then your manipulators in order") and accommodates every existing case without escape hatches.

**Signature** (in `utils.ts`):

```ts
type AppCommonsOptions = {
  history?: boolean
  tab?: boolean
  switcher?: boolean
  prependExtras?: ManipulatorBuilder[]    // between nav block and taps
  taps?: Parameters<typeof tapModifiers>[0]
  appendExtras?: ManipulatorBuilder[]     // after taps
}

export function appCommons(opts: AppCommonsOptions): ManipulatorBuilder[]

/** Convenience: builds the standard `1 + Meh -> resize current window` manipulator. */
export function appResize(
  app: string,
  position?: { x: number; y: number },
  size?: { w: number; h: number },
): ManipulatorBuilder
```

`appResize` is just `map(1, 'Meh').to(toResizeWindow(app, position, size))` — a one-liner that lets callers drop a resize into a manipulator array without restating the trigger and `toResizeWindow` plumbing.

**Per-app mapping** (one row per app, verified against current source order):

| App        | nav (history/tab/switcher) | prependExtras                            | taps | appendExtras                                                          |
|------------|----------------------------|------------------------------------------|------|------------------------------------------------------------------------|
| Chrome     | ✓ ✓ ✓                      | —                                        | ✓    | `[appResize('Google Chrome')]`                                         |
| Safari     | ✓ ✓ ✓                      | —                                        | ✓    | `[appResize('Safari')]`                                                |
| JetBrains  | ✓ ✓ ✓                      | —                                        | ✓    | `[map('⎋','⌘').to('⎋','⌘⇧'), appResize('WebStorm')]`                   |
| Zed        | ✓ ✓ ✓                      | —                                        | ✓    | `[map('⎋','⌘').to('⎋','⌘⇧'), appResize('Zed')]`                        |
| VSCode     | — ✓ ✓                      | `[map('h','⌃')..., map('l','⌃')...]`     | ✓    | `[appResize('Code')]`                                                  |
| Cursor     | — ✓ ✓                      | `[map('h','⌃')..., map('l','⌃')...]`     | ✓    | —                                                                      |
| Warp       | — ✓ —                      | —                                        | —    | `[appResize('Warp'), map('⏎','⇧').to('j','⌃')]`                        |
| Slack      | ✓ — —                      | —                                        | ✓    | `[appResize('Slack', { x:1263, y:25 }, { w:1760, h:1415 })]`           |
| Spark      | — — —                      | —                                        | ✓    | `[appResize('Spark Desktop', undefined, { w:1644, h:1220 })]`          |
| Zoom       | — — —                      | —                                        | ✓    | —                                                                      |
| ChatGPT    | — — —                      | `[appResize('ChatGPT')]`                 | ✓    | —                                                                      |

**Out of scope for the helper**: `app_raycast()` and `app_homerow()` are not bundle-scoped app rules; they keep their existing structure. `keyboard_apple()` and `keyboard_moonlander()` are device-scoped and remain unchanged.

## B. Layer engines (Leader + Hyper)

Both engines live in `layer-engines.ts` with a parallel public API and shared internal helpers. Their state-machine differences (Leader's chained-state var vs Hyper's hold-based per-sublayer vars) stay in the engine bodies — they are genuinely different mechanics, and forcing them into one shape would risk behavior drift.

### Public types

```ts
// Leader sublayer config — matches existing `rule_leaderKey` mappings shape verbatim.
export type LeaderConfig = {
  [sublayerKey: string]: {
    name: string
    mapping: { [key: string]: string | string[] }
    action: (v: string) => ToEvent | ToEvent[]
  }
}

// Hyper sublayer config — matches existing HyperSubLayer shape verbatim.
export type HyperConfig = {
  [sublayerKey: string]: {
    name: string
    mapping: { [key: string]: ToEvent | ToEvent[] }
  }
}
```

### Public functions

```ts
export function createLeaderLayer(config: LeaderConfig): RuleBuilder
export function createHyperLayer(config: HyperConfig): RuleBuilder[]
```

`createLeaderLayer` returns a single `RuleBuilder` (Leader is one rule). `createHyperLayer` returns `[layerRule, hyperRule]`, both rule builders, ready to spread into the `writeToProfile` rules array. This eliminates the current call-site boilerplate that wraps the Hyper manipulators in a separate `rule()`.

### Shared internal helpers

```ts
// "a_App e_Emoji g_Gitmoji ..."  — top-level hint
function formatTopHint(entries: Array<{ key: string; name: string }>): string

// Sublayer hint. For Leader, label resolves a value (tuples use [_, label]).
// For Hyper, label is the key itself (no value transform needed).
function formatSubHint<V>(mapping: Record<string, V>, label: (v: V) => string): string

// Builds [⎋, ⇪] -> [unset vars, remove notifications] manipulators under a condition.
// `vars` lists every variable to unset on each escape press; both ⎋ and ⇪ unset all of them.
// For Hyper: vars=['hyper'] (top-level escape) or vars=['hyper_sub_o'] (per-sublayer escape).
// For Leader: vars=['leader'] (single shared state var across all leader states).
function escapeBindings(
  condition: ConditionBuilder | ConditionBuilder[],
  vars: string[],
): ManipulatorBuilder[]
```

### Caller (`main()`) shape

```ts
function main(target: string = 'Default') {
  writeToProfile(target, [
    rule_duoModifiers(),
    createLeaderLayer({ a: {...}, e: {...}, g: {...}, l: {...}, r: {...}, s: {...} }),
    ...createHyperLayer({ o: {...}, w: {...}, s: {...}, v: {...}, c: {...}, r: {...} }),

    layer_vim(),
    layer_symbol(),
    layer_digitAndDelete(),
    layer_snippet(),
    layer_system(),

    app_chrome(),
    app_safari(),
    // ...
  ], { /* params */ })
}
```

### Type-cast cleanup

While moving `createHyperLayer` to the new file, the two `(k as any)` / `(letter as any)` casts get tightened using `keyof HyperConfig` and `keyof HyperConfig[K]['mapping']` constraints. This is a typing improvement only — runtime values are unchanged, so the snapshot diff stays empty.

## Migration plan

Every step is its own commit. **Acceptance gate**: `diff /tmp/before.json /tmp/after.json` is empty after every commit. Non-empty diff → step is wrong; fix or revert.

**Step 0 — Pre-flight (verification scaffolding)**
- Modify `main()` to accept a target argument; read from `KARABINER_DRY_RUN` env var.
- Add `"snapshot": "KARABINER_DRY_RUN=1 tsx karabiner-config.ts"` to `package.json`.
- Capture baseline: `npm run snapshot > /tmp/before.json`.
- Smoke-check: `npm run build` still updates the live profile.
- Commit: `wire up snapshot dry-run for refactor verification`

**Step 1 — Create `layer-engines.ts`, move `createHyperLayer` over**
- New file `layer-engines.ts`. Move `createHyperLayer`, `HyperSubLayer`, `hyperSubVar` out of `utils.ts`.
- Rename `HyperSubLayer` → `HyperConfig` (keyed-by-sublayer record type).
- Update imports in `karabiner-config.ts`.
- Tighten `(k as any)` / `(letter as any)` using `keyof` constraints.
- Snapshot + diff. Commit: `extract layer engines into layer-engines.ts`

**Step 2 — Wrap `createHyperLayer` to return `RuleBuilder[]`**
- Move `rule('Hyper Layer').manipulators(manipulators)` wrap inside the engine.
- Caller becomes `...createHyperLayer({...})`.
- Snapshot + diff. Commit: `fold Hyper rule wrapping into createHyperLayer`

**Step 3 — Add `createLeaderLayer` to `layer-engines.ts`**
- Move the body of `rule_leaderKey()` into a new `createLeaderLayer(config)` in `layer-engines.ts`.
- Remove the `rule_leaderKey()` wrapper from `karabiner-config.ts`.
- Caller (`main()`) calls `createLeaderLayer({...})` directly.
- Snapshot + diff. Commit: `extract createLeaderLayer engine`

**Step 4 — Factor shared helpers in `layer-engines.ts`**
- Extract `formatTopHint`, `formatSubHint`, `escapeBindings` as private helpers.
- Both engines call them.
- Snapshot + diff. Commit: `share hint and escape helpers between layer engines`

**Step 5 — Migrate `app_*` to `appCommons`** (helper introduced together with first callers; no dead-code commit)
- **5a** — Add `appCommons` and `appResize` to `utils.ts`. Migrate Chrome, Safari, Zoom (canonical, simplest). Snapshot + diff. Commit: `add appCommons helper and migrate chrome/safari/zoom`
- **5b** — JetBrains, Zed (appendExtras with escape-remap before resize). Commit: `migrate jetbrains/zed to appCommons`
- **5c** — VSCode, Cursor (prependExtras for h/l). Commit: `migrate vscode/cursor to appCommons`
- **5d** — Warp (no taps; resize then ⏎-remap in appendExtras). Commit: `migrate warp to appCommons`
- **5e** — Slack, Spark (custom resize position/size). Commit: `migrate slack/spark to appCommons`
- **5f** — ChatGPT (resize as prependExtras). Commit: `migrate chatgpt to appCommons`
- Snapshot + diff after each.

**Step 6 — Final tidy**
- Remove unused imports across all three files.
- Confirm `utils.ts` contains only generic helpers; `layer-engines.ts` only project-specific layer machinery; `karabiner-config.ts` only rule definitions and `main()`.
- Snapshot + diff. Commit: `tidy imports after refactor`

**Total**: 12 commits (Steps 0, 1, 2, 3, 4, 5a–5f, 6). Estimated 1–2 hours including diff checks.

**Rollback**: every step is a single commit; `git revert` works cleanly because no step depends on a later step's behavior change (there are none — only structural changes).

## Risks and mitigations

- **Risk**: helper canonical order doesn't match an app's existing manipulator order → JSON diff fails.
  **Mitigation**: per-app mapping table above verified row-by-row against current source. The helper has no fixed `resize` position — every app composes resize and other extras into `prependExtras`/`appendExtras` in source order. If a future deviation surfaces, the same prepend/append slots accommodate it without changing the helper.

- **Risk**: TypeScript narrowing during `(k as any)` cleanup behaves differently at runtime.
  **Mitigation**: TS casts are erased at runtime; only the type checker is affected. Snapshot diff catches any actual emitted-JS difference.

- **Risk**: Moving `createHyperLayer` between modules introduces an import cycle.
  **Mitigation**: `layer-engines.ts` imports from karabiner.ts only, not from `utils.ts` or `karabiner-config.ts`. `utils.ts` likewise imports from karabiner.ts only. `karabiner-config.ts` imports from both. Strict layering.

- **Risk**: `writeToProfile` dry-run output is non-deterministic across runs (e.g., insertion-order quirks).
  **Mitigation**: confirmed deterministic (single `JSON.stringify(config, null, 2)` over a config built synchronously from the rules array). Pre-flight step captures a baseline; if a no-op snapshot run produces a non-empty diff against itself, abort and investigate before any source changes.
