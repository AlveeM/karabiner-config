# Karabiner Config — Cheatsheet

Complete binding reference. For *why* anything works the way it does, see [`user-guide.md`](./user-guide.md).

> **Notation.** ‹X = left-side X, ›X = right-side X. **Hyper** = ⌘⌥⌃⇧. **Meh** = ⌥⌃⇧. Chords listed like `fd` mean *hold both keys simultaneously*; the implementation accepts either order (`fd` or `df`).

---

## Duo modifiers

Hold two keys (≤ 50 ms apart, ≥ 150 ms held) → modifier. Tap quickly → letters as typed.

| Modifier | Left-hand chord | Right-hand chord |
|:---:|:---:|:---:|
| ⌘ | `fd` | `jk` |
| ⌃ | `fs` | `jl` |
| ⌥ | `fa` | `j;` |
| ⇧ | `ds` | `kl` |
| ⌘⇧ | `gd` | `hk` |
| ⌃⇧ | `gs` | `hl` |
| ⌥⇧ | `ga` | `h;` |
| ⌘⌥ | `vc` | `m,` |
| ⌘⌃ | `vx` | `m.` |
| ⌥⌃ | `cx` | `,.` |
| ⌘⌥⌃ | `vz` | `m/` |

> **Reserved exception:** `f + j` is **not** a duo modifier — it's reserved for Homerow (Click). See [Global bindings](#global-bindings).

---

## Leader key

**Trigger:** `l` + `;` simultaneously (≤ 250 ms). Notification shows the available namespaces. Press a namespace key, then an action key. **Abort:** ⎋ or ⇪ at any time.

```
l;  →  a_App  e_Emoji  g_Gitmoji  l_Link  r_Raycast  s_SystemSetting
```

### `a` — App (launches via `toApp`)

| Key | App |
|:---:|:---|
| `a` | ChatGPT |
| `c` | Calendar |
| `d` | Eudb_en (dictionary) |
| `e` | Zed (editor) |
| `f` | Finder |
| `g` | Google Chrome |
| `i` | WeChat (IM) |
| `m` | Spark Desktop (mail) |
| `r` | Rider |
| `s` | Slack |
| `t` | Warp (terminal) |
| `u` | Spotify (mUsic) |
| `w` | WebStorm |
| `z` | zoom.us |
| `;` | System Settings |

### `e` — Emoji (pasted)

| Key | Emoji | Mnemonic |
|:---:|:---:|:---|
| `c` | 📅 | Calendar |
| `h` | 💯 | Hundred |
| `j` | 😂 | Joy |
| `p` | 👍 | Plus_one |
| `s` | 😅 | Sweat_smile |
| `t` | 🧵 | Thread |

### `g` — Gitmoji (pasted) — see [gitmoji.dev](https://gitmoji.dev/)

| Key | Gitmoji | Use |
|:---:|:---:|:---|
| `b` | 🐛 | fix a Bug |
| `d` | 📝 | Documentation |
| `f` | 🚩 | Feature Flags |
| `m` | 🔀 | Merge branches |
| `n` | ✨ | introduce New features |
| `r` | ♻️ | Refactor |
| `u` | 💄 | UI / Style |
| `v` | 🔖 | release / Version tags |
| `x` | 🔥 | remove code or files |

### `l` — Link (opens in default browser)

| Key | URL |
|:---:|:---|
| `g` | https://github.com |

> Add more in `links.json`.

### `r` — Raycast extensions

| Key | Extension |
|:---:|:---|
| `c` | raycast/calendar — My Schedule |
| `d` | raycast/dictionary — Define Word |
| `e` | raycast/emoji-symbols — Search |
| `g` | ricoberger/gitmoji — Gitmoji |
| `s` | raycast/snippets — Search Snippets |
| `v` | raycast/clipboard-history |

### `s` — SystemSetting (opens preference pane)

| Key | Pane |
|:---:|:---|
| `a` | Appearance |
| `d` | Displays |
| `k` | Keyboard |
| `o` | Dock |

