const fs=require('fs'),p=__dirname+'/verify-production-v4.cjs';let s=fs.readFileSync(p,'utf8');
s=s.replace("await p.goto(server.url+'/?haunts-v4-production=1'", "await p.addInitScript(()=>localStorage.setItem('oldgold-tut','done'));await p.goto(server.url+'/?haunts-v4-production=1'");
s=s.replace("if(kind!=='ban'&&Object.keys(o).join('|')!==keys)throw Error('Saved actor fields changed');}", "if(kind!=='ban'&&Object.keys(o).join('|')!==keys)throw Error('Saved actor fields changed');if(kind==='les'){o.state='calm';for(let i=0;i<8;i++){const v=vectors[i];o.gift={x:20+v[0]*3,y:20+v[1]*3};const d=A.headingOf(o);directions.push({kind:'les-gift',expected:A.headings[i],actual:d,match:d===A.headings[i]});}}}");
s=s.replace("smClose();R.cam.z=2;", "smClose();Game.paused=true;R.cam.z=innerWidth<700?1:2;");
fs.writeFileSync(p,s);
