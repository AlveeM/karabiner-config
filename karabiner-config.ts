import {
  duoLayer,
  ifApp,
  ifDevice,
  layer,
  map,
  mapSimultaneous,
  rule,
  to$,
  toApp,
  toKey,
  toMouseCursorPosition,
  toPaste,
  toPointingButton,
  toSleepSystem,
  withCondition,
  withMapper,
  withModifier,
  writeToProfile,
} from 'karabiner.ts'

import { createHyperLayer, createLeaderLayer } from './layer-engines.ts'
import disabledAppsJson from './disabled-apps.json' with { type: 'json' }
import links from './links.json' with { type: 'json' }

import {
  appCommons,
  duoModifiers,
  eventLabel,
  mapValues,
  raycastExt,
  raycastWin,
  tapModifiers,
  toResizeWindow,
  toClearNotifications,
  toSystemSetting,
  twoRowHint,
} from './utils.ts'

// Shared by the leader and hyper layers.
const apps = {
  c: 'Google Chrome',
  e: 'Zed', // Editor
  f: 'Finder',
  g: 'Gram',
  m: 'Spotify', // Music
  s: 'Slack',
  t: 'Ghostty', // Terminal
  v: 'zoom.us',
  w: 'Zen Browser',
  ';': 'System Settings',
}

// key -> [extension, label]
const raycastExtensions: { [key: string]: [string, string] } = {
  c: ['raycast/calendar/my-schedule', 'Calendar'],
  d: ['raycast/dictionary/define-word', 'Dictionary'],
  e: ['raycast/emoji-symbols/search-emoji-symbols', 'Emoji'],
  g: ['ricoberger/gitmoji/gitmoji', 'Gitmoji'],
  s: ['raycast/snippets/search-snippets', 'Snippets'],
  v: ['raycast/clipboard-history/clipboard-history', 'Clipboard'],
}

// Shared by the hyper `s`/`d` sublayers and the symbol/digit duo layers.
const toSymbol = {
  '!': toKey(1, '⇧'),
  '@': toKey(2, '⇧'),
  '#': toKey(3, '⇧'),
  $: toKey(4, '⇧'),
  '%': toKey(5, '⇧'),
  '^': toKey(6, '⇧'),
  '&': toKey(7, '⇧'),
  '*': toKey(8, '⇧'),
  '(': toKey(9, '⇧'),
  ')': toKey(0, '⇧'),

  '[': toKey('['),
  ']': toKey(']'),
  '{': toKey('[', '⇧'),
  '}': toKey(']', '⇧'),

  _: toKey('-', '⇧'),
  '+': toKey('=', '⇧'),

  '?': toKey('/', '⇧'),
}

// ! @ # $ % ^ & * ( )    _ +
// 1 2 3 4 5 6 7 8 9 0    - =
const symbolKeys = {
  y: '?',
  u: '}',
  i: ']',
  o: ')', // 0
  p: '%', // 5

  h: '^', // 6
  j: '{',
  k: '[',
  l: '(', // 9
  ';': '$', // 4

  n: '&', // 7
  m: '!', // 1
  ',': '@', // 2
  '.': '#', // 3

  ']': '*', // 8

  '␣': '_',
  '⏎': '+',
} as const

const digitKeys = [
  'n', //             // 0
  ...['m', ',', '.'], // 1 2 3
  ...['j', 'k', 'l'], // 4 5 6
  ...['u', 'i', 'o'], // 7 8 9
] as const

// + - * . and delete keys
const toDigitExtras = {
  p: toKey('=', '⇧'), // +
  ';': toKey('-'), // -
  ']': toKey(8, '⇧'), // *
  '[': toKey('keypad_period'),

  '\\': toKey('⌦'),
  "'": toKey('⌫'),
  h: toKey('⌫', '⌥'),
  y: toKey('⌫', '⌘'),
}

const vimKeys = {
  h: toKey('←'),
  j: toKey('↓'),
  k: toKey('↑'),
  l: toKey('→'),

  ';': toKey('›⇧'),
  d: toKey('‹⌘'),
  s: toKey('‹⌃'),
  a: toKey('‹⌥'),
}

const toDelete = { "'": toKey('⌫'), '\\': toKey('⌦') }

