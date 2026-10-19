// Дописывает в снимок src-ru.txt непереведённые строки секциями «файл#N» (N — номер партии)
const fs=require('fs'),path=require('path');
const {scanAll,loadDict}=require('../i18n-extract.js');
const batch=process.argv[2]||'2';
const all=scanAll(),dict=loadDict();
const by={};
for(const e of all){if(e.ru in dict)continue;const f=[...e.files][0].split(':')[0];(by[f]=by[f]||[]).push(e.ru)}
let out='';for(const f of Object.keys(by).sort()){out+='##### '+f+'#'+batch+'\n'+by[f].map(x=>JSON.stringify(x)).join('\n')+'\n'}
fs.appendFileSync(path.join(__dirname,'src-ru.txt'),out);console.log(Object.entries(by).map(([k,v])=>k+':'+v.length).join(' '));
