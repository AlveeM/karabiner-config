# Hyper Layer Design

**Date:** 2026-04-26
**Branch:** `hyper-layer`
**Status:** Approved (pending spec review + user review)

## Overview

Port @mxstbr's Hyper-key sublayer system from the sibling `karabiner` repo into this `karabiner.ts`-based config. The Hyper layer is added **alongside** the existing leader-key system — neither replaces nor refactors it. Hyper is triggered by Caps Lock held; Caps Lock tapped continues to emit Escape.

Six sublayers are ported: `o` (Open apps), `w` (Window), `s` (System), `v` (Move), `c` (Music), `r` (Raycast). Personal/inaccessible mxstbr-specific bindings are dropped. Mxstbr's `b` (Browse URLs) sublayer is not ported — `links.json` via the leader key already covers URL routing.

## Goals

- Add a discoverable, nested-letter Hyper sublayer system on Caps-Lock-held without disturbing existing leader-key, duo-layer, or `withModifier('Hyper')` bindings.
- Keep the call-site declarative — each sublayer expressed as one object literal, matching the ergonomics of mxstbr's `createHyperSubLayers`.
- Preserve current Caps-Lock-tap-to-Escape behavior and Shift+Caps real-caps-lock toggle.

## Non-Goals

- No refactor of `rule_leaderKey()` to share state with the new layer.
- No Moonlander-specific Hyper trigger (Caps Lock is not a first-class key on that layout).
- No removal of existing `withModifier('Hyper')` bindings in `app_raycast()` — they coexist with the new `Hyper+w` sublayer.
- No automated tests (the project has no test harness); verification is manual.

## Architecture

### State machine