// Per-app rules, keyed by the names accepted in disabled-apps.json.
const appRules = {
  chrome: app_chrome,
  safari: app_safari,
  jetbrains: app_jetBrainsIDE,
  zed: app_zed,
  vscode: app_vsCode,
  slack: app_slack,
  zoom: app_zoom,
}

/**
 * App rules minus those listed in disabled-apps.json. Dry runs (snapshot,
 * cheatsheet) set KARABINER_ALL_APPS to include every app.
 */
function enabledAppRules() {
  let disabledApps: string[] = disabledAppsJson
  let names = Object.keys(appRules)
  let unknown = disabledApps.filter((n) => !names.includes(n))
  if (unknown.length) {
    throw new Error(
      `Unknown app(s) in disabled-apps.json: ${unknown.join(', ')}. Valid: ${names.join(', ')}`,
    )
  }
  let disabled = process.env.KARABINER_ALL_APPS ? [] : disabledApps
  if (disabled.length)
    console.error(`Skipping app rules: ${disabled.join(', ')}`)
  return Object.entries(appRules)
    .filter(([name]) => !disabled.includes(name))
    .map(([, build]) => build())
}

function main(target: string) {
  writeToProfile(
    target,
    [
      rule_duoModifiers(),
      rule_leaderKey(),
      ...rule_hyperLayer(),

      layer_vim(),
      layer_symbol(),
      layer_digitAndDelete(),
      layer_snippet(),
      layer_system(),

      ...enabledAppRules(),

      windowManagement(),
      app_homerow(),

      keyboard_nonMoonlander(),
      keyboard_moonlander(),
    ],
    {
      'basic.simultaneous_threshold_milliseconds': 50,
      'duo_layer.threshold_milliseconds': 50,
      'duo_layer.notification': true,
    },
  )
}

function rule_duoModifiers() {
  return rule('duo-modifiers').manipulators(
    duoModifiers({
      '⌘': ['fd', 'jk'], // ⌘ first as used the most
      '⌃': ['fs', 'jl'], // ⌃ second as Vim uses it
      '⌥': ['fa', 'j;'], // ⌥ last as used the least

      '⇧': ['ds', 'kl'],

      '⌘⇧': ['gd', 'hk'],
      '⌃⇧': ['gs', 'hl'],
      '⌥⇧': ['ga', 'h;'],

      '⌘⌥': ['vc', 'm,'],
      '⌘⌃': ['vx', 'm.'],
      '⌥⌃': ['cx', ',.'],

      '⌘⌥⌃': ['vz', 'm/'],
    }),
  )
}