---

## Hyper layer — hold ⇪ (Caps Lock)

A two-stage hold layer. Hold ⇪ to enter Hyper (notification lists sublayers). While ⇪ is still held, hold a sublayer key (`o` `w` `s` `v` `c` `r`) and tap a binding letter to fire the action. Release ⇪ at any time to exit. **Tap ⇪ alone → ⎋.** **Abort any layer state:** ⎋ or ⇪.

```
⇪  →  o_Open  w_Window  s_System  v_Move  c_Music  r_Raycast
```

### `o` — Open app

| Key | App |
|:---:|:---|
| `1` | 1Password |
| `a` | iA Presenter |
| `c` | Notion Calendar |
| `d` | Discord |
| `e` | Superhuman |
| `f` | Finder |
| `g` | Google Chrome |
| `i` | Texts |
| `m` | Reflect |
| `n` | Notion |
| `p` | Spotify |
| `s` | Slack |
| `t` | Terminal |
| `v` | Zed |
| `z` | zoom.us |

### `w` — Window

| Key | Action |
|:---:|:---|
| `y` / `o` | Raycast: previous / next display |
| `h` / `l` | Raycast: left half / right half |
| `k` / `j` | Raycast: top half / bottom half |
| `f` | Raycast: maximize |
| `u` / `i` | ›⌃⇧⇥ / ›⌃⇥ (prev / next switcher) |
| `b` / `m` | ›⌘[ / ›⌘] (back / forward) |
| `n` | ›⌘` (cycle windows in app) |
| `;` | ›⌘h (hide app) |

### `s` — System

| Key | Action |
|:---:|:---|
| `u` / `j` | Volume up / down |
| `i` / `k` | Brightness up / down |
| `p` | Play / pause |
| `;` | Fast forward |
| `l` | ›⌘⌃Q — lock screen |
| `v` | ‹⌥␣ |
| `e` | Raycast: Elgato Key Light toggle |
| `d` | Raycast: Do Not Disturb toggle |
| `t` | Raycast: toggle system appearance |
| `c` | Raycast: open camera |

### `v` — Move

| Key | Action |
|:---:|:---|
| `h` `j` `k` `l` | ← ↓ ↑ → |
| `u` / `i` | Page down / page up |
| `m` | ›⌃F |
| `s` | ›⌃J |
| `d` | ›⌘⇧D |

### `c` — Music

| Key | Action |
|:---:|:---|
| `p` | Play / pause |
| `n` | Fast forward |
| `b` | Rewind |

### `r` — Raycast extensions

| Key | Extension |
|:---:|:---|
| `c` | raycast/calendar — My Schedule |
| `d` | raycast/dictionary — Define Word |
| `e` | raycast/emoji-symbols — Search |
| `g` | ricoberger/gitmoji |
| `s` | raycast/snippets — Search Snippets |
| `v` | raycast/clipboard-history |

---

## Vim layer — hold `f + ;`

Arrows on home row; tap layer keys to fire side modifiers (which can then chain into per-app tap-modifier actions).

```
                                   '    \
  ‹⌥   ‹⌃   ‹⌘       ←    ↓    ↑    →    ›⇧    ⌫    ⌦
   A     S     D         H      J     K     L     ;
```

| Key | Output |
|:---:|:---|
| `h` `j` `k` `l` | ← ↓ ↑ → |
| `a` | ‹⌥ |
| `s` | ‹⌃ |
| `d` | ‹⌘ |
| `;` | ›⇧ |
| `'` | ⌫ |
| `\` | ⌦ |

---

## Symbol layer — hold `s + ;`

```
  &     !    @    #         ^    {    [    (    $          ?    }    ]    )    %          _    +         ⌫
  N    M     ,     .         H    J    K    L    ;          Y    U    I     O    P          ␣    ⏎         '
