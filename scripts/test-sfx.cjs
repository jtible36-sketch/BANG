const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { createRequire } = require('node:module')
const appRoot = path.resolve(__dirname, '..')
const appRequire = createRequire(path.join(appRoot, 'package.json'))
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'naraflow-sfx-test-'))
process.env.SFX_TEST_DATA = tempRoot
process.env.SFX_TEST_FFMPEG = appRequire('ffmpeg-static')
const outfile = path.join(tempRoot, 'test.cjs')
async function main() {
  try {
    await appRequire('esbuild').build({ entryPoints: [path.join(appRoot, 'tests/sfx.test.ts')], outfile,
      platform: 'node', format: 'cjs', bundle: true, logLevel: 'warning', alias: { '@shared': path.join(appRoot, 'src/shared') },
      plugins: [{ name: 'isolated-sfx-runtime', setup(build) {
        build.onResolve({ filter: /^electron$/ }, () => ({ path: 'electron', namespace: 'test-runtime' }))
        build.onLoad({ filter: /^electron$/, namespace: 'test-runtime' }, () => ({ contents: `export const app = { getPath: () => process.env.SFX_TEST_DATA, getAppPath: () => ${JSON.stringify(appRoot)}, isPackaged: false };`, loader: 'js' }))
        build.onResolve({ filter: /^better-sqlite3$/ }, () => ({ path: appRequire.resolve('better-sqlite3'), external: true }))
      } }]
    })
    require(outfile)
  } finally {
    globalThis.closeSfxTestDb?.()
    delete globalThis.closeSfxTestDb
    // Remove only the exact directory allocated for this test, never the user's data folder.
    const target = path.resolve(tempRoot)
    if (path.dirname(target) !== path.resolve(os.tmpdir()) || !path.basename(target).startsWith('naraflow-sfx-test-')) throw new Error('Unsafe test cleanup path')
    fs.rmSync(target, { recursive: true, force: true })
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
