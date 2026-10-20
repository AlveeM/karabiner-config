/**
 * Generates cheatsheet.md from the rules karabiner-config.ts emits (dry run),
 * so the cheatsheet can't drift from the config.
 *
 *   npm run cheatsheet
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

type Json = any

const profile = JSON.parse(
  execFileSync('npx', ['tsx', 'karabiner-config.ts'], {
    env: { ...process.env, KARABINER_DRY_RUN: '1' },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }),
)
const rules: Json[] = profile.profiles[0].complex_modifications.rules
const rule = (description: string): Json => {
  let found = rules.find((r) => r.description === description)
  if (!found) throw new Error(`Rule not found: ${description}`)
  return found
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const keyNames: Record<string, string> = {
  semicolon: ';',
  comma: ',',
  period: '.',
  slash: '/',
  backslash: '\\',
  quote: "'",
  open_bracket: '[',
  close_bracket: ']',
  hyphen: '-',
  equal_sign: '=',
  grave_accent_and_tilde: '`',
  spacebar: '␣',
  return_or_enter: '⏎',
  escape: '⎋',
  tab: '⇥',
  delete_or_backspace: '⌫',
  delete_forward: '⌦',
  left_arrow: '←',
  right_arrow: '→',
  up_arrow: '↑',
  down_arrow: '↓',
  caps_lock: '⇪',
  left_command: '‹⌘',
  right_command: '›⌘',
  left_option: '‹⌥',
  right_option: '›⌥',
  left_control: '‹⌃',
  right_control: '›⌃',
  left_shift: '‹⇧',
  right_shift: '›⇧',
  page_up: 'PgUp',
  page_down: 'PgDn',
  volume_increment: 'Vol+',
  volume_decrement: 'Vol−',
  display_brightness_increment: 'Bright+',
  display_brightness_decrement: 'Bright−',
  play_or_pause: 'Play/Pause',
  fastforward: 'Fast-forward',
  rewind: 'Rewind',
}

const modifierSymbols: Record<string, string> = {
  command: '⌘',
  option: '⌥',
  control: '⌃',
  shift: '⇧',
  left_command: '‹⌘',
  right_command: '›⌘',
  left_option: '‹⌥',
  right_option: '›⌥',
  left_control: '‹⌃',
  right_control: '›⌃',
  left_shift: '‹⇧',
  right_shift: '›⇧',
}

/** US-layout characters produced by ⇧ + key, so symbols read as `!` not `⇧1`. */
const shifted: Record<string, string> = {
  '1': '!',
  '2': '@',
  '3': '#',
  '4': '$',
  '5': '%',
  '6': '^',
  '7': '&',
  '8': '*',
  '9': '(',
  '0': ')',
  '-': '_',
  '=': '+',
  '[': '{',
  ']': '}',
  '\\': '|',
  ';': ':',
  "'": '"',
  ',': '<',
  '.': '>',
  '/': '?',
  '`': '~',
}

function keyName(code: string): string {
  if (keyNames[code]) return keyNames[code]
  let keypad = code.match(/^keypad_(.+)$/)
  if (keypad) return keypad[1] === 'period' ? 'kp .' : `kp ${keypad[1]}`
  return code
}

function modifierString(mods: string[] = []): string {
  let set = new Set(mods.map((m) => m.replace(/^(left|right)_/, '')))
  if (set.size === 4) return 'Hyper'
  if (set.size === 3 && !set.has('command')) return 'Meh'
  return mods.map((m) => modifierSymbols[m] ?? m).join('')
}

