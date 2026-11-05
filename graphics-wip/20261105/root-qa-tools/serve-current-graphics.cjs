const fs=require('fs');
(async()=>{
 const root='D:/для игры/feod/output/publish/oldgold-pages-20261104';
 const server=await require('../output/fantasy/pages-compat/qa-static-server.cjs')(root);
 const state={url:server.url+'/?graphics=1',base:server.url,root,pid:process.pid,mode:'local graphics preview; no release publication'};
 fs.writeFileSync('D:/для игры/feod/output/fantasy/current-graphics-preview.json',JSON.stringify(state,null,2));
 console.log(state.url);
})().catch(e=>{console.error(e);process.exit(1)});
