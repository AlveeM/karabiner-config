# Karabiner Config Refactor & Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `karabiner-config.ts` and `utils.ts` for reduced duplication and clearer file responsibilities, with zero behavior change verified by byte-equal JSON snapshot diffs at every commit.

**Architecture:** Three top-level files: `karabiner-config.ts` (entry + rule definitions), `layer-engines.ts` (project-specific Leader/Hyper engines + shared internal helpers), `utils.ts` (generic karabiner.ts helpers + new `appCommons`/`appResize`). Migration proceeds in 12 commits, each gated on an empty snapshot diff against a baseline captured before any source change.

**Tech Stack:** TypeScript, `karabiner.ts` library, `tsx` runtime. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-04-26-karabiner-refactor-cleanup-design.md`

---

## Plan-wide invariants

These apply to every task. **Do not skip.**

### Verification protocol (the "test" for this refactor)

This refactor has no behavioral tests. The single acceptance gate is **byte-equal JSON output** from `writeToProfile('--dry-run', ...)`, captured before any source change and re-checked after every commit.

**Setup (Task 0 only):** capture the baseline by running `npm run snapshot > /tmp/karabiner-before.json` once, on the commit immediately preceding any refactor work. After that, this file is the immutable reference.

**After every commit:** run

```bash
npm run snapshot > /tmp/karabiner-after.json
diff -u /tmp/karabiner-before.json /tmp/karabiner-after.json
```

Expected: empty diff (exit code 0). If the diff is non-empty, the step is wrong:
1. **Do not commit a fix forward** that "absorbs" the diff. The baseline is sacred.
2. Either correct the change to produce identical JSON, or `git reset --hard HEAD~1` and rethink the step.

### Commit hygiene

- One step group = one commit.
- Each commit message starts with a verb in imperative mood (e.g., `extract layer engines into layer-engines.ts`).
- Snapshot + diff before every commit. Don't commit if the diff fails.
- Co-author trailer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

### What "no behavior change" means here

- Karabiner-Elements consumes the JSON in profile order. The `manipulators` array order in each rule matters for runtime behavior (first match wins). A reordered manipulator may be functionally equivalent (different triggers don't conflict) but still fails the byte-equal gate. Treat all order changes as bugs.
- TypeScript-only changes (type aliases, generic constraints, removing `as any` casts) emit identical JS at runtime. They produce empty diffs.
- Deleting unused imports produces empty diffs.

### Branch and worktree

Work happens on the existing `refactor-and-cleanup` branch. The spec is already committed there. No worktree is needed — the changes are localized to three files plus `package.json`.

---

## File structure (target end state)

```
karabiner-config/
├── karabiner-config.ts    # entry: main(), rule_*, layer_*, app_*, keyboard_* functions
├── layer-engines.ts       # NEW: createLeaderLayer, createHyperLayer, shared internal helpers
├── utils.ts               # generic karabiner.ts helpers + appCommons/appResize
├── package.json           # adds "snapshot" npm script
└── docs/superpowers/
    ├── specs/2026-04-26-karabiner-refactor-cleanup-design.md
    └── plans/2026-04-26-karabiner-refactor-cleanup.md   # this file
```

**Responsibility split:**
- `utils.ts`: helpers reusable in any karabiner.ts project. No project-specific names or state.
- `layer-engines.ts`: this project's nested-layer abstraction (Leader and Hyper). Project-specific (variable names like `'leader'`, `'hyper'`, `'hyper_sub_*'`).
- `karabiner-config.ts`: declarations of what this keyboard does. Imports from both other files.

---

## Risk register

| Risk | Mitigation |
|------|------------|
| Helper produces different JSON than original code (e.g. `.to([a,b])` vs `.to(a).to(b)`) | After Task 4 (shared helpers), if diff fails, switch the helper to mirror the exact existing call shape per engine. The diff is the oracle. |
| Per-app table for Tasks 5a–5f doesn't match source order | Spec already verified row-by-row. Plan tasks include explicit "expected output order" comments. |
| Removing `as any` in `createHyperLayer` produces a TS error that requires structural change | Use `keyof HyperConfig` and `keyof HyperConfig[K]['mapping']` constraints. If TS still complains, fall back to keeping `as any` — these are emit-erased, no JSON impact. |
| `npm run snapshot` produces non-deterministic output across runs | Pre-flight check in Task 0: run snapshot twice, diff against itself. Must be empty before any source changes. |
| Changing `main()` signature breaks `npm run build` | Task 0 includes a manual smoke check: run `npm run build` and confirm "✓ Profile Default updated." appears. |

---

## Chunk 1: Verification scaffolding + Hyper engine extraction

Establishes the snapshot baseline, creates `layer-engines.ts` by moving `createHyperLayer` over, and folds the Hyper rule-wrapping inside the engine. After this chunk: `utils.ts` contains only generic helpers; `layer-engines.ts` exists; `main()` is one line shorter for Hyper.

### Task 0: Wire up snapshot dry-run for refactor verification

**Files:**
- Modify: `karabiner-config.ts:40-78` (the `main()` function and its single bottom-of-file invocation `main()`)
- Modify: `package.json:3-6` (the `scripts` block)

**Goal:** make `main()` parameterizable by an env var so we can run it in dry-run mode without disturbing the live Karabiner profile.

- [ ] **Step 0.1: Read the current `main()` and bottom-of-file invocation**

Open `karabiner-config.ts`. Confirm lines 40–78 contain `function main() { writeToProfile('Default', [...rules], { ...params }) }` and line 746 contains `main()`. The exact line numbers may shift; what matters is that there is exactly one `main()` definition and exactly one call site.

- [ ] **Step 0.2: Modify `main()` to accept a target argument**

Change the signature and the literal `'Default'` to use the parameter. The body (rules array, parameters block) is unchanged.

```ts
function main(target: string) {
  writeToProfile(
    target,
    [
      // ... existing rules array unchanged ...
    ],
    {
      'basic.simultaneous_threshold_milliseconds': 50,
      'duo_layer.threshold_milliseconds': 50,
      'duo_layer.notification': true,
    },
  )
}
```

- [ ] **Step 0.3: Replace the bare `main()` call with env-var-aware target selection**

At the bottom of `karabiner-config.ts` (currently `main()`), replace with:

```ts
main(process.env.KARABINER_DRY_RUN ? '--dry-run' : 'Default')
```

The string `'--dry-run'` is a special token recognized by `karabiner.ts`'s `writeToProfile` — it prints the computed JSON to stdout instead of writing the live config file.

- [ ] **Step 0.4: Add the `snapshot` script to `package.json`**

In `package.json`, the existing `scripts` block is:

```json
"scripts": {
  "build": "tsx karabiner-config.ts",
  "update": "npm update karabiner.ts"
}
```

Change it to:

```json
"scripts": {
  "build": "tsx karabiner-config.ts",
  "snapshot": "KARABINER_DRY_RUN=1 tsx karabiner-config.ts",
  "update": "npm update karabiner.ts"
}
```

- [ ] **Step 0.5: Determinism pre-flight — snapshot twice, compare to itself**

Run:

```bash
npm run snapshot > /tmp/karabiner-determinism-1.json
npm run snapshot > /tmp/karabiner-determinism-2.json
diff -u /tmp/karabiner-determinism-1.json /tmp/karabiner-determinism-2.json
```

Expected: empty diff. If non-empty, **stop**: the snapshot is non-deterministic and the refactor cannot be verified. Report the issue before continuing.

- [ ] **Step 0.6: Capture the baseline**

```bash
npm run snapshot > /tmp/karabiner-before.json
wc -l /tmp/karabiner-before.json
```

Note the line count for sanity checks later. Expected: a JSON file with thousands of lines (the whole profile).

- [ ] **Step 0.7: Smoke-check `npm run build`**

Run `npm run build`. Expected stdout: `✓ Profile Default updated.` This confirms the env-var-default branch (no `KARABINER_DRY_RUN`) still writes the live profile.

- [ ] **Step 0.8: Snapshot + diff after the source change**

```bash
npm run snapshot > /tmp/karabiner-after.json
diff -u /tmp/karabiner-before.json /tmp/karabiner-after.json
```

Expected: empty. Wait — the source did change. But the only changes were `main()`'s signature and call-site. Both branches of the env-var ternary produce the same `target` value when `KARABINER_DRY_RUN=1` (always `'--dry-run'`), and the rules+params are unchanged. So the JSON output for the snapshot run is identical to what `main()` always produced for `--dry-run`. The diff is empty against the baseline (which was captured *after* this change in Step 0.6, so trivially empty).

**Important**: the baseline in `/tmp/karabiner-before.json` was captured *after* the Task 0 source changes. That is intentional — Task 0 only adds verification machinery, not refactoring. From Task 1 onward, every diff is against this baseline.

- [ ] **Step 0.9: Commit**

```bash
git add karabiner-config.ts package.json
git commit -m "$(cat <<'EOF'
wire up snapshot dry-run for refactor verification

