const {spawn}=require('child_process');
(async()=>{
 const root='D:/для игры/feod/output/publish/oldgold-main-final-20261105';
 const server=await require('../output/fantasy/pages-compat/qa-static-server.cjs')(root);
 try{
  const child=spawn(process.execPath,['tools/check-pages-snapshot-20261105.cjs'],{cwd:'D:/для игры/feod',env:{...process.env,OLDGOLD_QA_URL:server.url},stdio:'inherit'});
  const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});
  if(code)process.exitCode=code;
 }finally{await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
