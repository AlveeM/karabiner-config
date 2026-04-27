# Hyper Layer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Caps-Lock-held Hyper layer with six sublayers (`o w s v c r`) alongside the existing leader-key system, ported from @mxstbr's `karabiner` repo.

**Architecture:** A new `createHyperLayer(sublayers)` helper in `utils.ts` builds the manipulators from a declarative object literal. A new `rule_hyperLayer()` in `karabiner-config.ts` calls the helper and is registered in `writeToProfile`. One line is removed from `keyboard_apple()` since the new layer handles tap-as-Escape.

**Tech Stack:** TypeScript via `tsx`, the `karabiner.ts` library (`layer`, `withCondition`, `ifVar`, `map`, `toKey`, `toApp`, `to$`, `toUnsetVar`, `toNotificationMessage`, `toRemoveNotificationMessage`, etc.), Karabiner-Elements as the runtime.

**Spec:** [docs/superpowers/specs/2026-04-26-hyper-layer-design.md](../specs/2026-04-26-hyper-layer-design.md)

---

## Notes for the implementer

**This project has no test harness.** "Verification" is two things, in order:
1. Typecheck: `npx tsc --noEmit -p .` — must pass before commit.
2. Manual probe: described per task. The user runs `npm run build` (= `tsx karabiner-config.ts`), which writes the new profile to `~/.config/karabiner/karabiner.json` and live-reloads. The user then physically presses keys and observes behavior.

**Important:** running the build deploys to the user's actual Karabiner profile. Each task has small commits so a misbehaving change can be reverted with `git revert`. Do not run `npm run build` yourself unless explicitly asked — leave that to the user.