Adds KARABINER_DRY_RUN env-var-driven target selection in main() and an
`npm run snapshot` script. Live `npm run build` is unaffected (no env
var set → 'Default' profile target as before).

Captures the baseline JSON for byte-equal snapshot-diff verification at
every subsequent refactor commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 1: Extract `createHyperLayer` into `layer-engines.ts`

**Files:**
- Create: `layer-engines.ts` (new file at project root)
- Modify: `utils.ts:173-260` (remove `HyperSubLayer` type, `hyperSubVar` helper, `createHyperLayer` function)
- Modify: `karabiner-config.ts:26-38` (import `createHyperLayer` from `./layer-engines.ts` instead of `./utils.ts`)

**Goal:** move the Hyper engine to its dedicated module. Rename `HyperSubLayer` → `HyperConfig`'s entry type. Tighten the two `as any` casts.

- [ ] **Step 1.1: Create `layer-engines.ts` with the moved code**

Create `/Users/alvee/Developer/key-configs/karabiner-config/layer-engines.ts` with this content:

```ts
import {
  ifVar,
  layer,
  type ManipulatorBuilder,
  map,
  toKey,
  toRemoveNotificationMessage,
  toUnsetVar,
  withCondition,
} from 'karabiner.ts'

import type { ToEvent } from 'karabiner.ts'

/**
 * Sublayer entry inside a Hyper config: a name (shown in the top-level hint)
 * and a key→action mapping for the bindings active while this sublayer is held.
 */
type HyperSublayer = {
  name: string
  mapping: { [key: string]: ToEvent | ToEvent[] }
}

/** Map of sublayer-key → sublayer entry. */
export type HyperConfig = {
  [sublayerKey: string]: HyperSublayer
}

function hyperSubVar(key: string) {
  return `hyper_sub_${key}`
}

/**
 * Caps-Lock-held Hyper layer with nested sublayers, in mxstbr's hold-based style:
 * Caps + sublayer-key (held) + binding-letter (tapped) -> action.
 * Tap Caps alone -> Escape.
 *
 * Returns two outputs: the layer rule (which goes directly into writeToProfile),
 * and a list of manipulator builders for the sublayer logic (to be wrapped in a
 * separate rule by the caller).
 */
export function createHyperLayer<C extends HyperConfig>(sublayers: C) {
  let subKeys = Object.keys(sublayers) as Array<Extract<keyof C, string>>
  let topHint = subKeys.map((k) => `${k}_${sublayers[k].name}`).join(' ')

  let layerRule = layer('⇪', 'hyper')
    .configKey((m) => m.toIfAlone(toKey('⎋')))
    .notification(topHint)

  let manipulators: ManipulatorBuilder[] = []

  // Sublayer activation: requires hyper=1 AND all other hyper_sub_*=0.
  for (let k of subKeys) {
    let sub = sublayers[k]
    let subHint = Object.keys(sub.mapping).join(' ')
    let subVar = hyperSubVar(k)
    let otherSubVars = subKeys.filter((o) => o !== k).map(hyperSubVar)

    let activation = map(k)
      .toVar(subVar, 1)
      .toNotificationMessage(subVar, `${sub.name}: ${subHint}`)
      .toAfterKeyUp(toUnsetVar(subVar))
      .toAfterKeyUp(toRemoveNotificationMessage(subVar))
      .condition(ifVar('hyper', 1))
    for (let other of otherSubVars) {
      activation = activation.condition(ifVar(other, 0))
    }
    manipulators.push(activation)

    // Sublayer bindings: each mapped letter fires action while sub var = 1.
    let entries = Object.keys(sub.mapping) as Array<Extract<keyof typeof sub.mapping, string>>
    manipulators.push(
      ...withCondition(ifVar(subVar, 1))(
        entries.map((letter) =>
          map(letter).to(sub.mapping[letter]),
        ),
      ),
    )
  }

  // Manual escape: ⎋ or ⇪ while top-level hyper held but no sub active -> unset hyper.
  manipulators.push(
    ...withCondition(
      ifVar('hyper', 1),
      ...subKeys.map((k) => ifVar(hyperSubVar(k), 0)),
    )(
      (['⎋', '⇪'] as const).map((esc) =>
        map(esc).to(toUnsetVar('hyper')).to(toRemoveNotificationMessage('hyper')),
      ),
    ),
  )

  // Manual escape inside any sublayer: ⎋ or ⇪ -> unset that sub var.
  for (let k of subKeys) {
    let subVar = hyperSubVar(k)
    manipulators.push(
      ...withCondition(ifVar(subVar, 1))(
        (['⎋', '⇪'] as const).map((esc) =>
          map(esc).to(toUnsetVar(subVar)).to(toRemoveNotificationMessage(subVar)),
        ),
      ),
    )
  }

  return { layerRule, manipulators }
}
```

