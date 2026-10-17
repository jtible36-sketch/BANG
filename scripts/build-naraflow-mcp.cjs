const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const esbuild = require('esbuild')
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'naraflow-mcp-catalog-'))
try {
  const outfile = path.join(folder, 'catalog.cjs')
  esbuild.buildSync({ entryPoints: [path.join(__dirname, '../src/shared/naraflow-mcp-tools.ts')], outfile, bundle: true, platform: 'node', format: 'cjs' })
  const { naraflowMcpTools } = require(outfile)
  fs.writeFileSync(path.join(__dirname, '../resources/naraflow-mcp/tools.json'), JSON.stringify({ tools: naraflowMcpTools() }, null, 2) + '\n')
  console.log('Naraflow MCP catalog ready.')
} finally { fs.rmSync(folder, { recursive: true, force: true }) }