```

| Key | Symbol |
|:---:|:---:|
| `n` | & |
| `m` | ! |
| `,` | @ |
| `.` | # |
| `h` | ^ |
| `j` | { |
| `k` | [ |
| `l` | ( |
| `;` | $ |
| `y` | ? |
| `u` | } |
| `i` | ] |
| `o` | ) |
| `p` | % |
| `]` | * |
| `␣` (space) | _ |
| `⏎` (return) | + |
| `'` | ⌫ |

---

## Digit & delete layer — hold `d + ;`

Numpad layout on home row, F-keys on the digit row, backspace family on the right.

```
  0      1    2    3        4    5    6        7    8    9        +    -    /    *        .          ⌫    ⌥⌫    ⌘⌫    ⌦
  N     M    ,     .        J    K    L        U    I    O        P    ;     /    ]        [          '      H        Y      \
```

| Key | Output |
|:---:|:---:|
| `n` | 0 |
| `m` `,` `.` | 1 2 3 |
| `j` `k` `l` | 4 5 6 |
| `u` `i` `o` | 7 8 9 |
| `p` | + |
| `;` | − |
| `/` | / (passthrough) |
| `]` | × (`*`) |
| `[` | keypad `.` |
| `'` | ⌫ |
| `h` | ⌥⌫ (delete word) |
| `y` | ⌘⌫ (delete to start of line) |
| `\` | ⌦ |
| `1`–`9` | F1–F9 |

---

## Snippet layer — hold `z + x`

A grab-bag layer: paste glyphs, paste arrow / modifier symbols, expand small code snippets.

### Paste modifier / control glyphs

| Key | Pastes |
|:---:|:---:|
| `2` `3` `4` `5` | ⌫ ⌦ ⇥ ⎋ |
| `6` `7` `8` `9` | ⌘ ⌥ ⌃ ⇧ |
| `0` | ⇪ |
| `,` `.` | ‹ › |

### Paste navigation glyphs (key pastes itself)

`←` `→` `↑` `↓` `␣` `⏎` `⌫` `⌦` — pasting any of these glyphs.

### Code snippets

| Key | Output | Notes |
|:---:|:---|:---|
| `k` | `() => ` | Default |
| `k` (in VSCode) | `f20 + k` | Hands off to a VSCode chord |
| `k` (in WebStorm) | `afun` (typed) | JetBrains live template |
| `l` | `console.log()` + ← | |
| `l` (in VSCode) | `f20 + l` | |
| `o` | `console.assert()` + ← | |
| `/` | `cn()` + ← | |
| `'` | `⌫"` | Replace `"` cursor pair |
| `[` | `[ ] ` (Markdown checkbox) | |
| `]` | `- [ ] ` (Markdown bullet+checkbox) | |
| `'` | ⌫ | (key, not paste) |
| `\` | ⌦ | |

---

## System layer — hold `` ` `` (backtick)

A regular layer (not duo). Mouse warp, sleep, app switcher, clear notifications.

| Key | Action |
|:---:|:---|
| `1` | Cursor → 25 % × 50 %, screen 0 |
| `2` | Cursor → 50 % × 50 %, screen 0 |
| `3` | Cursor → 75 % × 50 %, screen 0 |
| `4` | Cursor → 99 %, y = 20, screen 0 (top-right) |
| `5` | Cursor → 50 % × 50 %, screen 1 |
| `⏎` | Left mouse click |
| `n` | Clear all notifications |
| `␣` | Sleep system |
| `j` | ⌘⇥ (app switcher forward) |
| `k` | ⌘⇧⇥ (app switcher backward) |

---

## Per-app tap-modifiers

Tap and release a side modifier → fire the action below. Hold → behaves as the modifier normally. Each app row also gets the universal mixins it lists.

### Convention
| Side modifier | Typical role |
|:---:|:---|
| ‹⌘ | Left UI toggle (sidebar, file tree) |
| ‹⌥ | Run / re-run / refresh |
| ‹⌃ | Run list / debug |
| ›⌘ | Right UI toggle (terminal, inspector) |
| ›⌥ | Command palette |
| ›⌃ | History / recent files |