**Notes on the changes vs. the original `utils.ts` code:**
- `HyperSubLayer` is now a private (non-exported) type alias `HyperSublayer`. The exported type is `HyperConfig` (the keyed-by-sublayer record). Existing callers used `createHyperLayer({ o: {...}, w: {...} })` with an inline object literal — they don't reference `HyperSubLayer` by name, so renaming doesn't affect them.
- The two `(k as any)` and `(letter as any)` casts are gone. `subKeys` is typed as `Array<Extract<keyof C, string>>`, which `map(...)` accepts. `entries` is typed against the specific sublayer's mapping keys.
- If TypeScript complains about the `map(k)` or `map(letter)` calls (because `karabiner.ts`'s `map` accepts a constrained string union, not arbitrary strings), revert that specific cast back to `as any` — it's emit-erased, so the JSON output is unaffected. Note this in a code comment if so.

- [ ] **Step 1.2: Remove the moved code from `utils.ts`**

Delete lines 173–260 of `utils.ts` — the `HyperSubLayer` type, `hyperSubVar` function, and `createHyperLayer` function. Also remove now-unused imports from the import block at the top of `utils.ts`. After this step, `utils.ts` should:
- Still import: `ifVar`, `KeyAlias`, `layer`, `LetterKeyCode`, `ManipulatorBuilder`, `map`, `mapSimultaneous`, `ModifierKeyAlias`, `modifierKeyAliases`, `MultiModifierAlias`, `multiModifierAliases`, `SideModifierAlias`, `to$`, `ToEvent`, `toKey`, `toNotificationMessage`, `toRemoveNotificationMessage`, `toUnsetVar`, `withCondition`
- Audit each: which are still used after the deletion?
  - `historyNavi`/`tabNavi`/`switcher` use: `map`, `toKey` (via to argument)
  - `tapModifiers` uses: `SideModifierAlias`, `ToEvent`, `map`
  - `duoModifiers` uses: `KeyAlias`, `LetterKeyCode`, `ManipulatorBuilder`, `mapSimultaneous`, `ModifierKeyAlias`, `modifierKeyAliases`, `MultiModifierAlias`, `multiModifierAliases`, `toKey`, `toNotificationMessage`, `toRemoveNotificationMessage`
  - `raycastExt`/`raycastWin`/`toResizeWindow`/`toClearNotifications`/`toSystemSetting` use: `to$`
- No longer used: `ifVar`, `layer`, `toUnsetVar`, `withCondition` — remove these from the imports.

The final `utils.ts` import block should be:

```ts
import {
  type KeyAlias,
  type LetterKeyCode,
  type ManipulatorBuilder,
  map,
  mapSimultaneous,
  type ModifierKeyAlias,
  modifierKeyAliases,
  type MultiModifierAlias,
  multiModifierAliases,
  type SideModifierAlias,
  to$,
  type ToEvent,
  toKey,
  toNotificationMessage,
  toRemoveNotificationMessage,
} from 'karabiner.ts'
```

- [ ] **Step 1.3: Update `karabiner-config.ts` imports**

In `karabiner-config.ts:26-38`, the existing import block is:

```ts
import {
  createHyperLayer,
  duoModifiers,
  historyNavi,
  raycastExt,
  raycastWin,
  switcher,
  tabNavi,
  tapModifiers,
  toClearNotifications,
  toResizeWindow,
  toSystemSetting,
} from './utils.ts'
```

Split this into two imports — one from `./utils.ts` (everything except `createHyperLayer`) and one from `./layer-engines.ts` (just `createHyperLayer` for now):

```ts
import { createHyperLayer } from './layer-engines.ts'

import {
  duoModifiers,
  historyNavi,
  raycastExt,
  raycastWin,
  switcher,
  tabNavi,
  tapModifiers,
  toClearNotifications,
  toResizeWindow,
  toSystemSetting,
} from './utils.ts'
```

- [ ] **Step 1.4: Type-check**

Run:

```bash
npx tsc --noEmit
```

Expected: no errors. If TypeScript complains about `map(k)` or `map(letter)` in `layer-engines.ts`, see the note in Step 1.1 — revert those specific cases to `as any`.

- [ ] **Step 1.5: Snapshot + diff**

```bash
npm run snapshot > /tmp/karabiner-after.json
diff -u /tmp/karabiner-before.json /tmp/karabiner-after.json
```

Expected: empty diff. The change is a pure code move — runtime behavior of `createHyperLayer` is identical.

If the diff is non-empty, the most likely cause is a typo during the code move. Compare `layer-engines.ts` against the original `utils.ts:173-260` and reconcile.

- [ ] **Step 1.6: Commit**

```bash
git add karabiner-config.ts utils.ts layer-engines.ts
git commit -m "$(cat <<'EOF'
extract layer engines into layer-engines.ts

Moves createHyperLayer (and its private HyperSublayer type and
hyperSubVar helper) out of utils.ts into a new dedicated
layer-engines.ts module. Renames the exported config type from
HyperSubLayer to HyperConfig (keyed-by-sublayer record).

Tightens the two `as any` casts in the sublayer activation and binding
loops using `keyof` constraints. No JSON output change.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Fold Hyper rule wrapping into `createHyperLayer`

**Files:**
- Modify: `layer-engines.ts` (change `createHyperLayer` return shape from `{ layerRule, manipulators }` to `[layerRule, hyperRule]`)
- Modify: `karabiner-config.ts:230-322` (`rule_hyperLayer()` becomes a one-liner `...createHyperLayer({...})` spread directly into the rules array, OR the `rule_hyperLayer` wrapper is removed and the call moves inline into `main()`)

**Goal:** stop making the caller wrap `manipulators` in a separate `rule('Hyper Layer').manipulators(...)` — fold that into the engine.

- [ ] **Step 2.1: Add `rule` to the imports in `layer-engines.ts`**

The current `layer-engines.ts` imports don't include `rule`. Add it:

```ts
import {
  ifVar,
  layer,
  type ManipulatorBuilder,
  map,
  rule,
  toKey,
  toRemoveNotificationMessage,
  toUnsetVar,
  withCondition,
} from 'karabiner.ts'
```

- [ ] **Step 2.2: Change `createHyperLayer`'s return statement**

At the end of `createHyperLayer`, the current return is:

```ts
return { layerRule, manipulators }
```

Replace with:

```ts
return [layerRule, rule('Hyper Layer').manipulators(manipulators)] as const
```

The `as const` keeps the tuple typed as `readonly [LayerRule, RuleBuilder]` so the spread at the call site stays typed.

- [ ] **Step 2.3: Update the caller in `karabiner-config.ts`**

The existing `rule_hyperLayer()` function (around line 230) ends with:

```ts
  })
  return [layerRule, rule('Hyper Layer').manipulators(manipulators)]
}
```

Change the body so that the function just returns `createHyperLayer({...})` directly, and update the destructuring at the top — no longer needed:

```ts
function rule_hyperLayer() {
  return createHyperLayer({
    o: { /* ... existing Open mapping ... */ },
    w: { /* ... existing Window mapping ... */ },
    s: { /* ... existing System mapping ... */ },
    v: { /* ... existing Move mapping ... */ },
    c: { /* ... existing Music mapping ... */ },
    r: { /* ... existing Raycast mapping ... */ },
  })
}
```

The body of each sublayer (the `mapping` and `name` fields) is unchanged — only the wrapping plumbing changes.

The call site in `main()` was:

```ts
...rule_hyperLayer(),
```

This stays unchanged because `rule_hyperLayer()` still returns a 2-element rule tuple.

- [ ] **Step 2.4: Verify the destructuring isn't needed**

In the original `rule_hyperLayer`, the body destructured `{ layerRule, manipulators }` from the engine return. After Task 2, that destructuring goes away — there's no intermediate variables, just a direct return. Confirm by reading the new `rule_hyperLayer` and ensuring no `let { layerRule, manipulators } = ...` remains.

- [ ] **Step 2.5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2.6: Snapshot + diff**

```bash
npm run snapshot > /tmp/karabiner-after.json
diff -u /tmp/karabiner-before.json /tmp/karabiner-after.json
```

Expected: empty. The rule definition is constructed in the same order with the same arguments; the only change is *where* the `rule('Hyper Layer').manipulators(...)` wrap lives in source.

- [ ] **Step 2.7: Commit**

```bash
git add karabiner-config.ts layer-engines.ts
git commit -m "$(cat <<'EOF'
fold Hyper rule wrapping into createHyperLayer

Engine now returns [layerRule, hyperRule] as a tuple, eliminating the
caller-side `rule('Hyper Layer').manipulators(manipulators)` boilerplate.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 2: Leader engine extraction + shared helpers

Extracts `rule_leaderKey`'s body into `createLeaderLayer` in `layer-engines.ts`, then factors the formatting and escape-binding helpers shared between Leader and Hyper. After this chunk: both engines live in `layer-engines.ts`, share private helpers, and `karabiner-config.ts` shrinks by ~130 lines.

### Task 3: Extract `createLeaderLayer` engine

**Files:**
- Modify: `layer-engines.ts` (add `LeaderConfig` type, `createLeaderLayer` function, additional imports)
- Modify: `karabiner-config.ts:102-228` (replace `rule_leaderKey()` body with a `createLeaderLayer({...})` call; the wrapper function may go away or stay as a one-liner)

**Goal:** move the leader-key state machine into `layer-engines.ts`, parallel to `createHyperLayer`. The `LeaderConfig` shape matches the existing inline `mappings` object verbatim.

- [ ] **Step 3.1: Extend `layer-engines.ts` imports for Leader**

Leader uses imports that Hyper didn't need: `mapSimultaneous`, `withMapper`. Update the import block in `layer-engines.ts`:

```ts
import {
  ifVar,
  layer,
  type ManipulatorBuilder,
  map,
  mapSimultaneous,
  rule,
  type RuleBuilder,
  toKey,
  toRemoveNotificationMessage,
  toUnsetVar,
  withCondition,
  withMapper,
} from 'karabiner.ts'

import type { ToEvent } from 'karabiner.ts'
```

`RuleBuilder` may not be exported from `karabiner.ts`'s top-level — check `node_modules/karabiner.ts/dist/index.d.ts`. If unavailable, use inferred return type (`function createLeaderLayer(config: LeaderConfig)` without explicit return annotation).

- [ ] **Step 3.2: Add the `LeaderConfig` type**

In `layer-engines.ts`, after the `HyperConfig` type, add:

```ts
/**
 * Leader sublayer entry. Each value is either a string (used as both the action
 * argument and the hint label) or a string[] where [0] is the action argument
 * and [1] is the hint label. The array form is used by the Raycast and Link
 * sublayers; the array length is variable (links.json values may be longer).
 */
type LeaderSublayer = {
  name: string
  mapping: { [key: string]: string | string[] }
  action: (v: string) => ToEvent | ToEvent[]
}

/** Map of sublayer-key → sublayer entry. */
export type LeaderConfig = {
  [sublayerKey: string]: LeaderSublayer
}
```

This matches the original code's permissive `string | string[]` shape (see `karabiner-config.ts:185` pre-refactor). The runtime code reads only `[0]` and `[1]`, so variable-length arrays in `links.json` are tolerated.

- [ ] **Step 3.3: Add the `createLeaderLayer` function**

In `layer-engines.ts`, after `createHyperLayer`, add:

