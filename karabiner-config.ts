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

import {
  appCommons,
  appResize,
  duoModifiers,
  raycastExt,
  raycastWin,
  tapModifiers,
  toClearNotifications,
  toSystemSetting,
} from './utils.ts'

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

      app_chrome(),
      app_safari(),
      app_jetBrainsIDE(),
      app_zed(),
      app_vsCode(),
      app_cursor(),
      app_slack(),
      app_warp(),
      app_spark(),
      app_zoom(),
      app_chatGPT(),

      app_raycast(),
      app_homerow(),

      keyboard_apple(),
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

function rule_hyperLayer() {
  return createHyperLayer({
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
        u: toKey('⇥', '›⌃⇧'),
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
        c: raycastExt('raycast/calendar/my-schedule'),
        d: raycastExt('raycast/dictionary/define-word'),
        e: raycastExt('raycast/emoji-symbols/search-emoji-symbols'),
        g: raycastExt('ricoberger/gitmoji/gitmoji'),
        s: raycastExt('raycast/snippets/search-snippets'),
        v: raycastExt('raycast/clipboard-history/clipboard-history'),
      },
    },
  })
}

function layer_vim() {
  let hint = `\
←  ↓  ↑  →     ⌫
H  J    K   L       '`
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
  let hint = `\
&   !  @ #    ^   {  [   (  $      ?  }  ]   )  %      _   +      ⌫
N  M  ,   .    H  J  K  L  ;      Y  U  I  O  P       ␣  ⏎      '`

  let toSymbol = {
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

    '-': toKey('-'),
    '=': toKey('='),
    _: toKey('-', '⇧'),
    '+': toKey('=', '⇧'),

    ';': toKey(';'),
    '/': toKey('/'),
    ':': toKey(';', '⇧'),
    '?': toKey('/', '⇧'),

    ',': toKey(','),
    '.': toKey('.'),
    '<': toKey(',', '⇧'),
    '>': toKey('.', '⇧'),
  }

  let layer = duoLayer('s', ';').threshold(250).notification(hint)
  return layer.manipulators([
    withMapper({
      // ! @ # $ % ^ & * ( )    _ +
      // 1 2 3 4 5 6 7 8 9 0    - =

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
    } as const)((k, v) => map(k).to(toSymbol[v])),

    { "'": toKey('⌫') },
  ])
}

function layer_digitAndDelete() {
  let hint = `\
0    1  2  3    4  5  6    7  8  9    +  -  /  *    .    ⌫_⌥_⌘  ⌦
N   M  ,   .     J  K  L    U  I  O    P  ;   /  ]    [      '   H   Y    \\`
  let layer = duoLayer('d', ';').threshold(250).notification(hint)
  return layer.manipulators([
    // digits keypad_{i}
    withMapper([
      'n', //             // 0
      ...['m', ',', '.'], // 1 2 3
      ...['j', 'k', 'l'], // 4 5 6
      ...['u', 'i', 'o'], // 7 8 9
    ] as const)((k, i) => map(k).to(`keypad_${i as 0}`)),

    // + - / * .
    {
      p: toKey('=', '⇧'), // +
      ';': toKey('-'), // // -
      // / stay           // /
      ']': toKey(8, '⇧'), // *

      '[': toKey('keypad_period'),
    },

    // delete ⌫ ⌦
    {
      '\\': toKey('⌦'),

      "'": toKey('⌫'),
      h: toKey('⌫', '⌥'),
      y: toKey('⌫', '⌘'),
    },

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

    withCondition(ifApp('^com.microsoft.VSCode$'))([
      map('k').to('f20').to('k'),
      map('l').to('f20').to('l'),
    ]),
    withCondition(ifApp('^com.jetbrains.WebStorm$'))([
      map('k').toTypeSequence('afun'),
    ]),
    map('k').toTypeSequence('()␣=>␣'),
    map('l').toTypeSequence('console.log()←'),
    map('o').toTypeSequence('console.assert()←'),
    map('/').toTypeSequence('cn()←'),

    map("'").toTypeSequence('⌫"'),
    map('[').toTypeSequence('[␣]␣'),
    map(']').toTypeSequence('-␣[␣]␣'),

    { "'": toKey('⌫'), '\\': toKey('⌦') },
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

function app_raycast() {
  return rule('Raycast').manipulators([
    map('␣', '⌥').to(raycastExt('evan-liu/quick-open/index')),

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
    withModifier('Meh')({
      1: raycastWin('first-fourth'),
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

function keyboard_apple() {
  let ifAppleKeyboard = ifDevice({ vendor_id: 12951 }).unless() // Not Moonlander
  return rule('Apple Keyboard', ifAppleKeyboard).manipulators([
    map('⇪', '⇧').to('⇪'),

    map('›⌥', '›⇧').toHyper(),
    map('›⌘', '›⇧').toMeh(),
  ])
}

function keyboard_moonlander() {
  let ifMoonlander = ifDevice({ vendor_id: 12951, product_id: 6505 })
  return rule('Moonlander', ifMoonlander).manipulators([
    map('⎋', '⇧').to('⇪'),
    map('⎋', '⇪').to('⇪'),

    ...tapModifiers({
      '‹⌃': toKey('␣', '⌘⇧'), // selectNextSourceInInputMenu
    }),
  ])
}

main(process.env.KARABINER_DRY_RUN ? '--dry-run' : 'Default')