**API references** (cross-checked against `node_modules/karabiner.ts/dist/index.d.ts`):
- `layer(key, varName)` returns a `LayerRuleBuilder` — but **`LayerRuleBuilder` is not exported** (it's a `declare class` without `export`). Use `ReturnType<typeof layer>` or omit the explicit return-type annotation and rely on inference.
- `layer(...).configKey(m => m.toIfAlone(toKey('⎋')))` sets the tap-Escape behavior on the layer key. `.notification(string)` attaches the top-level hint.
- `LayerRuleBuilder` extends `BasicRuleBuilder` and implements the exported `RuleBuilder` interface — so a `layer(...)` result can be passed directly into `writeToProfile`'s rules array alongside `rule(...)` results.
- The helper's shape is **two outputs**: the layer rule itself (a `RuleBuilder` from `layer(...)`) plus a `ManipulatorBuilder[]` of the sublayer activation/binding/escape manipulators. The call site puts both into `writeToProfile` (the latter wrapped in `rule('Hyper Layer').manipulators(...)`).
- `withCondition(cond)(manipulators)` wraps each manipulator with the condition.
- `ifVar(name, value)` builds a condition; chain `.unless()` for negation. Multiple `.condition(...)` calls on a manipulator builder AND together.
- `toUnsetVar(name)` is a `ToEvent` that sets the variable to 0.
- `BasicManipulatorBuilder.toAfterKeyUp(event)` exists and accepts a `ToEvent` — confirmed in the `.d.ts` (line ~90).

**Style conventions** (from existing `utils.ts` and `karabiner-config.ts`):
- 2-space indent, single quotes, trailing commas. Prettier config in `prettier.config.js`.
- Use `let` for locals, not `const` (matches existing style).
- Notification hint format: `key_Label key_Label ...` separated by spaces (see `rule_leaderKey` in karabiner-config.ts:189-191).
- Use the unicode aliases (`'⇪'`, `'⎋'`, `'⌫'`, `'›⌃'`, etc.) where they exist — see existing config.

---

## File Structure

| File | Change |
|---|---|
| `utils.ts` | **Add:** `HyperSubLayer` type, private `hyperSubVar(key)` helper, `createHyperLayer(sublayers)` exported function. |
| `karabiner-config.ts` | **Add:** `rule_hyperLayer()` function and a single line registering it in the `writeToProfile` rules array. **Modify:** delete one line in `keyboard_apple()` (the `map('⇪', '?⌘⌃').to('⎋')`). |

No new files are created.

---

## Task 1: Layer foundation — Caps→Esc on tap, no sublayers yet

**Goal:** Get the layer wired up end-to-end with zero sublayers. Verify Caps-tap still produces Escape via the new mechanism, and Caps-hold does nothing visible (since no sublayers are defined).

**Files:**
- Modify: `utils.ts` — add type and helper skeleton
- Modify: `karabiner-config.ts` — add `rule_hyperLayer()`, register it, remove the old Caps→Esc line

- [ ] **Step 1.1: Add `HyperSubLayer` type and helper skeleton to `utils.ts`**

Append this to `utils.ts` (after the existing exports). Imports: extend the existing `karabiner.ts` import to include `layer`. `toKey` and `ManipulatorBuilder` are likely not yet imported there — add them. Other names (`withCondition`, `ifVar`, `toUnsetVar`, `toNotificationMessage`, `toRemoveNotificationMessage`) are needed in later tasks — leave them out of the import for now and add as the tasks introduce them.

```ts
import {
  // ... existing imports ...
  layer,
  toKey,
  type ManipulatorBuilder,
  type ToEvent,
} from 'karabiner.ts'

export type HyperSubLayer = {
  /** Name shown in the top-level Hyper hint, e.g. "Open" for the `o` sublayer. */
  name: string
  /** Letter -> action(s) within this sublayer. */
  mapping: { [key: string]: ToEvent | ToEvent[] }
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
 * separate rule by the caller). LayerRuleBuilder is not exported by karabiner.ts,
 * so the return type uses inference.
 */
export function createHyperLayer(sublayers: {
  [sublayerKey: string]: HyperSubLayer
}) {
  let subKeys = Object.keys(sublayers)
  let topHint = subKeys.map((k) => `${k}_${sublayers[k].name}`).join(' ')

  let layerRule = layer('⇪', 'hyper')
    .configKey((m) => m.toIfAlone(toKey('⎋')))
    .notification(topHint)

  let manipulators: ManipulatorBuilder[] = []
  // Sublayer activation, bindings, and escape will be appended in later tasks.

  return { layerRule, manipulators }
}
```

The return shape `{ layerRule, manipulators }` is the canonical one — both consumers (the layer for `writeToProfile`, the manipulators for `rule(...).manipulators(...)`) are returned cleanly. Type inference produces the right thing without needing to import `LayerRuleBuilder`.

- [ ] **Step 1.2: Add `rule_hyperLayer()` and register it in `karabiner-config.ts`**

Add a new function (place it after `rule_leaderKey()`, before the duo-layer functions). Also add `createHyperLayer` to the existing `./utils.ts` import.

```ts
import {
  // ... existing utils imports ...
  createHyperLayer,
} from './utils.ts'

function rule_hyperLayer() {
  let { layerRule, manipulators } = createHyperLayer({})
  return [layerRule, rule('Hyper Layer').manipulators(manipulators)]
}
```

In `main()` (karabiner-config.ts:42-44), use the spread to register both entries:

```ts
rule_duoModifiers(),
rule_leaderKey(),
...rule_hyperLayer(),     // NEW: spreads to [layerRule, ruleWithManipulators]
layer_vim(),
// ... rest unchanged ...
```

No new `karabiner.ts` imports needed in `karabiner-config.ts` for this step — the helper hides them.

- [ ] **Step 1.3: Remove the now-redundant `⇪→⎋` line from `keyboard_apple()`**

In `karabiner-config.ts`, delete this line (currently at line 631):

```ts
map('⇪', '?⌘⌃').to('⎋'),
```

Keep the line above it (`let ifAppleKeyboard = ...`) and the line below (`map('⇪', '⇧').to('⇪'),`) untouched. The new layer's `.toIfAlone(toKey('⎋'))` replaces this behavior and applies regardless of keyboard.

- [ ] **Step 1.4: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: zero errors. If errors, the most likely cause is the rule-array shape — see Step 1.1 refinement.

- [ ] **Step 1.5: Manual verification (user-driven; ask user to run)**

Ask the user to run `npm run build`, then test:
1. Tap Caps Lock in any text field → an Escape is emitted (if focused on a field that shows visible Escape behavior, e.g. close a popup).
2. Hold Caps Lock for >150ms, release → no Escape (the toIfAlone threshold suppresses it).
3. Shift + Caps Lock → toggles the macOS caps-lock indicator (real caps lock).
4. Existing leader (`l;`) and duo-layers (`f;`, `s;`, `d;`, `zx`) still work.

Stop and request user confirmation before proceeding to Task 2.

- [ ] **Step 1.6: Commit**

```bash
git add utils.ts karabiner-config.ts
git commit -m "$(cat <<'EOF'
add Hyper layer foundation (Caps held; tap=Esc; no sublayers yet)

Adds createHyperLayer helper and rule_hyperLayer wired to the rules
array. Removes the now-redundant Caps->Esc mapping from keyboard_apple
since the layer's toIfAlone covers it.

Spec: docs/superpowers/specs/2026-04-26-hyper-layer-design.md
EOF
)"
```

---

## Task 2: Sublayer activation + Music sublayer end-to-end

**Goal:** Implement the per-sublayer activation logic in `createHyperLayer`, then add the Music sublayer (`c` — 3 bindings, smallest) as a complete end-to-end smoke test.

**Files:**
- Modify: `utils.ts` — extend `createHyperLayer`
- Modify: `karabiner-config.ts` — populate `rule_hyperLayer` with the `c` sublayer

- [ ] **Step 2.1: Extend `utils.ts` imports**

Add to the `karabiner.ts` import in `utils.ts`:

```ts
import {
  // ... existing ...
  ifVar,
  layer,
  map,
  toNotificationMessage,
  toRemoveNotificationMessage,
  toUnsetVar,
  withCondition,
} from 'karabiner.ts'
```

- [ ] **Step 2.2: Implement sublayer activation manipulators**

Extend `createHyperLayer` in `utils.ts` to generate, for each sublayer key, a manipulator that:
- Fires when the sublayer key is pressed (e.g. `o`)
- Is gated on `ifVar('hyper', 1)` AND `ifVar(hyperSubVar(other), 0)` for every OTHER sublayer key (interlock)
- Sets `hyper_sub_<k>=1` via `.toVar(hyperSubVar(k), 1)`
- On key-up resets `hyper_sub_<k>=0` and removes the sub-hint notification (use the manipulator's `to_after_key_up`; in `karabiner.ts` builder API this is `.toAfterKeyUp(toUnsetVar(...))` and `.toAfterKeyUp(toRemoveNotificationMessage(...))` — verify exact method name in `node_modules/karabiner.ts/dist/index.d.ts`)
- Posts a notification listing the bindings of this sublayer

Concrete code (replaces the Task 1 skeleton):

```ts
export function createHyperLayer(sublayers: {
  [sublayerKey: string]: HyperSubLayer
}) {
  let subKeys = Object.keys(sublayers)
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

    let activation = map(k as any)
      .toVar(subVar, 1)
      .toNotificationMessage(subVar, `${sub.name}: ${subHint}`)
      .toAfterKeyUp(toUnsetVar(subVar))
      .toAfterKeyUp(toRemoveNotificationMessage(subVar))
      .condition(ifVar('hyper', 1))
    for (let other of otherSubVars) {
      activation = activation.condition(ifVar(other, 0))
    }
    manipulators.push(activation)
  }

  // Sublayer bindings will be appended in Task 3.

  return { layerRule, manipulators }
}
```

`map(k as any)` is the cast escape hatch needed because `k` is typed `string` from `Object.keys`, while `map`'s param expects a narrower `FromKeyParam` type. This is the same pattern used elsewhere in `utils.ts` (see `duoModifiers` line 84). All called methods (`.toVar`, `.toNotificationMessage`, `.toAfterKeyUp`, `.condition`) exist on `BasicManipulatorBuilder` per the `.d.ts`.

- [ ] **Step 2.3: Update `rule_hyperLayer()` in `karabiner-config.ts` to add the `c` (Music) sublayer**

```ts
function rule_hyperLayer() {
  let { layerRule, manipulators } = createHyperLayer({
    c: {
      name: 'Music',
      mapping: {
        p: toKey('play_or_pause'),
        n: toKey('fastforward'),
        b: toKey('rewind'),
      },
    },
  })
  return [layerRule, rule('Hyper Layer').manipulators(manipulators)]
}
```

(Adjust the spread point in `main()` if needed — e.g. `...rule_hyperLayer(),` if returning an array.)

Note: the bindings themselves don't fire yet — Task 3 adds those manipulators. This step verifies the *activation* logic in isolation.

- [ ] **Step 2.4: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: zero errors.

- [ ] **Step 2.5: Manual verification**

Ask the user to run `npm run build`, then test:
1. Hold Caps Lock → top-level notification shows `c_Music`.
2. Caps + hold `c` → notification updates to show the Music sublayer hint (`Music: p n b`).
3. Release `c` → sublayer hint clears; top-level hint reappears.
4. Release Caps → all hints clear.
5. (Negative) Caps + hold `c` + press `s` → `s` does nothing visible (the interlock blocks second sublayer).
6. (Negative) Caps + `p` (without `c` first) → no music control yet (bindings come in Task 3).

Stop and request user confirmation.

- [ ] **Step 2.6: Commit**

```bash
git add utils.ts karabiner-config.ts
git commit -m "$(cat <<'EOF'
implement Hyper sublayer activation + add empty Music sublayer

Sublayer key (held) sets hyper_sub_<k>=1 with notification; key-up
resets. Interlock prevents simultaneous sublayers. Bindings still TBD.
EOF
)"
```

---

## Task 3: Sublayer bindings — Music plays end-to-end

**Goal:** Add the per-sublayer binding manipulators so that mapped letters fire actions. After this task, the Music sublayer (Caps + c + p / n / b) actually controls playback.

**Files:**
- Modify: `utils.ts` — append binding manipulators

- [ ] **Step 3.1: Add binding manipulators in `createHyperLayer`**

Inside the `for (let k of subKeys)` loop in `createHyperLayer` (after the activation manipulator is pushed), append:

```ts
// Sublayer bindings: each mapped letter fires action while sub var = 1.
let entries = Object.keys(sub.mapping)
manipulators.push(
  ...withCondition(ifVar(subVar, 1))(
    entries.map((letter) =>
      map(letter as any).to(sub.mapping[letter]),
    ),
  ),
)
```

- [ ] **Step 3.2: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: zero errors.

- [ ] **Step 3.3: Manual verification**

Ask the user to run `npm run build`, then play a track in Spotify/Music.app and test:
1. Caps + hold `c` + tap `p` → playback toggles (play/pause).
2. Caps + hold `c` + tap `n` → next track / fast-forward.
3. Caps + hold `c` + tap `b` → previous track / rewind.
4. Caps + hold `c` + tap `p` `p` `p` → toggles 3 times (state isn't reset by binding).
5. Release `c`, then press `p` while still holding Caps → no music control fires (sub var was reset on c key-up).

Stop and request user confirmation.

- [ ] **Step 3.4: Commit**

```bash
git add utils.ts
git commit -m "fire sublayer bindings while their sub var is set"
```

---

## Task 4: Escape-from-layer behavior

**Goal:** Add a manual escape: pressing `⎋` or `⇪` while inside the layer (top-level or any sublayer) clears the corresponding state.

**Files:**
- Modify: `utils.ts`

- [ ] **Step 4.1: Add escape manipulators**

In `createHyperLayer`, after the existing manipulators, append:

```ts
// Manual escape: ⎋ or ⇪ while top-level hyper held but no sub active -> just unset hyper.
manipulators.push(
  ...withCondition(ifVar('hyper', 1))(
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
```

Note: this duplicates state-clearing the layer auto-manages on Caps-up, but provides a manual reset path, especially useful if the user wants to bail out without releasing Caps.

- [ ] **Step 4.2: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: zero errors.

- [ ] **Step 4.3: Manual verification**

Ask the user to run `npm run build`, then test:
1. Caps held → notification shows `c_Music`. Press `⎋` → top-level hint clears (`hyper` unset). Caps still held but no hint shown. Releasing Caps → no Escape (toIfAlone only fires on quick tap).
2. Caps + hold `c` (sub hint shows). Press `⎋` → sub hint clears. Release `c`, release Caps. No regression.
3. Caps tapped quickly with no other key → still produces Escape (regression check).

Stop and request user confirmation.

- [ ] **Step 4.4: Commit**

```bash
git add utils.ts
git commit -m "add manual escape (⎋ or ⇪) to exit Hyper layer states"
```

---

## Task 5: Add remaining sublayers — `s`, `v`, `r`, `w`, `o`

**Goal:** Populate the remaining five sublayers per the spec. Pure data additions to `rule_hyperLayer()` — the helper is already complete.

**Files:**
- Modify: `karabiner-config.ts`

- [ ] **Step 5.1: Add helpers needed for the data**

In `karabiner-config.ts`, ensure these `karabiner.ts` imports are present (most already are): `toApp`, `to$`, `toKey`. The `raycastExt` and `raycastWin` helpers are already imported from `./utils.ts`.

- [ ] **Step 5.2: Replace `rule_hyperLayer()` body with the full sublayer set**

```ts
function rule_hyperLayer() {
  let { layerRule, manipulators } = createHyperLayer({
    o: {
      name: 'Open',
      mapping: {
        '1': toApp('1Password'),
        g: toApp('Google Chrome'),
        c: toApp('Notion Calendar'),
        v: toApp('Zed'),
        d: toApp('Discord'),
        s: toApp('Slack'),
        e: toApp('Superhuman'),
        n: toApp('Notion'),
        t: toApp('Terminal'),
        z: toApp('zoom.us'),
        m: toApp('Reflect'),
        f: toApp('Finder'),
        i: toApp('Texts'),
        p: toApp('Spotify'),
        a: toApp('iA Presenter'),
      },
    },
    w: {
      name: 'Window',
      mapping: {
        ';': toKey('h', '›⌘'),
        y: raycastWin('previous-display'),
        o: raycastWin('next-display'),
        k: raycastWin('top-half'),
        j: raycastWin('bottom-half'),
        h: raycastWin('left-half'),
        l: raycastWin('right-half'),
        f: raycastWin('maximize'),
        u: toKey('⇥', '›⌃›⇧'),
        i: toKey('⇥', '›⌃'),
        n: toKey('`', '›⌘'),
        b: toKey('[', '›⌘'),
        m: toKey(']', '›⌘'),
      },
    },
    s: {
      name: 'System',
      mapping: {
        u: toKey('volume_increment'),
        j: toKey('volume_decrement'),
        i: toKey('display_brightness_increment'),
        k: toKey('display_brightness_decrement'),
        l: toKey('q', '›⌃›⌘'),
        p: toKey('play_or_pause'),
        ';': toKey('fastforward'),
        e: raycastExt('thomas/elgato-key-light/toggle'),
        d: raycastExt('yakitrak/do-not-disturb/toggle'),
        t: raycastExt('raycast/system/toggle-system-appearance'),
        c: raycastExt('raycast/system/open-camera'),
        v: toKey('␣', '‹⌥'),
      },
    },
    v: {
      name: 'Move',
      mapping: {
        h: toKey('←'),
        j: toKey('↓'),
        k: toKey('↑'),
        l: toKey('→'),
        u: toKey('page_down'),
        i: toKey('page_up'),
        m: toKey('f', '›⌃'),
        s: toKey('j', '›⌃'),
        d: toKey('d', '›⇧›⌘'),
      },
    },
    c: {
      name: 'Music',
      mapping: {
        p: toKey('play_or_pause'),
        n: toKey('fastforward'),
        b: toKey('rewind'),
      },
    },
    r: {
      name: 'Raycast',
      mapping: {
        c: raycastExt('raycast/calendar/my-schedule'),
        d: raycastExt('raycast/dictionary/define-word'),
        e: raycastExt('raycast/emoji-symbols/search-emoji-symbols'),
        g: raycastExt('ricoberger/gitmoji/gitmoji'),
        s: raycastExt('raycast/snippets/search-snippets'),
        v: raycastExt('raycast/clipboard-history/clipboard-history'),
      },
    },
  })
  return [layerRule, rule('Hyper Layer').manipulators(manipulators)]
}
```

Notes on the modifier syntax (`'›⌘'`, `'‹⌥'`, etc.):
- `'›⌘'` = right_command, `'‹⌘'` = left_command, etc.
- `'›⌃›⌘'` = right_control + right_command (compound).
- mxstbr's `right_command` modifier on Hide-window etc. is preserved.

If the `raycastExt` helper expects a single string but the spec'd path is for `raycast/system/...` (system-namespace, not extension-namespace), verify by checking the existing `raycastExt` implementation in `utils.ts:110` — it does `open raycast://extensions/${name}` which matches what mxstbr uses for `raycast/system/toggle-system-appearance`. Good.