```ts
/**
 * `l;` simultaneous-tap leader layer with nested sublayers.
 * Tap l+; together → top hint shown. Tap a sublayer key (a/e/g/l/r/s) →
 * sublayer hint shown. Tap a binding letter → action fires AND auto-escapes
 * back to inactive. Tap ⎋/⇪ at any active state → escape to inactive.
 */
export function createLeaderLayer(config: LeaderConfig) {
  let _var = 'leader'
  let escape = [toUnsetVar(_var), toRemoveNotificationMessage(_var)]

  let keys = Object.keys(config) as Array<Extract<keyof LeaderConfig, string>>
  let topHint = keys.map((x) => `${x}_${config[x].name}`).join(' ')

  return rule('Leader Key').manipulators([
    // 0: Inactive -> Leader (1)
    withCondition(ifVar(_var, 0))([
      mapSimultaneous(['l', ';'], undefined, 250)
        .toVar(_var, 1)
        .toNotificationMessage(_var, topHint),
    ]),

    // 0.unless: Leader or NestedLeader -> Inactive (0)
    withCondition(ifVar(_var, 0).unless())([
      withMapper(['⎋', '⇪'])((x) => map(x).to(escape)),
    ]),

    // 1: Leader -> NestedLeader (🔤)
    withCondition(ifVar(_var, 1))(
      keys.map((k) => {
        let subHint = Object.entries(config[k].mapping)
          .map(([k, v]) => `${k}_${Array.isArray(v) ? v[1] : v}`)
          .join(' ')
        return map(k).toVar(_var, k).toNotificationMessage(_var, subHint)
      }),
    ),

    // 🔤: NestedLeader actions
    ...keys.map((nestedLeaderKey) => {
      let { mapping, action } = config[nestedLeaderKey]
      let actionKeys = Object.keys(mapping)
      return withCondition(ifVar(_var, nestedLeaderKey))(
        actionKeys.map((x) => {
          let raw = mapping[x]
          let v = Array.isArray(raw) ? raw[0] : raw
          return map(x).to(action(v)).to(escape)
        }),
      )
    }),
  ])
}
```

This is a near-verbatim move of `rule_leaderKey()`'s body, with the inline `mappings` object replaced by the `config` parameter and the type erased from `as Array<keyof typeof mappings>` to `as Array<Extract<keyof LeaderConfig, string>>`.

- [ ] **Step 3.4: Replace `rule_leaderKey()` in `karabiner-config.ts`**

Delete the entire body of `rule_leaderKey()` (lines 102–228). Replace it with:

```ts
function rule_leaderKey() {
  return createLeaderLayer({
    a: {
      name: 'App',
      mapping: {
        a: 'ChatGPT', // AI
        c: 'Calendar',
        d: 'Eudb_en', // Dictionary
        e: 'Zed', // Editor
        f: 'Finder',
        g: 'Google Chrome',
        i: 'WeChat', // IM
        m: 'Spark Desktop', // Mail
        r: 'Rider',
        s: 'Slack',
        t: 'Warp', // Terminal
        u: 'Spotify', // mUsic
        w: 'WebStorm',
        z: 'zoom.us',
        ';': 'System Settings',
      },
      action: toApp,
    },
    e: {
      name: 'Emoji',
      mapping: {
        c: '📅', // Calendar
        h: '💯', // Hundred
        j: '😂', // Joy
        p: '👍', // Plus_one +1
        s: '😅', // Sweat_smile
        t: '🧵', // Thread
      },
      action: toPaste,
    },
    g: {
      name: 'Gitmoji', // See https://gitmoji.dev/
      mapping: {
        b: '🐛', // fix a Bug
        d: '📝', // add or update Documentation
        f: '🚩', // add, update, or remove Feature Flags
        m: '🔀', // Merge branches
        n: '✨', // introduce New features
        r: '♻️', // Refactor code
        u: '💄', // UI/Style
        v: '🔖', // release / Version tags
        x: '🔥', // remove code or files
      },
      action: toPaste,
    },
    l: {
      name: 'Link',
      mapping: require('./links.json') as { [key: string]: string[] },
      action: (x) => to$(`open ${x}`),
    },
    r: {
      name: 'Raycast',
      mapping: {
        c: ['raycast/calendar/my-schedule', 'Calendar'],
        d: ['raycast/dictionary/define-word', 'Dictionary'],
        e: ['raycast/emoji-symbols/search-emoji-symbols', 'Emoji'],
        g: ['ricoberger/gitmoji/gitmoji', 'Gitmoji'],
        s: ['raycast/snippets/search-snippets', 'Snippets'],
        v: ['raycast/clipboard-history/clipboard-history', 'Clipboard'],
      },
      action: raycastExt,
    },
    s: {
      name: 'SystemSetting',
      mapping: {
        a: 'Appearance',
        d: 'Displays',
        k: 'Keyboard',
        o: 'Dock',
      },
      action: toSystemSetting,
    },
  })
}
```

The mapping/name/action data is identical to the old inline definitions. The `satisfies` clause that constrained the inline `mappings` is no longer needed because `LeaderConfig` (the parameter type) constrains it.

**Note about `mapping: require('./links.json')`**: this works under `tsx` with TS interop. The cast `as { [key: string]: string[] }` fits `LeaderConfig`'s `string | string[]` value type directly. No change vs. the original code.

- [ ] **Step 3.5: Update imports in `karabiner-config.ts`**

The new `rule_leaderKey()` body uses `createLeaderLayer` (from `./layer-engines.ts`). Add it to the existing import line:

```ts
import { createHyperLayer, createLeaderLayer } from './layer-engines.ts'
```

The old `rule_leaderKey` body imported `mapSimultaneous`, `toUnsetVar`, `withCondition`, `withMapper`, `ifVar` from `karabiner.ts` directly. These are still imported at the top of `karabiner-config.ts` because other rule definitions use them — verify by re-reading the imports and confirming each one has a remaining caller. If any are now unused, delete them. (Quick check: `mapSimultaneous` is also used by `app_homerow`; `withCondition` by `layer_snippet`; `ifVar` is unused after this; `toUnsetVar` is unused after this; `withMapper` is used by several layers; `withModifier` is used.) Remove `ifVar` and `toUnsetVar` from `karabiner-config.ts`'s imports if Step 3.4 removed their last callers. Re-verify with a search.

- [ ] **Step 3.6: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. The `LeaderConfig` type from Step 3.2 already uses `string | string[]`, which accommodates the variable-length values in `links.json`.

- [ ] **Step 3.7: Snapshot + diff**

```bash
npm run snapshot > /tmp/karabiner-after.json
diff -u /tmp/karabiner-before.json /tmp/karabiner-after.json
```

Expected: empty. The leader engine's runtime behavior is unchanged.

- [ ] **Step 3.8: Commit**

```bash
git add karabiner-config.ts layer-engines.ts
git commit -m "$(cat <<'EOF'
extract createLeaderLayer engine

Moves the leader-key state machine out of karabiner-config.ts into
layer-engines.ts as createLeaderLayer(config: LeaderConfig). The
rule_leaderKey() wrapper now just calls the engine with the existing
mappings inline.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Factor shared helpers in `layer-engines.ts`

**Files:**
- Modify: `layer-engines.ts` (add three private helpers; have both engines call them)

**Goal:** the two engines compute hint strings and bind ⎋/⇪ escapes in similar ways. Extract `formatTopHint`, `formatSubHint`, and `escapeBindings` as private helpers.

**Caution:** this is the highest-risk task for snapshot diff failures. The helpers must produce JSON identical to the inline code they replace. If `escapeBindings` uses `.to([a, b])` (single array call) but the original code chained `.to(a).to(b)`, the JSON may differ. The diff is the oracle — if it fails, switch the helper to whichever shape matches.

- [ ] **Step 4.1: Add `ConditionBuilder` to imports**

`escapeBindings` accepts conditions. Add the type:

```ts
import {
  type ConditionBuilder,
  ifVar,
  // ... rest unchanged ...
} from 'karabiner.ts'
```

- [ ] **Step 4.2: Add the three private helpers**

Insert these three functions in `layer-engines.ts` — anywhere above the engine functions that use them, but typically right after the imports/type-aliases block:

```ts
/** "a_App e_Emoji g_Gitmoji ..." style hint, used at top level by both engines. */
function formatTopHint(entries: Array<{ key: string; name: string }>): string {
  return entries.map(({ key, name }) => `${key}_${name}`).join(' ')
}

/**
 * "key_label key_label ..." sublayer hint.
 * Leader: label = mapping value (or tuple[1] if value is an array).
 * Hyper: label = empty string (just the keys).
 */
function formatSubHint<V>(
  mapping: Record<string, V>,
  label: (v: V) => string,
): string {
  return Object.entries(mapping)
    .map(([k, v]) => {
      let l = label(v as V)
      return l ? `${k}_${l}` : k
    })
    .join(' ')
}

/**
 * Builds [⎋, ⇪] -> [unset vars, remove notifications] manipulators under a condition.
 * `vars` is the list of variables to unset on each escape press; both ⎋ and ⇪
 * unset all of them. Returns the manipulators as a flat array (already wrapped
 * in withCondition).
 */
