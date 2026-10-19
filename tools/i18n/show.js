// node tools/i18n/show.js <файл-секции-подстрока...> — печатает секции снимка с номерами
const fs=require('fs');const t=fs.readFileSync(__dirname+'/src-ru.txt','utf8').split('\n');
const want=process.argv.slice(2);let on=false,n=0;
for(const l of t){if(l.startsWith('##### ')){on=want.some(w=>l.slice(6)===w||l.slice(6).startsWith(w));n=0;if(on)console.log('\n'+l);continue}
 if(on&&l)console.log((++n)+' '+l)}