- [ ] **Step 5.3: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: zero errors. The helper's `map(letter as any)` cast handles arbitrary string keys including `';'` and digit-strings. If the typecheck fails on a specific binding letter, the issue is likely in the action expression rather than the key — debug accordingly.

- [ ] **Step 5.4: Manual verification (broad)**

Ask the user to run `npm run build`, then run through the spec's verification plan section by section:

1. Tap Caps → Escape (regression).
2. Hold Caps → top hint shows `o_Open w_Window s_System v_Move c_Music r_Raycast`.
3. Apps: Caps + hold `o` + tap `g` → Chrome opens. Spot-check 2-3 more (e.g. `s` → Slack, `f` → Finder).
4. Window: Caps + hold `w` + tap `h` → window goes to left half (Raycast must be running). Spot-check `;` (Hide), `f` (Maximize).
5. System: Caps + hold `s` + tap `u`/`j` → volume up/down. Caps + `s` + `l` → screen lock. Caps + `s` + `t` → theme toggle.
6. Move: Caps + hold `v` + tap `h`/`j`/`k`/`l` → arrows. `u`/`i` → page down/up.
7. Music: regression check from Task 3.
8. Raycast: Caps + hold `r` + tap `e` → Raycast emoji search opens.
9. Caps + hold `o` + tap unmapped letter (e.g. `x`) → `x` types normally; release `o`; release Caps.
10. Existing leader (`l;`), duo-layers (`f;`, `s;`, `d;`, `zx`), and `app_raycast` Hyper bindings (Hyper+arrows for desktops, Hyper+1/2/3 for thirds) all still work.

If any binding misfires, debug and amend the data in this task (no helper changes expected).

- [ ] **Step 5.5: Commit**

```bash
git add karabiner-config.ts
git commit -m "$(cat <<'EOF'
populate Hyper sublayers (o w s v r) with full mappings

Adds Open/Window/System/Move/Raycast sublayers per spec. The Music
sublayer was already in place from Task 2.

Closes the Hyper layer port from @mxstbr's karabiner repo.
EOF
)"
```

---

## After all tasks: final verification & PR

Once Task 5 passes, the implementation is complete. Optional follow-ups (not required by this plan):

- Update `cheatsheet.md` to document the new Hyper layer.
- Update `user-guide.md` similarly.
- Open a PR merging `hyper-layer` → `main` if desired.

These are out of scope for this plan — the user can drive them separately.