function escapeBindings(
  conditions: ConditionBuilder | ConditionBuilder[],
  vars: string[],
): ManipulatorBuilder[] {
  let conds = Array.isArray(conditions) ? conditions : [conditions]
  let toEvents = vars.flatMap((v) => [toUnsetVar(v), toRemoveNotificationMessage(v)])
  return withCondition(...conds)(
    (['⎋', '⇪'] as const).map((esc) => map(esc).to(toEvents)),
  )
}
```

- [ ] **Step 4.3: Refactor `createHyperLayer` to use the helpers**

In `createHyperLayer`, replace:

```ts
let topHint = subKeys.map((k) => `${k}_${sublayers[k].name}`).join(' ')
```

with:

```ts
let topHint = formatTopHint(subKeys.map((k) => ({ key: k, name: sublayers[k].name })))
```

Replace the per-sublayer hint computation:

```ts
let subHint = Object.keys(sub.mapping).join(' ')
```

with (the empty-label closure makes formatSubHint emit just keys):

```ts
let subHint = formatSubHint(sub.mapping, () => '')
```

Replace the top-level escape block:

```ts
manipulators.push(
  ...withCondition(
    ifVar('hyper', 1),
    ...subKeys.map((k) => ifVar(hyperSubVar(k), 0)),
  )(
    (['⎋', '⇪'] as const).map((esc) =>
      map(esc).to(toUnsetVar('hyper')).to(toRemoveNotificationMessage('hyper')),
    ),
  ),
)
```

with:

```ts
manipulators.push(
  ...escapeBindings(
    [ifVar('hyper', 1), ...subKeys.map((k) => ifVar(hyperSubVar(k), 0))],
    ['hyper'],
  ),
)
```

Replace the per-sublayer escape block (inside the `for (let k of subKeys)` loop at the bottom):

```ts
manipulators.push(
  ...withCondition(ifVar(subVar, 1))(
    (['⎋', '⇪'] as const).map((esc) =>
      map(esc).to(toUnsetVar(subVar)).to(toRemoveNotificationMessage(subVar)),
    ),
  ),
)
```

with:

```ts
manipulators.push(...escapeBindings(ifVar(subVar, 1), [subVar]))
```

- [ ] **Step 4.4: Refactor `createLeaderLayer` to use the helpers**

In `createLeaderLayer`, replace:

```ts
let topHint = keys.map((x) => `${x}_${config[x].name}`).join(' ')
```

with:

```ts
let topHint = formatTopHint(keys.map((k) => ({ key: k, name: config[k].name })))
```

The per-sublayer hint inside the `keys.map((k) => { ... })` block:

```ts
let subHint = Object.entries(config[k].mapping)
  .map(([k, v]) => `${k}_${Array.isArray(v) ? v[1] : v}`)
  .join(' ')
```

becomes:

```ts
let subHint = formatSubHint(config[k].mapping, (v) => Array.isArray(v) ? v[1] : v)
```

The leader's escape uses a manual array `escape = [toUnsetVar(_var), toRemoveNotificationMessage(_var)]` referenced in two places: (a) the `withCondition(ifVar(_var, 0).unless())` block at the top, and (b) the trailing `.to(escape)` after each nested-leader action.

For (a) — replace:

```ts
withCondition(ifVar(_var, 0).unless())([
  withMapper(['⎋', '⇪'])((x) => map(x).to(escape)),
]),
```

with:

```ts
...escapeBindings(ifVar(_var, 0).unless(), [_var]),
```

Note: the original used `withMapper` to iterate. `escapeBindings` does the same iteration internally, so the behavior is identical — but the JSON output may differ if `withMapper` and a manual `(['⎋','⇪'] as const).map((esc) => map(esc).to(...))` produce different intermediate structures. **Snapshot diff in step 4.6 will confirm.** If diff fails here, revert this specific block to the original `withMapper` form and don't include this case in the helper.

For (b) — leave it inline. The `.to(escape)` calls inside the nested-leader actions are not escape bindings; they are tail-actions that fire alongside the user's chosen action to reset state. The helper covers escape *triggers* (⎋/⇪), not action *trailers*. Keep `let escape = [toUnsetVar(_var), toRemoveNotificationMessage(_var)]` as a local variable and the `.to(escape)` references unchanged.

- [ ] **Step 4.5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. The helpers' generic types should infer correctly at each call site.

- [ ] **Step 4.6: Snapshot + diff**

```bash
npm run snapshot > /tmp/karabiner-after.json
diff -u /tmp/karabiner-before.json /tmp/karabiner-after.json
```

Expected: empty. **Most likely failure points and remediation:**

1. **Hyper escape: `.to([a, b])` vs `.to(a).to(b)`** — original code chains `.to(toUnsetVar('hyper')).to(toRemoveNotificationMessage('hyper'))`. Helper does `.to([toUnsetVar('hyper'), toRemoveNotificationMessage('hyper')])`. If the JSON differs, change `escapeBindings` to chain instead:

   ```ts
   return withCondition(...conds)(
     (['⎋', '⇪'] as const).map((esc) => {
       let m = map(esc)
       for (let v of vars) {
         m = m.to(toUnsetVar(v)).to(toRemoveNotificationMessage(v))
       }
       return m
     }),
   )
   ```

2. **Leader escape: `withMapper` vs manual `.map`** — original used `withMapper(['⎋', '⇪'])((x) => map(x).to(escape))`. Helper uses `(['⎋','⇪'] as const).map((esc) => map(esc).to(toEvents))`. If the JSON differs, revert step 4.4(a) — don't apply the helper to the leader's `unless()` block; keep the original `withMapper` form. This is acceptable because the helper still works for the per-sublayer Hyper case and the per-key Hyper top-level case.

If both diff issues occur, address them independently and re-snapshot after each fix.

- [ ] **Step 4.7: Commit**

Once the diff is empty:

```bash
git add layer-engines.ts
git commit -m "$(cat <<'EOF'
share hint and escape helpers between layer engines

Extracts formatTopHint, formatSubHint, and escapeBindings as private
helpers in layer-engines.ts. Both createLeaderLayer and createHyperLayer
call them.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 3: App rule migrations to `appCommons` / `appResize`

Six commits, one per group, each migrating 1–3 `app_*` functions to use the new `appCommons` and `appResize` helpers. Each commit is gated on an empty snapshot diff. The first sub-step (5a) introduces the helpers in `utils.ts` together with their first callers — no dead-code commit.

### Task 5a: Add `appCommons`/`appResize` and migrate Chrome, Safari, Zoom

**Files:**
- Modify: `utils.ts` (add `appCommons` and `appResize` exports; update imports)
- Modify: `karabiner-config.ts` (`app_chrome`, `app_safari`, `app_zoom` rewritten; update imports)

**Goal:** introduce the helpers and migrate the three simplest apps (canonical order, Zoom has only taps).

- [ ] **Step 5a.1: Update `utils.ts` imports**

`appCommons` calls `historyNavi`, `tabNavi`, `switcher`, `tapModifiers` — all already in `utils.ts`. `appResize` calls `map`, `toResizeWindow` — `toResizeWindow` is already in `utils.ts`; `map` is already imported.

The `1` Meh trigger in `appResize` uses a numeric key. The current import block at the top of `utils.ts` (after Task 1) has `map` already. No new imports needed for `appResize`.

For `appCommons`, the `Parameters<typeof tapModifiers>[0]` type is computed locally — no new import.

- [ ] **Step 5a.2: Add `appResize` to `utils.ts`**

After `toResizeWindow` (around the existing line ~138), add:

```ts
/**
 * Convenience: builds the standard `1 + Meh -> resize current window` manipulator.
 * Used by appCommons callers to drop a resize into prependExtras/appendExtras
 * without restating the trigger or toResizeWindow plumbing.
 */
export function appResize(
  app: string,
  position?: { x: number; y: number },
  size?: { w: number; h: number },
): ManipulatorBuilder {
  return map(1, 'Meh').to(toResizeWindow(app, position, size))
}
```

- [ ] **Step 5a.3: Add `appCommons` to `utils.ts`**

Add the helper (typically near the bottom of the helpers section, after `appResize`):

```ts
type AppCommonsOptions = {
  history?: boolean
  tab?: boolean
  switcher?: boolean
  prependExtras?: ManipulatorBuilder[]
  taps?: Parameters<typeof tapModifiers>[0]
  appendExtras?: ManipulatorBuilder[]
}

/**
 * Common app-rule scaffold. Composes nav helpers (history/tab/switcher),
 * caller-supplied prependExtras, tapModifiers, and appendExtras in fixed
 * canonical order:
 *
 *   history → tab → switcher → prependExtras → taps → appendExtras
 *
 * Each block is omitted if the corresponding option is undefined/false.
 * Returns a ManipulatorBuilder[] suitable for spreading into `.manipulators([...])`
 * or passing directly as `.manipulators(...)`.
 */
export function appCommons(opts: AppCommonsOptions): ManipulatorBuilder[] {
  return [
    ...(opts.history ? historyNavi() : []),
    ...(opts.tab ? tabNavi() : []),
    ...(opts.switcher ? switcher() : []),
    ...(opts.prependExtras ?? []),
    ...(opts.taps ? tapModifiers(opts.taps) : []),
    ...(opts.appendExtras ?? []),
  ]
}
```