function rule_leaderKey() {
  return createLeaderLayer({
    a: {
      name: 'App',
      mapping: apps,
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
      mapping: links,
      action: (x) => to$(`open '${x}'`),
    },
    r: {
      name: 'Raycast',
      mapping: raycastExtensions,
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

function rule_hyperLayer() {
  return createHyperLayer({
    o: {
      name: 'Open',
      mapping: mapValues(apps, (app) => toApp(app)),
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
        u: toKey('⇥', '›⌃⇧'),
        i: toKey('⇥', '›⌃'),
        n: toKey('`', '›⌘'),
        b: toKey('[', '›⌘'),
        m: toKey(']', '›⌘'),
        ',': toKey('-', '›⌘'),
        '.': toKey('=', '›⌘'),
      },
    },
    x: {
      name: 'System',
      mapping: {
        u: toKey('volume_increment'),
        j: toKey('volume_decrement'),
        i: toKey('display_brightness_increment'),
        k: toKey('display_brightness_decrement'),
        l: toKey('q', '›⌘⌃'),
        p: toKey('play_or_pause'),
        ';': toKey('fastforward'),
        e: raycastExt('thomas/elgato-key-light/toggle'),
        d: raycastExt('yakitrak/do-not-disturb/toggle'),
        t: raycastExt('raycast/system/toggle-system-appearance'),
        c: raycastExt('raycast/system/open-camera'),
        v: toKey('␣', '‹⌥'),
      },
    },
    s: {
      name: 'Symbol',
      mapping: {
        ...mapValues(symbolKeys, (v) => toSymbol[v]),
        "'": toKey('⌫'),
      },
    },
    d: {
      name: 'Digit',
      mapping: {
        ...Object.fromEntries(
          digitKeys.map((k, i) => [k, toKey(`keypad_${i as 0}`)]),
        ),
        ...toDigitExtras,
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
        d: toKey('d', '›⌘⇧'),
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
        ...mapValues(raycastExtensions, ([ext]) => raycastExt(ext)),
        w: raycastExt('raycast/navigation/switch-windows'),
      },
    },
    '␣': {
      name: 'Symbol2',
      mapping: {
        q: toKey(1, '⇧'),
        w: toKey(2, '⇧'),
        e: toKey(3, '⇧'),
        r: toKey(4, '⇧'),
        t: toKey(5, '⇧'),
        y: toKey(6, '⇧'),
        u: toKey(7, '⇧'),
        i: toKey(8, '⇧'),
        o: toKey(9, '⇧'),
        p: toKey(0, '⇧'),

        a: toKey('`'),
        s: toKey('-', '⇧'),
        d: toKey('`', '⇧'),
        f: toKey('[', '⇧'),
        g: toKey('['),
        h: toKey(']'),
        j: toKey(']', '⇧'),
        k: toKey('-'),
        l: toKey('='),
        ';': toKey('\\', '⇧'),
        "'": toKey('⌫'),

        z: toKey(1),
        x: toKey(2),
        c: toKey(3),
        v: toKey(4),
        b: toKey(5),
        n: toKey(6),
        m: toKey(7),
        ',': toKey(8),
        '.': toKey(9),
        '/': toKey(0),
      },
    },
  })
}

function layer_vim() {
  let hint = twoRowHint(
    [
      ['h', 'j', 'k', 'l'],
      ['a', 's', 'd', ';'],
      ["'", '\\'],
    ],
    (k) => eventLabel({ ...vimKeys, ...toDelete }[k as 'h']),
  )
  let layer = duoLayer('f', ';').threshold(250).notification(hint)
  return layer.manipulators([
    withModifier('??')({
      h: toKey('←'),
      j: toKey('↓'),
      k: toKey('↑'),
      l: toKey('→'),

      ';': toKey('›⇧'),
      d: toKey('‹⌘'),
      s: toKey('‹⌃'),
      a: toKey('‹⌥'),
    }),

    { "'": toKey('⌫'), '\\': toKey('⌦') },
  ])
}

function layer_symbol() {
  let hint = twoRowHint(
    [
      ['n', 'm', ',', '.'],
      ['h', 'j', 'k', 'l', ';'],
      ['y', 'u', 'i', 'o', 'p'],
      [']'],
      ['␣', '⏎'],
      ["'"],
    ],
    (k) => (k === "'" ? '⌫' : symbolKeys[k as keyof typeof symbolKeys]),
  )

  let layer = duoLayer('s', ';').threshold(250).notification(hint)
  return layer.manipulators([
    withMapper(symbolKeys)((k, v) => map(k).to(toSymbol[v])),

    { "'": toKey('⌫') },
  ])
}

function layer_digitAndDelete() {
  let hint = twoRowHint(
    [
      ['n', 'm', ',', '.'],
      ['j', 'k', 'l'],
      ['u', 'i', 'o'],
      ['p', ';', '/', ']'],
      ['['],
      ["'", 'h', 'y'],
      ['\\'],
    ],
    (k) => {
      let digit = digitKeys.indexOf(k as (typeof digitKeys)[number])
      if (digit >= 0) return String(digit)
      if (k === '/') return '/' // not remapped, passes through
      if (k === '[') return '.'
      return eventLabel(toDigitExtras[k as keyof typeof toDigitExtras])
    },
  )
  let layer = duoLayer('d', ';').threshold(250).notification(hint)
  return layer.manipulators([
    // digits keypad_{i}
    withMapper(digitKeys)((k, i) => map(k).to(`keypad_${i as 0}`)),

    toDigitExtras,

    // F1 - F9
    withMapper([1, 2, 3, 4, 5, 6, 7, 8, 9])((k) => map(k).to(`f${k}`)),
  ])
}

function layer_snippet() {
  return duoLayer('z', 'x').manipulators([
    { 2: toPaste('⌫'), 3: toPaste('⌦'), 4: toPaste('⇥'), 5: toPaste('⎋') },
    { 6: toPaste('⌘'), 7: toPaste('⌥'), 8: toPaste('⌃'), 9: toPaste('⇧') },
    { 0: toPaste('⇪'), ',': toPaste('‹'), '.': toPaste('›') },

    withMapper(['←', '→', '↑', '↓', '␣', '⏎', '⌫', '⌦'])((k) =>
      map(k).toPaste(k),
    ),

    withCondition(ifApp('^com\\.microsoft\\.VSCode$'))([
      map('k').to('f20').to('k'),
      map('l').to('f20').to('l'),
    ]),
    withCondition(ifApp('^com\\.jetbrains\\.WebStorm$'))([
      map('k').toTypeSequence('afun'),
    ]),
    map('k').toTypeSequence('()␣=>␣'),
    map('l').toTypeSequence('console.log()←'),
    map('o').toTypeSequence('console.assert()←'),
    map('/').toTypeSequence('cn()←'),

    map("'").toTypeSequence('⌫"'),
    map('[').toTypeSequence('[␣]␣'),
    map(']').toTypeSequence('-␣[␣]␣'),

    { '\\': toKey('⌦') },
  ])
}

function layer_system() {
  return layer('`', 'system').manipulators({
    1: toMouseCursorPosition({ x: '25%', y: '50%', screen: 0 }),
    2: toMouseCursorPosition({ x: '50%', y: '50%', screen: 0 }),
    3: toMouseCursorPosition({ x: '75%', y: '50%', screen: 0 }),
    4: toMouseCursorPosition({ x: '99%', y: 20, screen: 0 }),

    5: toMouseCursorPosition({ x: '50%', y: '50%', screen: 1 }),

    '⏎': toPointingButton('button1'),

    n: toClearNotifications,

    '␣': toSleepSystem(),

    j: toKey('⇥', '⌘'),
    k: toKey('⇥', '⌘⇧'),
  })
}

function app_chrome() {
  return rule('Chrome', ifApp('^com\\.google\\.Chrome$')).manipulators(
    appCommons({
      history: true,
      tab: true,
      switcher: true,
      taps: {
        '‹⌥': [toKey('r', '⌘'), 'Refresh the page'],

        '›⌘': [toKey('i', '⌘⌥'), 'Developer tools'],
        '›⌥': [toKey('a', '⌘⇧'), 'Search tabs'],
      },
    }),
  )
}

function app_safari() {
  return rule('Safari', ifApp('^com\\.apple\\.Safari$')).manipulators(
    appCommons({
      history: true,
      tab: true,
      switcher: true,
      taps: {
        '‹⌘': [toKey('l', '⌘⇧'), 'Show/hide sidebar'],
        '‹⌥': [toKey('r', '⌘'), 'Reload page'],

        '›⌘': [toKey('i', '⌘⌥'), 'Show web inspector'],
      },
    }),
  )
}

function app_jetBrainsIDE() {
  return rule(
    'JetBrains IDE',
    ifApp('^com\\.jetbrains\\.[\\w-]+$'),
  ).manipulators(
    appCommons({
      history: true,
      tab: true,
      switcher: true,
      taps: {
        '‹⌘': [toKey('⎋', '⌘⇧'), 'Hide all tool windows'],
        '‹⌥': [toKey('r', '⌥⇧'), 'Run'],
        '‹⌃': [toKey('r', '⌥⌃'), 'Run...'],

        '›⌘': [toKey(4, '⌥'), 'Terminal tool window'],
        '›⌥': [toKey('a', '⌘⇧'), 'Find action'],
        '›⌃': [toKey('e', '⌘'), 'Recent files'],
      },
      appendExtras: [map('⎋', '⌘').to('⎋', '⌘⇧')],
    }),
  )
}

function app_zed() {
  return rule('Zed', ifApp('^dev\\.zed\\.Zed$')).manipulators(
    appCommons({
      history: true,
      tab: true,
      switcher: true,
      taps: {
        '‹⌘': [toKey('⎋', '⌘⇧'), 'Close all docks'],
        '‹⌥': [toKey('t', '⌥'), 'Rerun task'],
        '‹⌃': [toKey('t', '⌥⇧'), 'Spawn task'],

        '›⌘': [toKey('`', '⌃'), 'Terminal'],
        '›⌥': [toKey('a', '⌘⇧'), 'Command palette'],
        '›⌃': [toKey('p', '⌘'), 'File finder'],
      },
      appendExtras: [map('⎋', '⌘').to('⎋', '⌘⇧')],
    }),
  )
}

function app_vsCode() {
  return rule('VSCode', ifApp('^com\\.microsoft\\.VSCode$')).manipulators(
    appCommons({
      tab: true,
      switcher: true,
      prependExtras: [map('h', '⌃').to('-', '⌃'), map('l', '⌃').to('-', '⌃⇧')],
      taps: {
        '‹⌘': [toKey('⎋', '⌘'), 'Toggle sidebar'],
        '‹⌥': [toKey('r', '⌥⇧'), 'Run'],

        '›⌘': [toKey('`', '⌃'), 'Terminal'],
        '›⌥': [toKey('p', '⌘⇧'), 'Command palette'],
        '›⌃': [toKey('p', '⌘'), 'Quick open file'],
      },
    }),
  )
}

function app_slack() {
  return rule('Slack', ifApp('^com\\.tinyspeck\\.slackmacgap$')).manipulators(
    appCommons({
      history: true,
      taps: {
        '‹⌘': [toKey('d', '⌘⇧'), 'Show/hide sidebar'],
        '‹⌥': [toKey('f6'), 'Focus next section'],

        '›⌘': [toKey('.', '⌘'), 'Hide right bar'],
        '›⌥': [toKey('k', '⌘'), 'Open quick switcher'],
      },
      // After the 1/4 width, leave some space for opening thread in a new
      // window before the last 1/4 width
      appendExtras: [
        map(1, 'Meh').to(toResizeWindow({ x: 0.25, w: 0.34, top: 25 })),
      ],
    }),
  )
}

function app_zoom() {
  return rule('Zoom', ifApp('^us\\.zoom\\.xos$')).manipulators(
    appCommons({
      taps: {
        '‹⌘': [toKey('a', '⌘⇧'), 'Mute/unmute audio'],
        '‹⌥': [toKey('s', '⌘⇧'), 'Start/stop screen sharing'],

        '›⌘': [toKey('v', '⌘⇧'), 'Start/stop video'],
        '›⌥': [toKey('h', '⌘⇧'), 'Show/hide chat panel'],
      },
    }),
  )
}

function windowManagement() {
  return rule('Window Management').manipulators([
    withModifier('Hyper')({
      '↑': raycastWin('previous-display'),
      '↓': raycastWin('next-display'),
      '←': raycastWin('previous-desktop'),
      '→': raycastWin('next-desktop'),
    }),
    withModifier('Hyper')({
      1: raycastWin('first-third'),
      2: raycastWin('center-third'),
      3: raycastWin('last-third'),
      4: raycastWin('first-two-thirds'),
      5: raycastWin('last-two-thirds'),
      9: raycastWin('left-half'),
      0: raycastWin('right-half'),
    }),
    map(1, 'Meh').to(toResizeWindow()),
    withModifier('Meh')({
      2: raycastWin('second-fourth'),
      3: raycastWin('third-fourth'),
      4: raycastWin('last-fourth'),
      5: raycastWin('center'),
      6: raycastWin('center-half'),
      7: raycastWin('center-two-thirds'),
      8: raycastWin('maximize'),
    }),
  ])
}

function app_homerow() {
  return rule('Homerow').manipulators([
    mapSimultaneous(['f', 'j']).to('␣', 'Hyper'), // Click
    mapSimultaneous(['f', 'k']).to('⏎', 'Hyper'), // Scroll
  ])
}

function keyboard_nonMoonlander() {
  let ifNotMoonlander = ifDevice({ vendor_id: 12951 }).unless()
  return rule('Non-Moonlander Keyboards', ifNotMoonlander).manipulators([
    map('⇪', '⇧').to('⇪'),

    map('›⌥', '›⇧').toHyper(),
    map('›⌘', '›⇧').toMeh(),
  ])
}

function keyboard_moonlander() {
  let ifMoonlander = ifDevice({ vendor_id: 12951, product_id: 6505 })
  return rule('Moonlander', ifMoonlander).manipulators([
    map('⎋', '⇧').to('⇪'),

    ...tapModifiers({
      '‹⌃': [toKey('␣', '⌘⇧'), 'Next input source'],
    }),
  ])
}

main(process.env.KARABINER_DRY_RUN ? '--dry-run' : 'Default')