const code = (s: string) => '`' + s.replace(/`/g, '` ` `') + '`'
const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ')

/** Describe a `from` (key or chord), including any mandatory modifiers. */
function describeFrom(from: Json): string {
  if (from.simultaneous) {
    return from.simultaneous.map((k: Json) => keyName(k.key_code)).join(' + ')
  }
  let mods = from.modifiers?.mandatory ?? []
  let key = keyName(from.key_code ?? from.pointing_button)
  return mods.length ? `${modifierString(mods)} + ${key}` : key
}

function describeShell(cmd: string): string {
  let app = cmd.match(/^open -a "?(.+?)"?\.app$/)
  if (app) return `Open ${app[1]}`
  let win = cmd.match(
    /^open -g raycast:\/\/extensions\/raycast\/window-management\/(.+)$/,
  )
  if (win) return `Window: ${win[1]}`
  let ext = cmd.match(/^open raycast:\/\/extensions\/(.+)$/)
  if (ext) return `Raycast: ${ext[1]}`
  let pane = cmd.match(
    /^open -b com\.apple\.systempreferences .*\/(\w+)\.prefPane$/,
  )
  if (pane) return `System Settings: ${pane[1]}`
  let url = cmd.match(/^open '?(https?:\/\/[^']+)'?$/)
  if (url) return `Open ${url[1]}`
  let paste = cmd.match(/set the clipboard to "(.+)"\n/)
  if (paste) return `Paste ${paste[1]}`
  if (cmd.includes('Notification Center')) return 'Clear notifications'
  if (cmd.includes('set position of frontWindow')) return 'Resize window'
  return `Shell: ${cmd.split('\n')[0].slice(0, 60)}`
}

/** Describe one `to` event, or '' for pure state plumbing (variables, notifications). */
function describeEvent(e: Json): string {
  if (e.key_code) {
    let mods = e.modifiers ?? []
    let shiftedChar =
      mods.length === 1 && mods[0] === 'shift'
        ? shifted[keyName(e.key_code)]
        : undefined
    if (shiftedChar) return shiftedChar
    return mods.length
      ? `${modifierString(mods)}${keyName(e.key_code)}`
      : keyName(e.key_code)
  }
  if (e.shell_command) return describeShell(e.shell_command)
  if (e.pointing_button) return 'Click'
  if (e.software_function) {
    let fn = e.software_function
    if (fn.set_mouse_cursor_position) {
      let { x, y, screen } = fn.set_mouse_cursor_position
      return `Cursor → ${x}, ${y} (screen ${screen})`
    }
    if (fn.iokit_power_management_sleep_system) return 'Sleep system'
  }
  return ''
}

/** Describe a list of `to` events; long runs of plain keys read as typed text. */
function describeEvents(events: Json[] = []): string {
  let parts = events.map(describeEvent).filter(Boolean)
  let plain =
    events.length > 3 && events.every((e) => e.key_code && !e.modifiers?.length)
  if (plain) return `Type ${events.map((e) => keyName(e.key_code)).join('')}`
  return parts.join(' ')
}

function describeConditions(conditions: Json[] = []): string {
  let apps = conditions
    .filter((c) => c.type === 'frontmost_application_if')
    .flatMap((c) => c.bundle_identifiers)
    .map((id: string) => id.replace(/^\^|\$$/g, '').replace(/\\\./g, '.'))
  return apps.length ? ` (in ${apps.join(', ')})` : ''
}

function table(headers: string[], rows: string[][]): string {
  let align = headers.map(() => ':---')
  let lines = [
    `| ${headers.join(' | ')} |`,
    `| ${align.join(' | ')} |`,
    ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`),
  ]
  return lines.join('\n')
}

const varCondition = (m: Json, name: string): Json =>
  (m.conditions ?? []).find(
    (c: Json) => c.type === 'variable_if' && c.name === name,
  )

const notificationText = (m: Json, id: string): string | undefined =>
  (m.to ?? []).find((e: Json) => e.set_notification_message?.id === id)
    ?.set_notification_message.text

/** "a_App e_Emoji" → [['a', 'App'], ['e', 'Emoji']] */
const parseHint = (hint: string): Array<[string, string]> =>
  hint.split(' ').map((s) => [s[0], s.slice(2)])

/** Rows for manipulators that map a key to a visible action. */
function actionRows(manipulators: Json[]): string[][] {
  return manipulators
    .filter((m) => m.from.key_code || m.from.simultaneous)
    .map((m) => [
      code(describeFrom(m.from)),
      describeEvents(m.to) + describeConditions(m.conditions),
    ])
    .filter(([, action]) => action !== '')
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function sectionDuoModifiers(): string {
  let byModifier = new Map<string, { left?: string; right?: string }>()
  for (let m of rule('duo-modifiers').manipulators) {
    let keys = m.from.simultaneous.map((k: Json) => keyName(k.key_code))
    let side: 'left' | 'right' = m.to[0].key_code.startsWith('right_')
      ? 'right'
      : 'left'
    let modifier = m.to_if_held_down.find(
      (e: Json) => e.set_notification_message,
    ).set_notification_message.text
    let entry = byModifier.get(modifier) ?? {}
    // Each chord is emitted in both orders; keep the first (declared) one.
    entry[side] ??= keys.join('')
    byModifier.set(modifier, entry)
  }
  let rows = [...byModifier].map(([mod, { left, right }]) => [
    mod,
    code(left ?? ''),
    code(right ?? ''),
  ])
  return `## Duo modifiers

Hold two keys (≤ 50 ms apart, ≥ 150 ms held) → modifier. Tap quickly → letters as typed. Either key order works. Left-hand chords emit left-side modifiers (\`‹⌘\`), right-hand chords emit right-side modifiers (\`›⌘\`).

${table(['Modifier', 'Left-hand chord', 'Right-hand chord'], rows)}`
}

function sectionLeader(): string {
  let manipulators: Json[] = rule('Leader Key').manipulators
  let trigger = manipulators.find((m) => m.from.simultaneous)!
  let top = parseHint(notificationText(trigger, 'leader')!)

  let blocks = top.map(([key, name]) => {
    let rows = actionRows(
      manipulators.filter(
        (m) => varCondition(m, 'leader')?.value === key && m.from.key_code,
      ),
    ).filter(([, action]) => action !== '')
    return `### \`${key}\` — ${name}\n\n${table(['Key', 'Action'], rows)}`
  })

  return `## Leader key

**Trigger:** \`l\` + \`;\` simultaneously (≤ 250 ms). Press a namespace key, then an action key. **Abort:** ⎋ or ⇪ at any time.

Namespaces: ${top.map(([k, n]) => `\`${k}\` ${n}`).join(' · ')}

