/* Presentation for the existing frogfolk stilt village. */
(() => {
  'use strict';
  if (window.FrogVillageArt) return;

  const original = neuDrawLair;
  const originalList = neuDrawList;
  const queued = new WeakMap();
  const layers = [
    {name:'ground',level:1,depth:-110},
    {name:'palace',level:1,depth:1},
    {name:'dye',level:2,depth:15},
    {name:'glass',level:2,depth:15},
    {name:'market',level:3,depth:32},
    {name:'watch',level:3,depth:34},
    {name:'gate',level:3,depth:34},
  ];
  // Generated from the authored layers by bake-frog-village-atlas.cjs.
  // Each entry stores backing coordinates, logical size and logical anchor.
  const atlasEntries = {
    '2|3|0|ground': [1, 1, 512, 200, 256, 104],
    '2|3|1|ground': [1, 403, 512, 200, 256, 104],
    '2|0|d|ground': [1, 805, 512, 200, 256, 104],
    '2|1|0|palace': [1027, 1, 172, 188, 86, 176],
    '2|1|1|palace': [1373, 1, 172, 188, 86, 176],
    '2|2|0|glass': [1719, 1, 104, 116, -70, 78],
    '2|2|1|glass': [1027, 403, 104, 116, -70, 78],
    '2|2|0|dye': [1237, 403, 104, 110, 172, 74],
    '2|2|1|dye': [1447, 403, 104, 110, 172, 74],
    '1|1|0|ground': [1027, 805, 256, 100, 128, 52],
    '1|1|1|ground': [1, 1207, 256, 100, 128, 52],
    '1|0|d|ground': [515, 1207, 256, 100, 128, 52],
    '1|2|0|ground': [1029, 1207, 256, 100, 128, 52],
    '1|2|1|ground': [1, 1409, 256, 100, 128, 52],
    '2|3|0|watch': [1657, 403, 76, 98, -138, 20],
    '2|3|1|watch': [1811, 403, 76, 98, -138, 20],
    '1|1|0|palace': [1541, 805, 86, 94, 43, 88],
    '1|1|1|palace': [1715, 805, 86, 94, 43, 88],
    '2|3|0|market': [1543, 1207, 80, 80, 138, 2],
    '2|3|1|market': [1705, 1207, 80, 80, 138, 2],
    '2|3|0|gate': [1889, 805, 78, 78, 14, 4],
    '2|3|1|gate': [1867, 1207, 78, 78, 14, 4],
    '1|2|0|glass': [1929, 1, 52, 58, -35, 39],
    '1|2|1|glass': [515, 1409, 52, 58, -35, 39],
    '1|2|0|dye': [621, 1409, 52, 55, 86, 37],
    '1|2|1|dye': [727, 1409, 52, 55, 86, 37]
  };
  const bakedLayers = new Map();
  const errors = [];
  let atlasReady = false;
  async function loadLayers(url) {
    // Fetch does not hold the window load event while the game starts.
    const response=await fetch(url);
    if(!response.ok)throw new Error('Frog village atlas HTTP '+response.status);
    const atlas=await createImageBitmap(await response.blob());
    try{
      if(atlas.width!==2048||atlas.height!==1610)throw new Error('Unexpected frog village atlas size');
      // Copy one layer per idle callback. The native list stays active until
      // both living phases and the ruins are ready.
      for(const [key,[x,y,w,h,ax,ay]] of Object.entries(atlasEntries)){
        await new Promise(resolve=>{
          if(typeof requestIdleCallback==='function')requestIdleCallback(resolve,{timeout:80});
          else setTimeout(resolve,0);
        });
        const cv=mkCanvas(w*2,h*2);
        cv.getContext('2d').drawImage(atlas,x,y,w*2,h*2,0,0,w*2,h*2);
        bakedLayers.set(key,{cv,w,h,ax,ay});
      }
    }finally{
      atlas.close();
    }
    atlasReady = true;
  }
  const assetPath = 'assets/fantasy/frog-village-atlas.png';
  const scriptURL = document.currentScript?.src;
  loadLayers(scriptURL?new URL('../'+assetPath,scriptURL).href:new URL(assetPath,document.baseURI).href).catch(error=>{
    bakedLayers.clear();
    errors.push(error.message);
  });
  function phaseFor(lair) {
    const live=Game.neutrals.some(n=>n.lair===lair.id&&n.st!=='die');
    return live?String(Math.floor(Game.time*1.8+lair.id)%2):'d';
  }
  function levelFor(lair) {
    const level=typeof ftBaseTier==='function'?ftBaseTier(lair):lair.ftTier;
    return Number.isFinite(level)?Math.max(1,Math.min(3,Math.trunc(level))):2;
  }
  function blitLayer(c,layer,level,phase,x,y) {
    const scale=level===3?2:1;
    const artLevel=phase==='d'?0:layer.name==='ground'?level:layer.level;
    const {cv,w,h,ax,ay}=bakedLayers.get(scale+'|'+artLevel+'|'+phase+'|'+layer.name);
    c.drawImage(cv,x-ax,y-ay,w,h);
  }

  neuDrawLair=function(c,lair){
    if(lair.k!=='ftvil'||!atlasReady)return original(c,lair);
    if(queued.get(lair)===c){queued.delete(lair);return}
    const x=Math.round(lair.x*TILE+16),y=Math.round(lair.y*TILE+22);
    const level=levelFor(lair),phase=phaseFor(lair);
    for(const layer of layers){
      if(layer.level<=level&&(phase!=='d'||layer.name==='ground'))blitLayer(c,layer,level,phase,x,y);
    }
  };
  neuDrawList=function(list,c,x0,y0,x1,y1){
    originalList(list,c,x0,y0,x1,y1);
    if(!atlasReady)return;
    for(const lair of Game.lairs||[]){
      if(lair.k!=='ftvil')continue;
      const level=levelFor(lair),scale=level===3?2:1;
      const nativeVisible=lair.x>=x0-3&&lair.x<=x1+3&&lair.y>=y0-3&&lair.y<=y1+4;
      if(nativeVisible)queued.set(lair,c);
      else if(level!==3||lair.x<x0-8||lair.x>x1+8||lair.y<y0-4||lair.y>y1+7)continue;
      const phase=phaseFor(lair);
      const x=Math.round(lair.x*TILE+16),y=Math.round(lair.y*TILE+22);
      for(const layer of layers){
        if(layer.level>level||(phase==='d'&&layer.name!=='ground'))continue;
        list.push([(y+layer.depth*scale)/TILE,()=>blitLayer(c,layer,level,phase,x,y)]);
      }
    }
  };
  window.FrogVillageArt={get ready(){return atlasReady},errors,cacheSize:()=>bakedLayers.size};
})();