- [ ] **Step 5a.4: Rewrite `app_chrome` in `karabiner-config.ts`**

Original (lines 505–520):

```ts
function app_chrome() {
  return rule('Chrome', ifApp('^com.google.Chrome$')).manipulators([
    ...historyNavi(),
    ...tabNavi(),
    ...switcher(),

    ...tapModifiers({
      '‹⌥': toKey('r', '⌘'), // refreshThePage

      '›⌘': toKey('i', '⌘⌥'), // developerTools
      '›⌥': toKey('a', '⌘⇧'), // searchTabs
    }),

    map(1, 'Meh').to(toResizeWindow('Google Chrome')),
  ])
}
```

Replace with:

```ts
function app_chrome() {
  return rule('Chrome', ifApp('^com.google.Chrome$')).manipulators(
    appCommons({
      history: true,
      tab: true,
      switcher: true,
      taps: {
        '‹⌥': toKey('r', '⌘'), // refreshThePage

        '›⌘': toKey('i', '⌘⌥'), // developerTools
        '›⌥': toKey('a', '⌘⇧'), // searchTabs
      },
      appendExtras: [appResize('Google Chrome')],
    }),
  )
}
```

Expected emitted-order: historyNavi, tabNavi, switcher, taps, resize. Identical to original.

- [ ] **Step 5a.5: Rewrite `app_safari`**

Original (lines 522–537):

```ts
function app_safari() {
  return rule('Safari', ifApp('^com.apple.Safari$')).manipulators([
    ...historyNavi(),
    ...tabNavi(),
    ...switcher(),

    ...tapModifiers({
      '‹⌘': toKey('l', '⌘⇧'), // showHideSideBar
      '‹⌥': toKey('r', '⌘'), // reloadPage

      '›⌘': toKey('i', '⌘⌥'), // showWebInspector
    }),

    map(1, 'Meh').to(toResizeWindow('Safari')),
  ])
}
```

Replace with:

```ts
function app_safari() {
  return rule('Safari', ifApp('^com.apple.Safari$')).manipulators(
    appCommons({
      history: true,
      tab: true,
      switcher: true,
      taps: {
        '‹⌘': toKey('l', '⌘⇧'), // showHideSideBar
        '‹⌥': toKey('r', '⌘'), // reloadPage

        '›⌘': toKey('i', '⌘⌥'), // showWebInspector
      },
      appendExtras: [appResize('Safari')],
    }),
  )
}
```

- [ ] **Step 5a.6: Rewrite `app_zoom`**

Original (lines 663–673):

```ts
function app_zoom() {
  return rule('Zoom', ifApp('^us.zoom.xos$')).manipulators(
    tapModifiers({
      '‹⌘': toKey('a', '⌘⇧'), // muteUnmuteMyAudio
      '‹⌥': toKey('s', '⌘⇧'), // startStopScreenSharing

      '›⌘': toKey('v', '⌘⇧'), // startStopVideo
      '›⌥': toKey('h', '⌘⇧'), // showHideChatPanel
    }),
  )
}
```

Replace with:

```ts
function app_zoom() {
  return rule('Zoom', ifApp('^us.zoom.xos$')).manipulators(
    appCommons({
      taps: {
        '‹⌘': toKey('a', '⌘⇧'), // muteUnmuteMyAudio
        '‹⌥': toKey('s', '⌘⇧'), // startStopScreenSharing

        '›⌘': toKey('v', '⌘⇧'), // startStopVideo
        '›⌥': toKey('h', '⌘⇧'), // showHideChatPanel
      },
    }),
  )
}
```

Expected emitted-order: just the 4 tapModifiers. Identical to original.

- [ ] **Step 5a.7: Update imports in `karabiner-config.ts`**

Add `appCommons` and `appResize` to the existing `./utils.ts` import:

```ts
import {
  appCommons,
  appResize,
  duoModifiers,
  historyNavi,
  raycastExt,
  raycastWin,
  switcher,
  tabNavi,
  tapModifiers,
  toClearNotifications,
  toResizeWindow,
  toSystemSetting,
} from './utils.ts'
```

`historyNavi`, `tabNavi`, `switcher`, `tapModifiers`, `toResizeWindow` are still imported because the not-yet-migrated apps still use them directly. They'll be removed in Task 6 once all apps are migrated.

- [ ] **Step 5a.8: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5a.9: Snapshot + diff**

```bash
npm run snapshot > /tmp/karabiner-after.json
diff -u /tmp/karabiner-before.json /tmp/karabiner-after.json
```

Expected: empty.

- [ ] **Step 5a.10: Commit**

```bash
git add karabiner-config.ts utils.ts
git commit -m "$(cat <<'EOF'
add appCommons helper and migrate chrome/safari/zoom

Introduces appCommons (canonical-order app rule scaffold) and appResize
(convenience for the standard `1+Meh -> resize` manipulator) in utils.ts,
then migrates the three simplest apps (canonical pattern, Zoom has
taps-only).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5b: Migrate JetBrains and Zed

**Files:**
- Modify: `karabiner-config.ts` (`app_jetBrainsIDE`, `app_zed`)

**Goal:** these have an extra `map('⎋', '⌘').to('⎋', '⌘⇧')` manipulator that lives **between** taps and resize. With the no-fixed-resize-slot helper, both go into `appendExtras` in source order.

- [ ] **Step 5b.1: Rewrite `app_jetBrainsIDE`**

Original (lines 539–558):

```ts
function app_jetBrainsIDE() {
  return rule('JetBrains IDE', ifApp('^com.jetbrains.[\\w-]+$')).manipulators([
    ...historyNavi(),
    ...tabNavi(),
    ...switcher(),

    ...tapModifiers({
      '‹⌘': toKey('⎋', '⌘⇧'), // hideAllToolWindows
      '‹⌥': toKey('r', '⌥⇧'), // Run
      '‹⌃': toKey('r', '⌥⌃'), // Run...

      '›⌘': toKey(4, '⌥'), // toolWindows_terminal
      '›⌥': toKey('a', '⌘⇧'), // findAction
      '›⌃': toKey('e', '⌘'), // recentFiles
    }),

    map('⎋', '⌘').to('⎋', '⌘⇧'),
    map(1, 'Meh').to(toResizeWindow('WebStorm')),
  ])
}
```

Replace with:

```ts
function app_jetBrainsIDE() {
  return rule('JetBrains IDE', ifApp('^com.jetbrains.[\\w-]+$')).manipulators(
    appCommons({
      history: true,
      tab: true,
      switcher: true,
      taps: {
        '‹⌘': toKey('⎋', '⌘⇧'), // hideAllToolWindows
        '‹⌥': toKey('r', '⌥⇧'), // Run
        '‹⌃': toKey('r', '⌥⌃'), // Run...

        '›⌘': toKey(4, '⌥'), // toolWindows_terminal
        '›⌥': toKey('a', '⌘⇧'), // findAction
        '›⌃': toKey('e', '⌘'), // recentFiles
      },
      appendExtras: [
        map('⎋', '⌘').to('⎋', '⌘⇧'),
        appResize('WebStorm'),
      ],
    }),
  )
}
```

Expected emitted-order: historyNavi, tabNavi, switcher, taps, ⎋⌘ remap, resize. Identical to original.

- [ ] **Step 5b.2: Rewrite `app_zed`**

Original (lines 560–579) — same pattern as JetBrains:

```ts
function app_zed() {
  return rule('Zed', ifApp('^dev.zed.Zed$')).manipulators(
    appCommons({
      history: true,
      tab: true,
      switcher: true,
      taps: {
        '‹⌘': toKey('⎋', '⌘⇧'), // closeAllDocks
        '‹⌥': toKey('t', '⌥'), // task::Rerun
        '‹⌃': toKey('t', '⌥⇧'), // task::Spawn

        '›⌘': toKey('`', '⌃'), // terminal
        '›⌥': toKey('a', '⌘⇧'), // command
        '›⌃': toKey('p', '⌘'), // fileFinder
      },
      appendExtras: [
        map('⎋', '⌘').to('⎋', '⌘⇧'),
        appResize('Zed'),
      ],
    }),
  )
}
```

- [ ] **Step 5b.3: Type-check, snapshot, diff, commit**

```bash
npx tsc --noEmit
npm run snapshot > /tmp/karabiner-after.json
diff -u /tmp/karabiner-before.json /tmp/karabiner-after.json
git add karabiner-config.ts
git commit -m "$(cat <<'EOF'
migrate jetbrains/zed to appCommons