${blocks.join('\n\n')}`
}

function sectionHyper(): string {
  let trigger = rule('Layer - hyper').manipulators[0]
  let top = parseHint(notificationText(trigger, 'layer-hyper')!)
  let manipulators: Json[] = rule('Hyper Layer').manipulators

  let blocks = top.map(([key, name]) => {
    let subVar = `hyper_sub_${key}`
    let rows = actionRows(
      manipulators.filter(
        (m) =>
          varCondition(m, subVar)?.value === 1 &&
          m.from.key_code &&
          !['escape', 'caps_lock'].includes(m.from.key_code),
      ),
    )
    return `### \`${key}\` — ${name}\n\n${table(['Key', 'Action'], rows)}`
  })

  return `## Hyper layer — hold ⇪ (Caps Lock)

Hold ⇪ to enter Hyper, then hold a sublayer key and tap a binding key. Release ⇪ to exit. **Tap ⇪ alone → ⎋.** **Abort:** ⎋ or ⇪.

Sublayers: ${top.map(([k, n]) => `\`${k}\` ${n}`).join(' · ')}

${blocks.join('\n\n')}`
}

const duoLayerTitles: Record<string, string> = {
  'DuoLayer f ;': 'Vim — hold `f` + `;`',
  'DuoLayer s ;': 'Symbol — hold `s` + `;`',
  'DuoLayer d ;': 'Digit and delete — hold `d` + `;`',
  'DuoLayer z x': 'Snippet — hold `z` + `x`',
}

function sectionDuoLayers(): string {
  let blocks = rules
    .filter((r) => r.description.startsWith('DuoLayer'))
    .map((r) => {
      let rows = actionRows(
        r.manipulators.filter((m: Json) => !m.from.simultaneous),
      )
      let title = duoLayerTitles[r.description] ?? r.description
      return `### ${title}\n\n${table(['Key', 'Action'], rows)}`
    })
  return `## Duo layers

Hold both trigger keys (≤ 250 ms apart), then tap a binding key.

${blocks.join('\n\n')}`
}

function sectionSystem(): string {
  let rows = actionRows(
    rule('Layer - system').manipulators.filter(
      (m: Json) => varCondition(m, 'system')?.value === 1,
    ),
  )
  return `## System layer — hold \`\` \` \`\`

${table(['Key', 'Action'], rows)}`
}

/** Plain from → to table for rules without layer state (tap modifiers become "Tap X"). */
function plainRows(manipulators: Json[]): string[][] {
  return manipulators.map((m) => {
    let alone = m.to_if_alone?.length ? describeEvents(m.to_if_alone) : ''
    let from = describeFrom(m.from)
    if (alone) return [`Tap ${code(from)}`, alone]
    return [code(from), describeEvents(m.to)]
  })
}

function sectionApps(): string {
  let appRules = rules.filter((r) =>
    r.manipulators.every((m: Json) =>
      (m.conditions ?? []).some(
        (c: Json) => c.type === 'frontmost_application_if',
      ),
    ),
  )
  let blocks = appRules.map((r) => {
    let ids = r.manipulators[0].conditions
      .filter((c: Json) => c.type === 'frontmost_application_if')
      .flatMap((c: Json) => c.bundle_identifiers)
      .map((id: string) => id.replace(/\\\./g, '.'))
    return `### ${r.description} (\`${ids.join(', ')}\`)\n\n${table(
      ['Input', 'Action'],
      plainRows(r.manipulators),
    )}`
  })
  return `## Per-app rules\n\n${blocks.join('\n\n')}`
}

function sectionGlobal(): string {
  let names = ['Window Management', 'Homerow']
  let blocks = names.map(
    (n) =>
      `### ${n}\n\n${table(['Input', 'Action'], plainRows(rule(n).manipulators))}`,
  )
  return `## Global bindings\n\n${blocks.join('\n\n')}`
}

function sectionHardware(): string {
  let blocks = ['Non-Moonlander Keyboards', 'Moonlander'].map(
    (n) =>
      `### ${n}\n\n${table(['Input', 'Action'], plainRows(rule(n).manipulators))}`,
  )
  return `## Hardware\n\n${blocks.join('\n\n')}`
}

// ---------------------------------------------------------------------------

const output = `# Karabiner Config — Cheatsheet

<!-- Generated by \`npm run cheatsheet\` from karabiner-config.ts. Do not edit by hand. -->

Complete binding reference, generated from the rules the config emits. For *why* anything works the way it does, see [\`user-guide.md\`](./user-guide.md).

> **Notation.** ‹X = left-side X, ›X = right-side X. **Hyper** = ⌘⌥⌃⇧. **Meh** = ⌥⌃⇧. \`Tap X\` = fires when X is pressed and released alone; held, X stays a modifier.

---

${[
  sectionDuoModifiers(),
  sectionLeader(),
  sectionHyper(),
  sectionDuoLayers(),
  sectionSystem(),
  sectionApps(),
  sectionGlobal(),
  sectionHardware(),
].join('\n\n---\n\n')}
`

writeFileSync('cheatsheet.md', output)
console.log(`Wrote cheatsheet.md (${output.split('\n').length} lines)`)