### Chrome (`com.google.Chrome`)
Mixins: history, tab, switcher · Resize: `Meh + 1`
| Tap | Action |
|:---:|:---|
| ‹⌥ | ⌘R — reload |
| ›⌘ | ⌘⌥I — DevTools |
| ›⌥ | ⌘⇧A — search tabs |

### Safari (`com.apple.Safari`)
Mixins: history, tab, switcher · Resize: `Meh + 1`
| Tap | Action |
|:---:|:---|
| ‹⌘ | ⌘⇧L — show / hide sidebar |
| ‹⌥ | ⌘R — reload |
| ›⌘ | ⌘⌥I — Web Inspector |

### JetBrains IDEs (`com.jetbrains.*`)
Mixins: history, tab, switcher · Extra: ⌘⎋ → ⌘⇧⎋ · Resize: `Meh + 1` (targets WebStorm)
| Tap | Action |
|:---:|:---|
| ‹⌘ | ⌘⇧⎋ — hide all tool windows |
| ‹⌥ | ⌥⇧R — Run |
| ‹⌃ | ⌥⌃R — Run… |
| ›⌘ | ⌥4 — Terminal tool window |
| ›⌥ | ⌘⇧A — Find Action |
| ›⌃ | ⌘E — Recent Files |

### Zed (`dev.zed.Zed`)
Mixins: history, tab, switcher · Extra: ⌘⎋ → ⌘⇧⎋ · Resize: `Meh + 1`
| Tap | Action |
|:---:|:---|
| ‹⌘ | ⌘⇧⎋ — close all docks |
| ‹⌥ | ⌥T — task::Rerun |
| ‹⌃ | ⌥⇧T — task::Spawn |
| ›⌘ | ⌃` — terminal |
| ›⌥ | ⌘⇧A — command palette |
| ›⌃ | ⌘P — file finder |

### VSCode (`com.microsoft.VSCode`)
Mixins: tab, switcher · Extras: ⌃H → ⌃-, ⌃L → ⌃⇧- (back / forward) · Resize: `Meh + 1`
| Tap | Action |
|:---:|:---|
| ‹⌘ | ⌘⎋ — toggle sidebar |
| ‹⌥ | ⌥⇧R — run |
| ›⌘ | ⌃` — terminal |
| ›⌥ | ⌘⇧P — Command Palette |
| ›⌃ | ⌘P — Quick Open / Go to File |

