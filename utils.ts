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

import { describeEvents } from './describe.ts'

/** Back/Forward history in most apps. */
export function historyNavi() {
  return [
    map('h', '⌃').to('[', '⌘'), //
    map('l', '⌃').to(']', '⌘'),
  ]
}

/** Pre/Next tab in most apps. */
export function tabNavi() {
  return [
    map('h', '⌥').to('[', '⌘⇧'), //
    map('l', '⌥').to(']', '⌘⇧'),
  ]
}

/** Pre/Next switcher in most apps. */
export function switcher() {
  return [
    map('h', '⌘⌥⌃').to('⇥', '⌃⇧'), //
    map('l', '⌘⌥⌃').to('⇥', '⌃'),
  ]
}

/**
 * Map when tap a modifier key; keep as modifier when hold. A value can be
 * `[event, description]`; the description is shown in the cheatsheet.
 *
 * - ‹⌘ Show/Hide UI (e.g. left sidebars, or all UI)
 * - ‹⌥ Run current task (re-run)
 * - ‹⌃ Run list
 *
 * - ›⌘ Show/Hide UI (e.g. right sidebars, or terminal)
 * - ›⌥ Command Palette (e.g. ⌘K, ⌘P)
 * - ›⌃ History (e.g. recent files)
 */
export function tapModifiers(
  v: Partial<Record<SideModifierAlias | 'fn', ToEvent | [ToEvent, string]>>,
) {
  return Object.entries(v).map(([k, entry]) => {
    let key = k as SideModifierAlias | 'fn'
    let [to, description] = Array.isArray(entry) ? entry : [entry]
    let manipulator = map(key).to(key).toIfAlone(to)
    return description ? manipulator.description(description) : manipulator
  })
}

const rightHandKeys = new Set('yuiophjklnm;,./')

/** Modifiers via 2 keys. e.g. f+d -> ⌘ (left hand -> left-side, right hand -> right-side modifier) */
export function duoModifiers(
  v: Partial<
    Record<
      '⌘' | '⌥' | '⌃' | '⇧' | MultiModifierAlias,
      `${LetterKeyCode | KeyAlias}${LetterKeyCode | KeyAlias}`[]
    >
  >,
) {
  let result: ManipulatorBuilder[] = []

  for (let [m, k] of Object.entries(v)) {
    for (let keys of k) {
      // Intentionally `k` (the whole pair list), not `keys`: both hands' chords
      // for a modifier share one notification slot, so only one indicator shows.
      let id = k + m
      let [firstMod, ...restMods] = (
        m in modifierKeyAliases
          ? [modifierKeyAliases[m as ModifierKeyAlias]]
          : multiModifierAliases[m as MultiModifierAlias]
      ) as Array<'command' | 'control' | 'option' | 'shift'>

      const keyArray = keys.split('') as (LetterKeyCode | KeyAlias)[]
      const side = rightHandKeys.has(keyArray[0]) ? 'right' : 'left'
      const modifierAction = `${side}_${firstMod}` as const
      const sideRestMods = restMods.map((x) => `${side}_${x}` as const)

      for (const orderedKeys of [keyArray, keyArray.toReversed()]) {
        result.push(
          mapSimultaneous(orderedKeys, {
            key_down_order: 'strict',
            to_after_key_up: [toRemoveNotificationMessage(id)],
          })
            .to(modifierAction, sideRestMods, { lazy: true })
            .toIfHeldDown([
              toNotificationMessage(id, m),
              toKey(modifierAction, sideRestMods),
            ])
            .toIfAlone(orderedKeys.map((x) => toKey(x)))
            .parameters({
              'basic.to_if_held_down_threshold_milliseconds': 150,
              'basic.to_if_alone_timeout_milliseconds': 150,
            }),
        )
      }
    }
  }

  return result
}

export function raycastExt(name: string) {
  return to$(`open raycast://extensions/${name}`)
}

export function raycastWin(name: string) {
  return to$(`open -g raycast://extensions/raycast/window-management/${name}`)
}

type ResizeOptions = {
  /** Left edge, as a fraction of the screen width. */
  x?: number
  /** Window width, as a fraction of the screen width. */
  w?: number
  /** Top edge in px, e.g. to leave room for the menu bar or widgets. */
  top?: number
}

/**
 * Resize the frontmost app's first window to a full-height column on the main
 * screen. The window runs from `top` to the bottom of the screen; defaults to
 * the first 1/4 width, below widgets.
 */
export function toResizeWindow({
  x = 0,
  w = 1 / 4,
  top = 220,
}: ResizeOptions = {}) {
  return to$(`osascript -e '\
tell application "Finder" to set screenBounds to bounds of window of desktop
set screenWidth to item 3 of screenBounds
set screenHeight to item 4 of screenBounds

tell application "System Events"
  set frontProcess to first process whose frontmost is true
  tell frontProcess
    set frontWindow to first window
    set position of frontWindow to {(screenWidth * ${x}) as integer, ${top}}
    set size of frontWindow to {(screenWidth * ${w}) as integer, screenHeight - ${top}}
  end tell
end tell'`)
}

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

/** @see https://gist.github.com/lancethomps/a5ac103f334b171f70ce2ff983220b4f?permalink_comment_id=4698498#gistcomment-4698498 */
export let toClearNotifications = to$(`osascript -e '\
tell application "System Events"
  try
    repeat
      set _groups to groups of UI element 1 of scroll area 1 of group 1 of window "Notification Center" of application process "NotificationCenter"
      set numGroups to number of _groups
      if numGroups = 0 then
        exit repeat
      end if
      repeat with _group in _groups
        set _actions to actions of _group
        set actionPerformed to false
        repeat with _action in _actions
          if description of _action is in {"Clear All", "Close"} then
            perform _action
            set actionPerformed to true
            exit repeat
          end if
        end repeat
        if actionPerformed then
          exit repeat
        end if
      end repeat
    end repeat
  end try
end tell'`)

export function toSystemSetting(pane: string) {
  let path = `/System/Library/PreferencePanes/${pane}.prefPane`
  return to$(`open -b com.apple.systempreferences ${path}`)
}

export function mapValues<T, U>(
  obj: Record<string, T>,
  fn: (v: T) => U,
): Record<string, U> {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(v)]))
}

/**
 * Two-row layer hint: labels on top, keys below, each column padded to its
 * widest cell. Groups are separated by a wider gap (e.g. one per keyboard row).
 */
export function twoRowHint(
  groups: string[][],
  label: (key: string) => string,
): string {
  let top: string[] = []
  let bottom: string[] = []
  for (let group of groups) {
    let columns = group.map((key) => {
      let l = label(key)
      let k = key.toUpperCase()
      let width = Math.max(l.length, k.length)
      return { l: l.padEnd(width), k: k.padEnd(width) }
    })
    top.push(columns.map((c) => c.l).join(' '))
    bottom.push(columns.map((c) => c.k).join(' '))
  }
  return `${top.join('   ')}\n${bottom.join('   ')}`
}

/** Label for a to-event (or list) as shown in hints. */
export function eventLabel(to: ToEvent | ToEvent[]): string {
  return describeEvents(Array.isArray(to) ? to : [to])
}