Both apps have the escape-remap (⎋⌘ -> ⎋⌘⇧) before resize. With no
fixed `resize` slot in appCommons, both manipulators go into
appendExtras in source order.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected diff: empty.

---

### Task 5c: Migrate VSCode and Cursor

**Files:**
- Modify: `karabiner-config.ts` (`app_vsCode`, `app_cursor`)

**Goal:** these have h/l Ctrl-remap manipulators between switcher and taps. They go into `prependExtras`.

- [ ] **Step 5c.1: Rewrite `app_vsCode`**

Original (lines 581–599):

```ts
function app_vsCode() {
  return rule('VSCode', ifApp('^com.microsoft.VSCode$')).manipulators([
    ...tabNavi(),
    ...switcher(),
    map('h', '⌃').to('-', '⌃'),
    map('l', '⌃').to('-', '⌃⇧'),

    ...tapModifiers({
      '‹⌘': toKey('⎋', '⌘'), // Tobble Sidebar visibility
      '‹⌥': toKey('r', '⌥⇧'), // Run

      '›⌘': toKey('`', '⌃'), // terminal
      '›⌥': toKey('p', '⌘⇧'), // Show Command Palette
      '›⌃': toKey('p', '⌘'), // Quick Open, Go to File...
    }),

    map(1, 'Meh').to(toResizeWindow('Code')),
  ])
}
```

Replace with:

```ts
function app_vsCode() {
  return rule('VSCode', ifApp('^com.microsoft.VSCode$')).manipulators(
    appCommons({
      tab: true,
      switcher: true,
      prependExtras: [
        map('h', '⌃').to('-', '⌃'),
        map('l', '⌃').to('-', '⌃⇧'),
      ],
      taps: {
        '‹⌘': toKey('⎋', '⌘'), // Tobble Sidebar visibility
        '‹⌥': toKey('r', '⌥⇧'), // Run

        '›⌘': toKey('`', '⌃'), // terminal
        '›⌥': toKey('p', '⌘⇧'), // Show Command Palette
        '›⌃': toKey('p', '⌘'), // Quick Open, Go to File...
      },
      appendExtras: [appResize('Code')],
    }),
  )
}
```

Expected emitted-order: tabNavi, switcher, h-remap, l-remap, taps, resize. Identical to original.

- [ ] **Step 5c.2: Rewrite `app_cursor`**

Original (lines 601–617) — same as VSCode but no resize:

```ts
function app_cursor() {
  return rule('Cursor', ifApp('^com.todesktop.230313mzl4w4u92$')).manipulators(
    appCommons({
      tab: true,
      switcher: true,
      prependExtras: [
        map('h', '⌃').to('-', '⌃'),
        map('l', '⌃').to('-', '⌃⇧'),
      ],
      taps: {
        '‹⌘': toKey('⎋', '⌘'), // Tobble Sidebar visibility
        '‹⌥': toKey('r', '⌥⇧'), // Run

        '›⌘': toKey('`', '⌃'), // terminal
        '›⌥': toKey('p', '⌘⇧'), // Show Command Palette
        '›⌃': toKey('p', '⌘'), // Quick Open, Go to File...
      },
    }),
  )
}
```

- [ ] **Step 5c.3: Type-check, snapshot, diff, commit**

```bash
npx tsc --noEmit
npm run snapshot > /tmp/karabiner-after.json
diff -u /tmp/karabiner-before.json /tmp/karabiner-after.json
git add karabiner-config.ts
git commit -m "$(cat <<'EOF'
migrate vscode/cursor to appCommons

Both apps have h/l Ctrl-remap manipulators between switcher and taps;
both go into prependExtras.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5d: Migrate Warp

**Files:**
- Modify: `karabiner-config.ts` (`app_warp`)

**Goal:** Warp has tab nav, then resize, then a ⏎-remap. No taps. Resize and the ⏎-remap both go in `appendExtras` in source order.

- [ ] **Step 5d.1: Rewrite `app_warp`**

Original (lines 619–625):

```ts
function app_warp() {
  return rule('Warp', ifApp('^dev.warp.Warp')).manipulators([
    ...tabNavi(),
    map(1, 'Meh').to(toResizeWindow('Warp')),
    map('⏎', '⇧').to('j', '⌃'),
  ])
}
```

Replace with:

```ts
function app_warp() {
  return rule('Warp', ifApp('^dev.warp.Warp')).manipulators(
    appCommons({
      tab: true,
      appendExtras: [
        appResize('Warp'),
        map('⏎', '⇧').to('j', '⌃'),
      ],
    }),
  )
}
```

Expected emitted-order: tabNavi, resize, ⏎-remap. Identical to original.

- [ ] **Step 5d.2: Type-check, snapshot, diff, commit**

```bash
npx tsc --noEmit
npm run snapshot > /tmp/karabiner-after.json
diff -u /tmp/karabiner-before.json /tmp/karabiner-after.json
git add karabiner-config.ts
git commit -m "$(cat <<'EOF'
migrate warp to appCommons

Warp has no taps; resize and ⏎⇧ remap both go into appendExtras in
source order.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5e: Migrate Slack and Spark

**Files:**
- Modify: `karabiner-config.ts` (`app_slack`, `app_spark`)

**Goal:** both use custom `position`/`size` arguments to `toResizeWindow`. The new `appResize(app, position?, size?)` signature accepts the same two optional args.

- [ ] **Step 5e.1: Rewrite `app_slack`**

Original (lines 627–645):

```ts
function app_slack() {
  return rule('Slack', ifApp('^com.tinyspeck.slackmacgap$')).manipulators([
    ...historyNavi(),

    ...tapModifiers({
      '‹⌘': toKey('d', '⌘⇧'), // showHideSideBar
      '‹⌥': toKey('f6'), // moveFocusToTheNextSection

      '›⌘': toKey('.', '⌘'), // hideRightBar
      '›⌥': toKey('k', '⌘'), // open
    }),

    map(1, 'Meh').to(
      // After the 1/4 width, leave some space for opening thread in a new window
      // before the last 1/4 width
      toResizeWindow('Slack', { x: 1263, y: 25 }, { w: 1760, h: 1415 }),
    ),
  ])
}
```

Replace with:

```ts
function app_slack() {
  return rule('Slack', ifApp('^com.tinyspeck.slackmacgap$')).manipulators(
    appCommons({
      history: true,
      taps: {
        '‹⌘': toKey('d', '⌘⇧'), // showHideSideBar
        '‹⌥': toKey('f6'), // moveFocusToTheNextSection

        '›⌘': toKey('.', '⌘'), // hideRightBar
        '›⌥': toKey('k', '⌘'), // open
      },
      // After the 1/4 width, leave some space for opening thread in a new
      // window before the last 1/4 width
      appendExtras: [appResize('Slack', { x: 1263, y: 25 }, { w: 1760, h: 1415 })],
    }),
  )
}
```

Expected emitted-order: historyNavi, taps, custom resize. Identical to original.

- [ ] **Step 5e.2: Rewrite `app_spark`**

Original (lines 647–661):

```ts
function app_spark() {
  return rule('Spark', ifApp('^com.readdle.SparkDesktop')).manipulators([
    ...tapModifiers({
      '‹⌘': toKey('/'), // openSidebar
      '‹⌥': toKey('r', '⌘'), // fetch

      '›⌘': toKey('/', '⌘'), // changeLayout
      '›⌥': toKey('k', '⌘'), // actions
    }),

    map(1, 'Meh').to(
      toResizeWindow('Spark Desktop', undefined, { w: 1644, h: 1220 }),
    ),
  ])
}
```

Replace with:

```ts
function app_spark() {
  return rule('Spark', ifApp('^com.readdle.SparkDesktop')).manipulators(
    appCommons({
      taps: {
        '‹⌘': toKey('/'), // openSidebar
        '‹⌥': toKey('r', '⌘'), // fetch

        '›⌘': toKey('/', '⌘'), // changeLayout
        '›⌥': toKey('k', '⌘'), // actions
      },
      appendExtras: [appResize('Spark Desktop', undefined, { w: 1644, h: 1220 })],
    }),
  )
}
```

- [ ] **Step 5e.3: Type-check, snapshot, diff, commit**

```bash
npx tsc --noEmit
npm run snapshot > /tmp/karabiner-after.json
diff -u /tmp/karabiner-before.json /tmp/karabiner-after.json
git add karabiner-config.ts
git commit -m "$(cat <<'EOF'
migrate slack/spark to appCommons

