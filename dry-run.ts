import { execFileSync } from 'node:child_process'

/** Runs karabiner-config.ts in dry-run mode and returns the emitted complex_modifications. */
export function dryRunComplexModifications(): {
  parameters: Record<string, unknown>
  rules: any[]
} {
  let output = execFileSync('npx', ['tsx', 'karabiner-config.ts'], {
    env: { ...process.env, KARABINER_DRY_RUN: '1' },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  return JSON.parse(output).profiles[0].complex_modifications
}
