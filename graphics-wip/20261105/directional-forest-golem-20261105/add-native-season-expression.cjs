const fs=require('fs'),p='D:/для игры/feod/output/fantasy/directional-forest-golem-20261105/prototype-forest-golem.js';let s=fs.readFileSync(p,'utf8');const marker=' function canonical(d)';const filter=`
 function appearanceFinish(cv,G,family,dir,season,dorm){const c=cv.getContext('2d'),im=c.getImageData(0,0,cv.width,cv.height),d=im.data;for(let i=0;i<d.length;i+=4){if(!d[i+3])continue;let r=d[i],g=d[i+1],b=d[i+2],x=(i/4)%cv.width,y=Math.floor(i/4/cv.width);if(family==='troll'){if(G.P.fade>0&&naHash(x,y)<G.P.fade){d[i+3]=0;continue}if(G.P.hurt>.05){const a=Math.min(.4,G.P.hurt*.32);d[i]=r+(255-r)*a;d[i+1]=g+(236-g)*a;d[i+2]=b+(220-b)*a}continue}
 const moss=g>r*.95&&g>b*1.3&&b<130,white=r>210&&g>205&&b>170,orange=r>g*1.4&&g>b*1.5&&r>150,lv=(r+g+b)/3;
 if(moss){const light=Math.max(.2,Math.min(1.1,lv/110));const col=season===1?[157,104,43]:season===2?[166,194,205]:season===0?[95,121,35]:null;if(col){d[i]=col[0]*light;d[i+1]=col[1]*light;d[i+2]=col[2]*light}}
 if(white&&season===0){d[i]=117;d[i+1]=139;d[i+2]=52}else if(white&&season===1){d[i]=210;d[i+1]=162;d[i+2]=74}
 if(orange&&season===2){d[i]=178;d[i+1]=211;d[i+2]=223}
 const wx=x/2-GL_AX,wy=y/2-GL_AY,hx=dir>=5?-G.head[0]:G.head[0];if(dorm&&Math.abs(wx-hx)<14&&wy>G.head[1]-3&&wy<G.head[1]+5&&r>g*1.2&&r>140&&g>70&&g<190&&b<85){d[i]=61;d[i+1]=53;d[i+2]=41}
 else if(r>160&&g>100&&g<210&&b<80&&r>g*1.12){const v=dorm?.35:.7+.3*G.P.rune;d[i]*=v;d[i+1]*=v;d[i+2]*=v}
 }c.putImageData(im,0,0);}
`;
s=s.replace(marker,filter+marker);s=s.replace("const nativeView=opts.nativeView||", "const nativeView=opts.nativeView||");s=s.replace("season=family==='golem'?golemSea():0,dorm=family==='golem'?golemDorm():false", "season=family==='golem'?(opts.season??golemSea()):0,dorm=family==='golem'?(opts.dormant??golemDorm()):false");s=s.replace('finish(cv);const result=', 'appearanceFinish(cv,G,family,d,season,dorm);finish(cv);const result=');fs.writeFileSync(p,s);