Both use appResize with custom position/size arguments preserving the
existing toResizeWindow calls.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5f: Migrate ChatGPT

**Files:**
- Modify: `karabiner-config.ts` (`app_chatGPT`)

**Goal:** ChatGPT has resize **before** taps (the only app with this order). The resize manipulator goes into `prependExtras`.

- [ ] **Step 5f.1: Rewrite `app_chatGPT`**

Original (lines 714–722):

```ts
function app_chatGPT() {
  return rule('ChatGPT', ifApp('^com.openai.chat$')).manipulators([
    map(1, 'Meh').to(toResizeWindow('ChatGPT')),

    ...tapModifiers({
      '‹⌘': toKey('s', '⌘⌃'), // openSidebar
    }),
  ])
}
```

Replace with:

```ts
function app_chatGPT() {
  return rule('ChatGPT', ifApp('^com.openai.chat$')).manipulators(
    appCommons({
      prependExtras: [appResize('ChatGPT')],
      taps: {
        '‹⌘': toKey('s', '⌘⌃'), // openSidebar
      },
    }),
  )
}
```

Expected emitted-order: resize, taps. Identical to original.

- [ ] **Step 5f.2: Type-check, snapshot, diff, commit**

```bash
npx tsc --noEmit
npm run snapshot > /tmp/karabiner-after.json
diff -u /tmp/karabiner-before.json /tmp/karabiner-after.json
git add karabiner-config.ts
git commit -m "$(cat <<'EOF'
migrate chatgpt to appCommons

ChatGPT is the only app with resize-before-taps order. The resize
manipulator goes into prependExtras to preserve source order.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 4: Final tidy

One commit. Removes imports that became dead after the migrations: `historyNavi`, `tabNavi`, `switcher`, `tapModifiers`, `toResizeWindow` are no longer called directly from `karabiner-config.ts` (they're called from inside `appCommons` and `appResize` in `utils.ts`). The `app_raycast`, `app_homerow`, `keyboard_*` functions were untouched and don't use these helpers.

### Task 6: Tidy imports after refactor

**Files:**
- Modify: `karabiner-config.ts` (clean up the `./utils.ts` import block)
- Inspect: `layer-engines.ts`, `utils.ts` (verify no dead imports)

**Goal:** every imported symbol is referenced. No dead code anywhere.

- [ ] **Step 6.1: Audit `karabiner-config.ts`'s `./utils.ts` import**

Current state (after Task 5f):

```ts
import {
  appCommons,
  appResize,
  duoModifiers,
  historyNavi,
  raycastExt,
  raycastWin,
  switcher,
  tabNavi,
  tapModifiers,
  toClearNotifications,
  toResizeWindow,
  toSystemSetting,
} from './utils.ts'
```

For each symbol, search `karabiner-config.ts` for a non-import reference:

```bash
for sym in appCommons appResize duoModifiers historyNavi raycastExt raycastWin switcher tabNavi tapModifiers toClearNotifications toResizeWindow toSystemSetting; do
  count=$(grep -c "\\b$sym\\b" karabiner-config.ts)
  echo "$sym: $count"
done
```

The import line itself counts 1. So a symbol with count 1 is unused.

Expected dead symbols: `historyNavi`, `tabNavi`, `switcher`, `tapModifiers`, `toResizeWindow` — these all moved into `appCommons`/`appResize`.

Expected live symbols: `appCommons` (every `app_*` after migration), `appResize` (most apps), `duoModifiers` (rule_duoModifiers), `raycastExt` (rule_leaderKey & layers), `raycastWin` (app_raycast & layers), `toClearNotifications` (layer_system), `toSystemSetting` (rule_leaderKey).

- [ ] **Step 6.2: Remove dead imports from `karabiner-config.ts`**

Update the import to:

```ts
import {
  appCommons,
  appResize,
  duoModifiers,
  raycastExt,
  raycastWin,
  toClearNotifications,
  toSystemSetting,
} from './utils.ts'
```

Also audit the top karabiner.ts import for dead symbols. After Task 3 removed the leader's inline state machine code, `ifVar`, `toUnsetVar`, `withCondition`, `withMapper` may still be used by `layer_*` and other rules — verify each:

- `withMapper`: used by `layer_vim`, `layer_symbol`, `layer_digitAndDelete`, `layer_snippet`. Live.
- `withCondition`: used by `layer_snippet`. Live.
- `withModifier`: used by `layer_vim`, `layer_symbol`, `app_raycast`. Live.
- `mapSimultaneous`: used by `app_homerow`. Live.
- `ifVar`: search for callers. Likely unused after Task 3. If so, remove.
- `toUnsetVar`: search for callers. Likely unused after Task 3. If so, remove.

- [ ] **Step 6.3: Audit `layer-engines.ts` imports**

Walk through each imported symbol from `karabiner.ts` and confirm a caller exists. If `formatTopHint`/`formatSubHint`/`escapeBindings` factored out an import, remove it. (Probably none — every helper still uses these.)

- [ ] **Step 6.4: Audit `utils.ts` imports**

After Task 1 already trimmed `ifVar`, `layer`, `toUnsetVar`, `withCondition` — re-verify nothing else became dead. `appCommons`/`appResize` use `historyNavi`, `tabNavi`, `switcher`, `tapModifiers`, `toResizeWindow`, `map` (via `appResize`), `toResizeWindow` — all defined in the same file. Imports from `karabiner.ts` for these helpers haven't changed.

- [ ] **Step 6.5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6.6: Snapshot + diff**

```bash
npm run snapshot > /tmp/karabiner-after.json
diff -u /tmp/karabiner-before.json /tmp/karabiner-after.json
```

Expected: empty. Removing imports has no runtime effect.

- [ ] **Step 6.7: Verify final file boundaries**

Quick sanity check that the three files have the responsibilities the spec promised:

- `karabiner-config.ts`: contains only `main()` and rule-definition functions (`rule_*`, `layer_*`, `app_*`, `keyboard_*`). No engine code. No generic helpers.
- `layer-engines.ts`: contains only `createLeaderLayer`, `createHyperLayer`, the `LeaderConfig`/`HyperConfig` types, the private helpers (`formatTopHint`, `formatSubHint`, `escapeBindings`, `hyperSubVar`), and the private sublayer types (`LeaderSublayer`, `HyperSublayer`).
- `utils.ts`: contains only generic karabiner.ts helpers (`historyNavi`, `tabNavi`, `switcher`, `tapModifiers`, `duoModifiers`, `appCommons`, `appResize`, `raycastExt`, `raycastWin`, `toResizeWindow`, `toClearNotifications`, `toSystemSetting`).

Run a quick line-count sanity check:

```bash
wc -l karabiner-config.ts layer-engines.ts utils.ts
```

Expected approximate sizes:
- `karabiner-config.ts`: ~500 lines (down from 746). Reductions: rule_leaderKey body ~125 lines → ~70 lines; rule_hyperLayer body unchanged; app_* functions each shrink by 3–7 lines.
- `layer-engines.ts`: ~150–180 lines.
- `utils.ts`: ~180 lines (down from 260, since createHyperLayer moved out and appCommons/appResize moved in).

These are sanity targets, not strict acceptance criteria.

- [ ] **Step 6.8: Commit**

```bash
git add karabiner-config.ts layer-engines.ts utils.ts
git commit -m "$(cat <<'EOF'
tidy imports after refactor

Removes imports that became dead after the appCommons migration:
historyNavi, tabNavi, switcher, tapModifiers, toResizeWindow no longer
referenced directly from karabiner-config.ts.

Final file responsibilities:
- karabiner-config.ts: main() + rule definitions only
- layer-engines.ts: project-specific Leader/Hyper engines + shared helpers
- utils.ts: generic karabiner.ts helpers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Final verification

After all 12 commits, run one last sanity sweep:

- [ ] **All commits land empty diff**

```bash
git log --oneline refactor-and-cleanup ^main | head -25
```

Spot-check: every commit on the branch (above the spec/plan commits) corresponds to one of the 12 enumerated commits in this plan.

- [ ] **Live build still works**

```bash
npm run build
```

Expected: `✓ Profile Default updated.`

- [ ] **Final snapshot still matches baseline**

```bash
npm run snapshot > /tmp/karabiner-final.json
diff -u /tmp/karabiner-before.json /tmp/karabiner-final.json
```

Expected: empty.

- [ ] **Type-check clean**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Hand off to user for manual smoke test**

Exercise the layers in normal use for a workday. Behavior should be indistinguishable from pre-refactor. Report any discrepancy as a regression — even a confirmed-empty diff doesn't catch issues outside the JSON profile (e.g., npm scripts or workflow changes).
