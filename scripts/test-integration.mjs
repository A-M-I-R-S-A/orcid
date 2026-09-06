#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const database = process.env.TEST_DB_NAME ?? 'orchid_test'

if (!/test/i.test(database)) {
  console.error(`Refusing to run: "${database}" is not a test database name.`)
  process.exit(1)
}

const vitest = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url))

const child = spawn(
  process.execPath,
  [vitest, 'run', '--no-file-parallelism', 'tests/integration', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: { ...process.env, TEST_DB_NAME: database, DB_NAME: database },
  },
)

child.on('exit', (code) => process.exit(code ?? 1))
