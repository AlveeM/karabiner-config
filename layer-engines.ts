import {
  type ConditionBuilder,
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

function hyperSubVar(key: string) {
  return `hyper_sub_${key}`
}

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
  let topHint = formatTopHint(subKeys.map((k) => ({ key: k, name: sublayers[k].name })))

  let layerRule = layer('⇪', 'hyper')
    .configKey((m) => m.toIfAlone(toKey('⎋')))
    .notification(topHint)

  let manipulators: ManipulatorBuilder[] = []

  // Sublayer activation: requires hyper=1 AND all other hyper_sub_*=0.
  for (let k of subKeys) {
    let sub = sublayers[k]
    let subHint = formatSubHint(sub.mapping, () => '')
    let subVar = hyperSubVar(k)
    let otherSubVars = subKeys.filter((o) => o !== k).map(hyperSubVar)

    // `map` typing rejects a generic string here; the runtime accepts any
    // letter/key so the cast is emit-erased and JSON-equivalent.
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

    // Sublayer bindings: each mapped letter fires action while sub var = 1.
    let entries = Object.keys(sub.mapping) as Array<Extract<keyof typeof sub.mapping, string>>
    manipulators.push(
      ...withCondition(ifVar(subVar, 1))(
        entries.map((letter) =>
          // Same reason as above: `map` typing rejects generic string.
          map(letter as any).to(sub.mapping[letter]),
        ),
      ),
    )
  }

  // Manual escape: ⎋ or ⇪ while top-level hyper held but no sub active -> unset hyper.
  manipulators.push(
    ...escapeBindings(
      [ifVar('hyper', 1), ...subKeys.map((k) => ifVar(hyperSubVar(k), 0))],
      ['hyper'],
    ),
  )

  // Manual escape inside any sublayer: ⎋ or ⇪ -> unset that sub var.
  for (let k of subKeys) {
    let subVar = hyperSubVar(k)
    manipulators.push(...escapeBindings(ifVar(subVar, 1), [subVar]))
  }

  return [layerRule, rule('Hyper Layer').manipulators(manipulators)] as const
}

/**
 * `l;` simultaneous-tap leader layer with nested sublayers.
 * Tap l+; together → top hint shown. Tap a sublayer key (a/e/g/l/r/s) →
 * sublayer hint shown. Tap a binding letter → action fires AND auto-escapes
 * back to inactive. Tap ⎋/⇪ at any active state → escape to inactive.
 */
export function createLeaderLayer(config: LeaderConfig): RuleBuilder {
  let _var = 'leader'
  let clearLeaderVar = [toUnsetVar(_var), toRemoveNotificationMessage(_var)]

  let keys = Object.keys(config) as Array<Extract<keyof LeaderConfig, string>>
  let topHint = formatTopHint(keys.map((k) => ({ key: k, name: config[k].name })))

  return rule('Leader Key').manipulators([
    // 0: Inactive -> Leader (1)
    withCondition(ifVar(_var, 0))([
      mapSimultaneous(['l', ';'], undefined, 250)
        .toVar(_var, 1)
        .toNotificationMessage(_var, topHint),
    ]),

    // 0.unless: Leader or NestedLeader -> Inactive (0)
    ...escapeBindings(ifVar(_var, 0).unless(), [_var]),

    // 1: Leader -> NestedLeader (🔤)
    withCondition(ifVar(_var, 1))(
      keys.map((k) => {
        let subHint = formatSubHint(config[k].mapping, (v) =>
          Array.isArray(v) ? v[1] : v,
        )
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
          return map(x).to(action(v)).to(clearLeaderVar)
        }),
      )
    }),
  ])
}
