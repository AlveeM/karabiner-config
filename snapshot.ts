/**
 * Snapshot of the rules karabiner-config.ts emits, one manipulator per line so
 * a config change shows up as a small diff.
 *
 *   npm run snapshot          write snapshot.json
 *   npm run snapshot:check    fail if snapshot.json is out of date
 */
import { readFileSync, writeFileSync } from 'node:fs'

import { dryRunComplexModifications } from './dry-run.ts'

const file = 'snapshot.json'

function serialize(): string {
  let { parameters, rules } = dryRunComplexModifications()
  let lines = rules.map((r) => {
    let manipulators = r.manipulators.map(
      (m: unknown) => `      ${JSON.stringify(m)}`,
    )
    return [
      '    {',
      `      "description": ${JSON.stringify(r.description)},`,
      '      "manipulators": [',
      manipulators
        .join(',\n')
        .replace(/^ {6}/, '        ')
        .replace(/\n {6}/g, '\n        '),
      '      ]',
      '    }',
    ].join('\n')
  })
  return `{\n  "parameters": ${JSON.stringify(parameters)},\n  "rules": [\n${lines.join(',\n')}\n  ]\n}\n`
}

let next = serialize()

if (process.argv.includes('--check')) {
  let current = ''
  try {
    current = readFileSync(file, 'utf8')
  } catch {}
  if (current !== next) {
    console.error(
      `${file} is out of date. Run \`npm run snapshot\` and commit it.`,
    )
    process.exit(1)
  }
  console.log(`${file} is up to date`)
} else {
  writeFileSync(file, next)
  console.log(`Wrote ${file}`)
}
