const fs=require('fs'),p=__dirname+'/verify-v4.cjs';let s=fs.readFileSync(p,'utf8');
s=s.replace("if(r.request().url().endsWith('/js/fantasy-published-haunts.js'))", "if(!process.argv.includes('--production')&&r.request().url().endsWith('/js/fantasy-published-haunts.js'))");
fs.writeFileSync(p,s);