The layer is **hold-based** (mxstbr's mechanic): Caps Lock is held throughout, and within that, the sublayer key is also held while binding letters are tapped. This gives an efficient chord: `Caps + o + g` opens Chrome with all three keys depressed.

State variables:

- `hyper`: 0 (inactive) | 1 (Caps Lock physically held)
- `hyper_sub_<key>`: 0 | 1, one variable per sublayer key (1 while that sublayer key is physically held)

Transitions:

| From | Trigger | To |
|---|---|---|
| `hyper=0` | Caps Lock pressed | `hyper=1`; show sublayer-list notification |
| `hyper=1`, all `hyper_sub_*=0` | Sublayer key pressed (e.g. `o`) | `hyper_sub_o=1`; show that sublayer's binding hint. `hyper` stays 1. |
| `hyper_sub_<k>=1` | Mapped letter | Emit the bound `ToEvent`(s). State unchanged — repeating the letter fires the action again. |
| `hyper_sub_<k>=1` | Sublayer key released | `hyper_sub_<k>=0`; clear that sublayer's hint |
| `hyper=1` | Caps Lock released | `hyper=0`; clear top-level notification. (Any still-held sublayer key resets via its own key-up.) |
| `hyper=1` or any `hyper_sub_*=1` | `⎋` or `⇪` pressed | Reset all hyper vars; clear notifications. (Safety-net escape — slight enhancement over mxstbr's mechanic.) |
| `hyper=0` | Caps Lock tapped (released within ~150ms, no other key pressed) | Emit `⎋` |

The interlock that prevents two sublayers from being active simultaneously: the sublayer-activation manipulator for key `k` requires `hyper=1` AND every other `hyper_sub_*=0`. So pressing a second sublayer key while the first is still held does nothing (it falls through to its default behavior — typically nothing, since Caps+letter has no native binding). The user must release the first sublayer key before activating another.

### Components

**`utils.ts` additions**

```ts
export type HyperSubLayer = {
  name: string                                            // shown in top-level hint
  mapping: { [key: string]: ToEvent | ToEvent[] }         // key → action
}

export function createHyperLayer(
  sublayers: { [sublayerKey: string]: HyperSubLayer },
): ManipulatorBuilder[]
```

Internally:
- One `layer('⇪', 'hyper')` to gate everything on Caps-Lock-held. The layer's `.configKey(m => m.toIfAlone(toKey('⎋')))` preserves tap-as-Escape, and `.notification(topHint)` shows the top-level sublayer list.
- For each sublayer key `k`, a manipulator gated on `ifVar('hyper', 1)` AND `ifVar(hyperSubVar(other), 0)` for every other sublayer (the interlock). Pressing the sub key sets `hyper_sub_<k>=1` via the manipulator's `to` and resets it via `to_after_key_up` (so the sub var is tied to the sub key being held). Posts a notification listing that sublayer's bindings; removes it on key-up.
- Per-sublayer `withCondition(ifVar(hyperSubVar(k), 1))` block: each mapped letter emits its action. The sub var is unchanged, so repeating works.
- Escape handling: `⎋` and `⇪` while `hyper=1` or any `hyper_sub_*=1` → unset that var, remove its notification. Implemented as one manipulator per state to keep conditions ANDed correctly.

Private helper `hyperSubVar(key)` → `` `hyper_sub_${key}` `` keeps variable naming consistent.

**`karabiner-config.ts` additions**

`rule_hyperLayer()` — defines all six sublayers (object literal per Section "Sublayer mappings" below) and returns `rule('Hyper Layer').manipulators(createHyperLayer({ ... }))`.

Inserted into the `writeToProfile` rules array immediately after `rule_leaderKey()`:

```
rule_duoModifiers(),
rule_leaderKey(),
rule_hyperLayer(),     // NEW
layer_vim(),
layer_symbol(),
layer_digitAndDelete(),
layer_snippet(),
layer_system(),
...
keyboard_apple(),       // CHANGED — see below
keyboard_moonlander(),
```

**`karabiner-config.ts` modification**

In `keyboard_apple()`, remove `map('⇪', '?⌘⌃').to('⎋')`. The new helper's `.toIfAlone(toKey('⎋'))` replaces it and unifies behavior across keyboards. `map('⇪', '⇧').to('⇪')` is retained.

## Sublayer mappings

### `o` — Open apps

| Key | App |
|---|---|
| 1 | 1Password |
| g | Google Chrome |
| c | Notion Calendar |
| v | Zed |
| d | Discord |
| s | Slack |
| e | Superhuman |
| n | Notion |
| t | Terminal |
| z | zoom.us |
| m | Reflect |
| f | Finder |
| i | Texts |
| p | Spotify |
| a | iA Presenter |

Dropped from mxstbr's verbatim list:
- `h` (Stellate-internal Notion page) — not accessible to this user
- `l` (mxstbr-personal Raycast extension) — not accessible to this user
- `r` → Reflect — duplicate of `m`
- `w` → Texts — duplicate of `i`

### `w` — Window

| Key | Action |
|---|---|
| ; | Hide window (⌘H, right_command) |
| y | Previous display (Raycast window-management) |
| o | Next display |
| k | Top half |
| j | Bottom half |
| h | Left half |
| l | Right half |
| f | Maximize |
| u | Previous tab (›⌃⇧⇥) |
| i | Next tab (›⌃⇥) |
| n | Next window (›⌘\`) |
| b | Back (›⌘[) |
| m | Forward (›⌘]) |

### `s` — System

| Key | Action |
|---|---|
| u | Volume up |
| j | Volume down |
| i | Display brightness up |
| k | Display brightness down |
| l | Screen lock (›⌃›⌘Q) |
| p | Play / pause |
| ; | Fast forward |
| e | Elgato key light toggle (`thomas/elgato-key-light/toggle`) |
| d | Do Not Disturb toggle (`yakitrak/do-not-disturb/toggle`) |
| t | Toggle system appearance (`raycast/system/toggle-system-appearance`) |
| c | Open camera (`raycast/system/open-camera`) |
| v | Dictation (‹⌥␣) |

### `v` — Move

| Key | Action |
|---|---|
| h | ← |
| j | ↓ |
| k | ↑ |
| l | → |
| u | Page down |
| i | Page up |
| m | Homerow magicmove (›⌃F) |
| s | Homerow scroll mode (›⌃J) |
| d | Duplicate line (›⇧›⌘D) |

### `c` — Music

| Key | Action |
|---|---|
| p | Play / pause |
| n | Next (fastforward) |
| b | Previous (rewind) |

### `r` — Raycast

Mirrors the existing leader's `r` mapping list.

| Key | Raycast extension |
|---|---|
| c | `raycast/calendar/my-schedule` |
| d | `raycast/dictionary/define-word` |
| e | `raycast/emoji-symbols/search-emoji-symbols` |
| g | `ricoberger/gitmoji/gitmoji` |
| s | `raycast/snippets/search-snippets` |
| v | `raycast/clipboard-history/clipboard-history` |

## Coexistence with existing systems

| Existing system | Trigger | Conflict with Hyper layer? |
|---|---|---|
| `rule_leaderKey()` | `l`+`;` simultaneous | None — disjoint trigger |
| `duoLayer`s (vim, symbol, digit, snippet) | Two-key chords (50ms) | None — Hyper requires Caps physically held |
| `layer_system` | `` ` `` held | None — different physical key |
| `withModifier('Hyper')` in `app_raycast()` | Real ⌘⌥⌃⇧ modifier (produced by `›⌥+›⇧` chord) | None — Caps-Lock-held sets a Karabiner *variable*, not the Hyper modifier |
| `keyboard_apple` Caps→Escape | Caps tap | Replaced by helper's `.toIfAlone` |

## Edge cases

1. **Caps Lock tapped, no other key:** `.toIfAlone(toKey('⎋'))` emits Escape.
2. **Caps Lock released mid-sublayer:** layer's auto-managed key-up resets `hyper=0`. The held sublayer key's `to_after_key_up` resets its sub var when the user releases it. (Brief intermediate state where `hyper=0` but `hyper_sub_<k>=1` is harmless: bindings still fire because they're gated on the sub var, not on `hyper`.)
3. **Unmapped key inside an active sublayer (e.g. Caps+o then `x`):** falls through to normal behavior; sub var stays set until `o` is released. Matches mxstbr's behavior.
4. **Repeated mapped letters (Caps+v+h+h+h):** all three left arrows fire — bindings don't reset state.
5. **Sublayer-to-sublayer transition (Caps+o still held, then `s`):** `s` activation requires `hyper_sub_o=0`; that condition fails, so `s` does nothing. User must release `o` first. This intentional restriction is the mxstbr interlock.
6. **Escape inside layer:** `⎋` or `⇪` while any hyper var is set clears that var + its notification. Useful as a manual reset.
7. **Shift+Caps:** untouched — still toggles macOS real caps lock.

## Verification plan

Manual verification after build:

1. Caps tap in a text field → emits Escape.
2. Caps held → notification shows `o_Open w_Window s_System v_Move c_Music r_Raycast`.
3. Caps + `o` → notification updates to apps list; Caps + `o` + `g` → Chrome opens.
4. Caps + `s` + `l` → screen locks.
5. Caps + `v` + `h` → left arrow.
6. Caps + `r` + `e` → Raycast emoji search opens.
7. Caps + `w` + `h` → left-half window resize (requires Raycast running).
8. Caps + `o`, then `x` (unmapped) → `x` types normally; release Caps → vars reset.
9. Shift + Caps → toggles macOS caps lock indicator.
10. Regression: leader (`l;`) still works; vim duo-layer (`f;`) still produces arrows; `app_raycast` Hyper arrows (Hyper+←/→) still navigate desktops.

## Out of scope

- Moonlander-specific Hyper trigger.
- `b` (Browse URL) sublayer.
- `spacebar` single-command (mxstbr's Hyper+␣ → create Notion todo, Stellate-personal).
- Refactor of `rule_leaderKey()` to share state.
- Automated tests.
