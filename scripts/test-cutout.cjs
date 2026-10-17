const { buildSync } = require('esbuild')
const { mkdtempSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const temp = mkdtempSync(join(tmpdir(), 'naraflow-cutout-test-'))
try {
  const out = join(temp, 'cutout-timeline.cjs')
  buildSync({ entryPoints: [join(__dirname, '../tests/cutout-timeline.test.ts')], outfile: out, bundle: true, platform: 'node', format: 'cjs', logLevel: 'warning' })
  require(out)
} finally {
  rmSync(temp, { recursive: true, force: true })
}
