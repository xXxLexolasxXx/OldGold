const fs=require('fs'),path=require('path'),crypto=require('crypto');const {chromium}=require('D:/для игры/feod/tools/browsers/node_modules/playwright-core');const serve=require('./qa-static-server.cjs');
const root='D:/для игры/feod/output/publish/oldgold-pages-20261104';
(async()=>{const s=await serve(root),b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const context=await b.newContext({serviceWorkers:'block'});await context.route(/\/js\/fantasy-(neutral|leshy)-polish\.js$/,r=>r.fulfill({status:200,contentType:'application/javascript',body:'/* optional polish absent for cold native anchor capture */'}));const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(s.url,{waitUntil:'load'});await p.addScriptTag({url:s.url+'/js/fantasy-published-forest-neutrals.js'});
 const result=await p.evaluate(()=>{Game.paused=true;const A=FantasyForestNeutrals,rows=[],failures=[];A.clear();
 for(const kind of ['pixie','fairy','leshy'])for(const fr of (kind==='leshy'?['i0','w3','a6','p2','h2','d3','v2','r4']:['i0','w3','a6','p2','h2','d3','v2','c4','k4','z3'])){
  const S=NA_SPEC[kind],cv=document.createElement('canvas');cv.width=S.w*4;cv.height=S.h*4;const c=cv.getContext('2d');c.scale(4,4);c.translate(S.ax,S.ay);c.scale(S.sc||1,S.sc||1);const expected=[];
  function point(ctx,x,y,label){const m=ctx.getTransform();expected.push({label,x:(m.a*x+m.c*y+m.e)/4-S.ax,y:(m.b*x+m.d*y+m.f)/4-S.ay});}
  const arm=naArm,oval=ellipse;
  naArm=function(ctx,...args){const out=arm(ctx,...args);if(kind!=='leshy'&&(args[0]===.8||args[0]===-1.2))point(ctx,out[0],out[1],args[0]===.8?'nearHand':'farHand');return out;};
  ellipse=function(ctx,x,y,rx,ry,...args){if(kind==='leshy'){if(rx===2.1&&ry===2)point(ctx,x,y,'nearHand');if(rx===1.9&&ry===1.8)point(ctx,x,y,'farHand');if(rx===1.6&&ry===1.6)point(ctx,x,y,'staffFX');}else if(rx===1.3&&ry===1.3)point(ctx,x,y,'wandFX');return oval(ctx,x,y,rx,ry,...args);};
  try{const P=naPose(fr);P.pal=S.pal||null;(kind==='leshy'?drawLeshy:drawFairy)(c,P);}finally{naArm=arm;ellipse=oval;}
  if(expected.length!==3)failures.push({kind,fr,reason:'cold native anchor count',count:expected.length});
  for(const dir of A.headings){const trace=[],lineTo=CanvasRenderingContext2D.prototype.lineTo;let sp;
   CanvasRenderingContext2D.prototype.lineTo=function(x,y){const m=this.getTransform();trace.push({cv:this.canvas,x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f});return lineTo.call(this,x,y);};
   try{sp=A.frame(kind,fr,dir);}finally{CanvasRenderingContext2D.prototype.lineTo=lineTo;}
   const mirror=['SW','W','NW'].includes(dir),points=trace.filter(x=>x.cv===sp.cv).map(x=>({x:x.x/2-sp.ax,y:x.y/2-sp.ay}));
   for(const wanted of expected){const x=wanted.x*(mirror?-1:1),y=wanted.y,min=Math.min(...points.map(p=>Math.hypot(p.x-x,p.y-y))),row={kind,fr,dir,anchor:wanted.label,error:min};rows.push(row);if(min>1e-7)failures.push(row);}
  }
 }
 return {checks:rows.length,maximumError:Math.max(...rows.map(x=>x.error)),failures,source:'actual cold drawFairy/drawLeshy naArm/ellipse anchors vs actual directional raster line endpoints',rows};});
 result.pageErrors=errors;result.moduleSHA256=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'js/fantasy-published-forest-neutrals.js'))).digest('hex');fs.writeFileSync(path.join(__dirname,'anchors.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({...result,rows:undefined}));
}finally{await b.close();await s.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

