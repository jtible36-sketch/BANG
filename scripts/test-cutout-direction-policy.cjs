const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'..'),appRequire=createRequire(path.join(root,'package.json'));
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'naraflow-direction-policy-'));
try {
  const outfile=path.join(scratch,'policy.cjs');
  appRequire('esbuild').buildSync({entryPoints:[path.join(root,'tests/cutout-direction-policy.test.ts')],bundle:true,platform:'node',format:'cjs',outfile,tsconfig:path.join(root,'tsconfig.node.json')});
  require(outfile);
} finally {
  const real=fs.realpathSync(scratch),parent=fs.realpathSync(os.tmpdir());
  if(path.dirname(real)===parent&&path.basename(real).startsWith('naraflow-direction-policy-'))fs.rmSync(real,{recursive:true,force:true});
}
