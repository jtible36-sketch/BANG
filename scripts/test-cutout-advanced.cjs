const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),esbuild=require('esbuild')
const root=path.resolve(__dirname,'..'),folder=fs.mkdtempSync(path.join(os.tmpdir(),'naraflow-advanced-test-'))
try{const out=path.join(folder,'suite.cjs');esbuild.buildSync({entryPoints:[path.join(root,'tests/cutout-advanced.test.ts')],outfile:out,platform:'node',format:'cjs',bundle:true});require(out)}
finally{const real=fs.realpathSync(folder);if(path.dirname(real)===fs.realpathSync(os.tmpdir())&&path.basename(real).startsWith('naraflow-advanced-test-'))fs.rmSync(real,{recursive:true,force:true})}
