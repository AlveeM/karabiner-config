/** Human-readable names for keys and events, shared by the cheatsheet generator and layer hints. */

type Json = any

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

export function keyName(code: string): string {
  if (keyNames[code]) return keyNames[code]
  let keypad = code.match(/^keypad_(.+)$/)
  if (keypad) return keypad[1] === 'period' ? 'kp .' : `kp ${keypad[1]}`
  return code
}

export function modifierString(mods: string[] = []): string {
  let set = new Set(mods.map((m) => m.replace(/^(left|right)_/, '')))
  if (set.size === 4) return 'Hyper'
  if (set.size === 3 && !set.has('command')) return 'Meh'
  return mods.map((m) => modifierSymbols[m] ?? m).join('')
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
export function describeEvent(e: Json): string {
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
export function describeEvents(events: Json[] = []): string {
  let parts = events.map(describeEvent).filter(Boolean)
  let plain =
    events.length > 3 && events.every((e) => e.key_code && !e.modifiers?.length)
  if (plain) return `Type ${events.map((e) => keyName(e.key_code)).join('')}`
  return parts.join(' ')
}