### Cursor (`com.todesktop.230313mzl4w4u92`)
Mixins: tab, switcher · Extras: ⌃H → ⌃-, ⌃L → ⌃⇧-
| Tap | Action |
|:---:|:---|
| ‹⌘ | ⌘⎋ — toggle sidebar |
| ‹⌥ | ⌥⇧R — run |
| ›⌘ | ⌃` — terminal |
| ›⌥ | ⌘⇧P — Command Palette |
| ›⌃ | ⌘P — Quick Open / Go to File |

### Warp (`dev.warp.Warp`)
Mixins: tab · Extra: ⇧⏎ → ⌃J · Resize: `Meh + 1`

### Slack (`com.tinyspeck.slackmacgap`)
Mixins: history · Resize: `Meh + 1` (custom geometry: pos `1263, 25`, size `1760 × 1415`)
| Tap | Action |
|:---:|:---|
| ‹⌘ | ⌘⇧D — show / hide sidebar |
| ‹⌥ | F6 — move focus to next section |
| ›⌘ | ⌘. — hide right bar |
| ›⌥ | ⌘K — open jumper |

### Spark (`com.readdle.SparkDesktop`)
Resize: `Meh + 1` (custom size `1644 × 1220`)
| Tap | Action |
|:---:|:---|
| ‹⌘ | `/` — open sidebar |
| ‹⌥ | ⌘R — fetch |
| ›⌘ | ⌘/ — change layout |
| ›⌥ | ⌘K — actions |

### Zoom (`us.zoom.xos`)
| Tap | Action |
|:---:|:---|
| ‹⌘ | ⌘⇧A — mute / unmute audio |
| ‹⌥ | ⌘⇧S — start / stop screen share |
| ›⌘ | ⌘⇧V — start / stop video |
| ›⌥ | ⌘⇧H — show / hide chat panel |

### ChatGPT (`com.openai.chat`)
Resize: `Meh + 1`
| Tap | Action |
|:---:|:---|
| ‹⌘ | ⌘⌃S — open sidebar |

---

## Global bindings

### Raycast — quick open

| Input | Action |
|:---:|:---|
| ⌥ + ␣ | Run `evan-liu/quick-open/index` |

### Raycast — window management (Hyper = ⌘⌥⌃⇧)

| Input | Action |
|:---:|:---|
| Hyper + ↑ | Previous display |
| Hyper + ↓ | Next display |
| Hyper + ← | Previous desktop |
| Hyper + → | Next desktop |
| Hyper + 1 | First third |
| Hyper + 2 | Center third |
| Hyper + 3 | Last third |
| Hyper + 4 | First two-thirds |
| Hyper + 5 | Last two-thirds |
| Hyper + 9 | Left half |
| Hyper + 0 | Right half |

### Raycast — window management (Meh = ⌥⌃⇧)

| Input | Action |
|:---:|:---|
| Meh + 1 | First fourth |
| Meh + 2 | Second fourth |
| Meh + 3 | Third fourth |
| Meh + 4 | Last fourth |
| Meh + 5 | Center |
| Meh + 6 | Center half |
| Meh + 7 | Center two-thirds |
| Meh + 8 | Maximize |

> Per-app `Meh + 1` overrides this — when an app rule defines `toResizeWindow`, it wins over Raycast's "first fourth".

### Homerow

| Chord | Action |
|:---:|:---|
| `f + j` | Hyper + ␣ — Click |
| `f + k` | Hyper + ⏎ — Scroll |

### Universal nav mixins (apply per app — see column above)

| Input | Action | Mixin |
|:---:|:---|:---|
| ⌃ + `h` / `l` | ⌘[ / ⌘] (back / forward) | `historyNavi` |
| ⌥ + `h` / `l` | ⌘⇧[ / ⌘⇧] (prev / next tab) | `tabNavi` |
| ⌘⌥⌃ + `h` / `l` | ⌃⇧⇥ / ⌃⇥ (prev / next switcher) | `switcher` |

---

## Hardware

### Apple keyboard (any non-Moonlander)

| Input | Output |
|:---:|:---|
| Tap ⇪ | ⎋ |
| Hold ⇪ | Enter [Hyper layer](#hyper-layer--hold--caps-lock) |
| ⇧ + ⇪ | ⇪ (real Caps Lock) |
| ›⌥ + ›⇧ | Hyper (⌘⌥⌃⇧) |
| ›⌘ + ›⇧ | Meh (⌥⌃⇧) |

### Moonlander (`vendor_id: 12951, product_id: 6505`)

| Input | Output |
|:---:|:---|
| ⇧ + ⎋ | ⇪ |
| ⇪ + ⎋ | ⇪ |
| Tap ‹⌃ | ⌘⇧␣ — next input source |

---

## Thresholds

| Setting | Value | Where |
|:---|:---:|:---|
| Duo-modifier simultaneous window | 50 ms | global `basic.simultaneous_threshold_milliseconds` |
| Duo-modifier hold-to-modifier | 150 ms | per chord (`utils.ts`) |
| Duo-modifier tap-alone timeout | 150 ms | per chord (`utils.ts`) |
| Duo-layer activation window | 50 ms | global `duo_layer.threshold_milliseconds` |
| Vim / Symbol / Digit layer notification | 250 ms | per layer `.threshold(250)` |
| Leader chord (`l + ;`) window | 250 ms | `mapSimultaneous([…], undefined, 250)` |
