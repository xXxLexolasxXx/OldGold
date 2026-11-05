const fs=require('fs'),p='D:/для игры/feod/output/publish/oldgold-pages-20261104/',src='C:/Users/Тема/.codex/generated_images/01a1a35d-b114-75d2-9703-6c6079ac42d1/';
const assets={SE:'exec-bc9a9082-1ef3-4804-815c-16ad9344092e.png',E:'exec-80ee3777-3df7-4004-b449-a6b5489e7399.png',NE:'exec-4ee677b7-a7e2-48ac-8c48-96456d4dadb0.png',N:'exec-20628fb2-5239-4f30-a8e7-0a1bddb50903.png'};
for(const[v,f]of Object.entries(assets))fs.copyFileSync(src+f,p+'assets/fantasy/haunt-bodies-v4-'+v+'.png');
if(!fs.existsSync(__dirname+'/approved-haunts-v3.js'))fs.copyFileSync(p+'js/fantasy-published-haunts.js',__dirname+'/approved-haunts-v3.js');
