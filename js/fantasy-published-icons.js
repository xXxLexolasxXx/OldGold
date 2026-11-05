'use strict';
// Eight approved wooden/brass UI icons, ported without old UI handlers.
(() => {
 if(window.FantasyPublishedIcons)return;
  const palette = {
    ink: '#211b15', shadow: '#493323', wood: '#835b37', woodHi: '#c29558',
    iron: '#697574', ironHi: '#b8c5bb', gleam: '#e1e1c4', brass: '#a27d43',
    gold: '#d5b66e', paper: '#d8c396', paperHi: '#f0e0b7', paperLo: '#ad9060',
    skin: '#d4a278', skinHi: '#efc89a', beard: '#c6bda0', beardHi: '#eee0bc',
    red: '#944d38', redHi: '#bc7350', green: '#52705a', greenHi: '#83976b'
  };
  function icon(name) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 32;
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    const r = (x,y,w,h,col) => { c.fillStyle=palette[col] || col; c.fillRect(x,y,w,h); };
    const line = (x,y,xx,yy,col,w=1) => {
      let dx=Math.abs(xx-x),sx=x<xx?1:-1,dy=-Math.abs(yy-y),sy=y<yy?1:-1,err=dx+dy;
      for (;;) { r(x,y,w,w,col); if(x===xx && y===yy)break;const e=2*err;if(e>=dy){err+=dy;x+=sx;}if(e<=dx){err+=dx;y+=sy;} }
    };
    const rows = (x,y,shape,col) => shape.forEach((s,j)=>{for(let i=0;i<s.length;i++)if(s[i]!==' ')r(x+i,y+j,1,1,col);});
    const nail=(x,y)=>{r(x,y,3,3,'ink');r(x,y,2,2,'iron');r(x,y,1,1,'ironHi');};
    if(name==='build') {
      line(5,27,22,8,'ink',5); line(6,27,23,10,'shadow',3);
      line(6,26,23,9,'wood',2); line(6,25,23,8,'woodHi');
      line(8,24,10,22,'paperLo');line(16,16,18,14,'shadow');
      rows(12,2,['      ########','    ##########','  ############',' #############','############# ','############  ',' ##########   ','  #######     '],'ink');
      rows(13,3,['     #######','   #########',' ###########','############','########### ',' #########  ','  ######    '],'iron');
      line(19,3,25,3,'gleam');line(16,4,18,4,'ironHi');line(14,5,13,7,'ironHi');line(13,8,14,9,'gleam');
      r(17,7,5,2,'ironHi');r(19,9,6,2,'#4d5d5c');r(23,5,1,1,'gleam');r(26,4,1,3,'ironHi');
      line(20,10,23,7,'brass',2);r(21,9,1,1,'gold');
    } else if(name==='people') {
      function dwarf(x,y,hat,hatHi,coat) {
        rows(x,y,['     ##     ','    ####    ','   ######   ','  ########  ',' ########## ','############'],'ink');
        rows(x+1,y+1,['    ##    ','   ####   ','  ######  ',' ######## ','##########'],hat);
        line(x+5,y+1,x+3,y+4,hatHi);r(x+1,y+5,10,2,'shadow');r(x+1,y+5,10,1,hatHi);
        r(x+2,y+7,8,5,'ink');r(x+3,y+7,6,4,'skin');r(x+4,y+7,4,1,'skinHi');
        r(x+3,y+8,1,1,'ink');r(x+8,y+8,1,1,'ink');r(x+5,y+9,2,2,'skinHi');
        rows(x+1,y+10,[' ##    ## ','##########','##########',' ######## ','  ######  ','   ####   '],'beard');
        r(x+2,y+11,3,1,'beardHi');r(x+7,y+11,3,1,'beardHi');line(x+3,y+12,x+5,y+14,'beardHi');r(x+8,y+12,1,2,'paperLo');
        r(x+1,y+16,10,7,'ink');r(x+2,y+16,8,5,coat);r(x+1,y+17,2,4,hat);r(x+9,y+17,2,4,hat);
        r(x+5,y+16,2,4,'shadow');r(x+5,y+19,2,2,'brass');r(x+5,y+19,1,1,'gold');
        r(x+2,y+23,3,2,'ink');r(x+7,y+23,3,2,'ink');
      }
      dwarf(2,4,'red','redHi','wood');dwarf(17,2,'green','greenHi','green');
    } else if(name==='store') {
      r(3,9,26,19,'ink');r(4,10,24,16,'wood');r(5,12,22,13,'shadow');
      for(let x=5;x<27;x+=5){r(x,12,4,13,'wood');r(x,13,1,11,'woodHi');r(x+2,18,1,3,'shadow');}
      r(2,6,28,7,'ink');r(3,7,26,4,'wood');r(4,7,23,1,'woodHi');r(4,10,24,1,'shadow');
      r(5,8,3,17,'iron');r(6,8,1,16,'ironHi');r(24,8,3,17,'iron');r(24,8,1,16,'ironHi');
      nail(5,8);nail(24,8);nail(5,22);nail(24,22);
      r(13,11,6,8,'ink');r(14,12,4,6,'brass');r(14,12,3,1,'gold');r(15,14,2,2,'ink');r(15,16,1,1,'ink');
      r(5,26,22,1,'woodHi');
    } else if(name==='scroll') {
      r(7,5,19,23,'ink');r(8,6,17,21,'paperLo');r(9,6,14,20,'paper');r(10,7,12,1,'paperHi');
      r(4,3,24,5,'ink');r(5,4,22,3,'wood');r(5,4,21,1,'woodHi');r(7,5,16,2,'paperHi');
      r(4,25,24,5,'ink');r(5,26,22,3,'wood');r(6,26,20,1,'woodHi');r(8,26,15,2,'paper');
      for(let j=0;j<4;j++){r(11,11+j*3,j===3?7:10,1,'shadow');r(11,12+j*3, j===3?5:9,1,'paperLo');}
      r(22,20,5,7,'red');r(23,20,3,5,'redHi');r(23,21,2,2,'gold');
    } else if(name==='log') {
      r(2,6,28,23,'ink');r(3,7,26,20,'red');r(4,5,11,21,'ink');r(17,5,11,21,'ink');
      r(5,6,9,19,'paperLo');r(6,6,8,17,'paper');r(7,7,6,1,'paperHi');
      r(18,6,9,19,'paperLo');r(18,6,8,17,'paperHi');r(15,7,2,20,'shadow');r(16,8,1,17,'woodHi');
      for(let j=0;j<5;j++){r(7,10+j*3, j%2?4:6,1,'wood');r(19,10+j*3,j%2?6:5,1,'paperLo');}
      r(23,3,3,10,'red');r(23,3,1,9,'redHi');r(24,12,1,2,'red');
      r(5,25,9,1,'paperHi');r(18,25,9,1,'paper');r(4,27,24,1,'woodHi');
    } else if(name==='menu') {
      for(let j=0;j<3;j++) {
        const y=5+j*9;r(3,y,26,7,'ink');r(4,y+1,24,4,'wood');r(5,y+1,22,1,'woodHi');r(7,y+3,15-j*3,1,'shadow');
        r(4,y+5,24,1,'shadow');r(24-j*3,y+3,2,1,'ink');
      }
    } else if(name==='road') {
      for(let j=0;j<4;j++)for(let k=0;k<3;k++){const x=3+k*9+(j%2?2:0),y=3+j*7;r(x,y,8,6,'ink');r(x+1,y+1,6,4,'iron');r(x+1,y+1,5,1,'ironHi');r(x+5,y+3,2,2,'#4a5650');}
    } else if(name==='erase') {
      line(6,6,24,24,'ink',4);line(24,6,6,24,'ink',4);line(7,7,25,25,'red',2);line(25,7,7,25,'red',2);
      line(7,6,25,24,'redHi');line(25,6,7,24,'redHi');
    }
    return cv;
  }

 const names=['build','store','people','scroll','log','menu','road','erase'];
 const models=Object.fromEntries(names.map(n=>[n,icon(n)]));models.quill=models.log;models.overview=models.scroll;
 const oldURL=iconURL,oldCanvas=iconCanvas,oldDraw=drawUiIcon,urls=new Map(),canvases=new Map();
 drawUiIcon=function(c,name){const cv=models[name];if(!cv)return oldDraw(c,name);c.save();c.imageSmoothingEnabled=false;c.drawImage(cv,0,0,16,16);c.restore();};
 iconURL=function(kind,name,scale=1){if(kind!=='ui'||!models[name])return oldURL(kind,name,scale);const key=name+'|'+scale;if(urls.has(key))return urls.get(key);const cv=mkCanvas(18*scale,18*scale),c=cv.getContext('2d');c.imageSmoothingEnabled=false;c.drawImage(models[name],scale,scale,16*scale,16*scale);const url=cv.toDataURL();urls.set(key,url);return url;};
 iconCanvas=function(kind,name){if(kind!=='ui'||!models[name])return oldCanvas(kind,name);if(canvases.has(name))return canvases.get(name);const cv=mkCanvas(18,18),c=cv.getContext('2d');c.imageSmoothingEnabled=false;c.drawImage(models[name],1,1,16,16);canvases.set(name,cv);return cv;};
 const refresh=()=>document.querySelectorAll('img[data-icon]').forEach(im=>{if(models[im.dataset.icon])im.src=iconURL('ui',im.dataset.icon,2);});
 refresh();window.addEventListener('load',refresh,{once:true});
 window.FantasyPublishedIcons={names,models,oldURL,oldCanvas,oldDraw,refresh};
})();
