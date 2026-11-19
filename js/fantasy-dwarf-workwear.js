'use strict';

// [hat, coat, plate, highlight, material] on the native body and tool rig.
const DWARF_WORKWEAR = {
  woodcutter: ['#a33227', '#883329', '#66645e', '#a9a397', 'plaid'],
  builder: ['#bd7f33', '#714834', '#8e542e', '#c28451', 'leather'],
  stonemason: ['#77734f', '#3e5c57', '#606968', '#a9b3a7', 'steel'],
  smelter: ['#49465e', '#424855', '#50494b', '#bb805e', 'forge'],
  farmer: ['#c59b46', '#596033', '#56633c', '#8e9654', 'quilt'],
  miner: ['#314f73', '#554d45', '#525a58', '#8e9990', 'steel'],
  brewer: ['#ad7139', '#624d68', '#805938', '#c59a55', 'leather'],
  tanner: ['#8e633d', '#3d685d', '#694b36', '#a98053', 'leather'],
  baker: ['baker', '#a96039', '#8b7358', '#d5ba8b', 'quilt'],
  butcher: ['#842e2b', '#57535c', '#6a6462', '#a59a88', 'steel'],
  hopgrower: ['#758b3e', '#7e6036', '#56633c', '#a9a056', 'quilt'],
  miller: ['#cec3a5', '#847859', '#7c7560', '#c6b48b', 'quilt'],
  herder: ['#4a7288', '#68624f', '#7c694d', '#c5b18c', 'leather'],
  carpenter: ['#b97c3c', '#506b70', '#886544', '#c5a16c', 'leather'],
  enchanter: ['wizard', '#574765', '#626078', '#bdac79', 'rune'],
  stableman: ['#776087', '#65513d', '#79624a', '#c4a477', 'leather'],
  carter: ['#515d70', '#665d4b', '#756a54', '#b9ac83', 'leather'],
  healer: ['#d0d1b0', '#456e61', '#6a8874', '#c0cda6', 'quilt'],
  fisher: ['#416e82', '#a18c45', '#796c43', '#d1bb79', 'leather'],
  lamplighter: ['#526179', '#3e4e60', '#6e6550', '#baa56e', 'leather'],
  scribe: ['#385e4d', '#3b5e50', '#61735a', '#b7b58a', 'quilt'],
};
DWARF_WORKWEAR.armorer = DWARF_WORKWEAR.smelter;
DWARF_WORKWEAR.breeder = DWARF_WORKWEAR.herder;
// Quest companions are ordinary dwarves too. Their former missing outfit
// entries silently sent them through the legacy body renderer.
OUTFIT.lamplighter={...OUTFIT.serf,frame:false,coat:'#3e4e60'};
OUTFIT.scribe={...OUTFIT.serf,frame:false,coat:'#3b5e50'};

function dwarfWorkwear(u) {
  return DWARF_WORKWEAR[u.type] || null;
}

function paintWorkwearShoulder(style, project, draw) {
  const [, , plate, edge, material] = style;
  const layer = (points,color) => draw(points.map(([x,y])=>project(x,y)),color);
  layer([[-2.5,1],[-2,-1],[-.5,-2.5],[2,-2.5],[4,-1.5],[5,0],[5.5,2.5],
    [4.5,4],[2,4.5],[-1.5,3.5]],'#2d241e');
  layer([[-2,1],[-1.5,-.75],[0,-2],[2,-2],[3.5,-1],[4.5,.5],[4.75,2.5],
    [3.75,3.5],[1.5,4],[-1,3]],shade(plate,-.23));
  layer([[-1.75,.75],[-1.25,-.75],[0,-1.75],[2,-1.75],[3.5,-.75],[4.25,.75],
    [3.75,2],[2,2.5],[0,2],[-1.5,1.75]],plate);
  layer([[-1.5,.25],[-.75,-1],[.5,-1.75],[2,-1.75],[3.5,-.75],[3.75,0],
    [2,-.75],[.5,-.75],[-.5,.25]],edge);
  layer([[-1.5,1.75],[0,2],[2,2.5],[3.75,2],[4.25,1.25],[4,2.75],
    [2,3.25],[.5,3],[-1.5,2.5]],shade(edge,-.18));
  if(material==='quilt'){
    layer([[.5,-.5],[1.5,.5],[.5,1.5],[-.5,.5]],shade(edge,-.25));
    layer([[2.5,0],[3.5,1],[2.5,2],[1.5,1]],shade(edge,-.3));
  }
  if(material==='rune'){
    layer([[.5,-.75],[1.5,.25],[.5,1.25],[-.5,.25]],'#d6c59a');
    layer([[.5,-.25],[1,.25],[.5,.75],[0,.25]],'#777e9d');
  }
  layer([[3,1],[3.75,1],[3.75,1.75],[3,1.75]],material==='forge'?'#d6a078':'#cfad6c');
}

function paintDwarfWorkwear(c, q, view, shape, rect, shoulderOnly=false) {
  const style = dwarfWorkwear(q.holder);
  if (!style) return;
  const [, coat, , , material] = style;
  const x = PFX, y = PFY - 15;
  const profile = view === 'E';
  if(shoulderOnly){
    const shoulder=side=>paintWorkwearShoulder(style,
      (px,py)=>[x+side*((profile?3.2:3.7)+px),y+py],
      (points,color)=>shape(c,points,color));
    shoulder(-1);
    if(!profile)shoulder(1);
    return;
  }
  if (material === 'plaid') {
    for (const dx of [-4,-1,2]) rect(c,x+dx,y+4,1.5,4,shade(coat,-.24));
    for (const dy of [4,6.5]) rect(c,x-4,y+dy,8,1,shade(coat,.14));
  } else if (view !== 'N') {
    const apron = material === 'forge' ? '#684630' : material === 'steel' ? '#816344' : '#795637';
    const center = x + (profile ? 2 : 0);
    shape(c,[[center-2,y+6],[center+3,y+6],[center+3.5,y+10],
      [center-2.5,y+10],[center-3,y+8]],shade(apron,-.35));
    rect(c,center-2,y+6.5,4.5,2.5,apron);
    rect(c,center-2,y+7,2,.5,shade(apron,.28));
    rect(c,center-2.5,y+5.5,6,1,'#4f3524');
    rect(c,center+.5,y+5.5,1.5,1,'#b48c54');
  }
}

function paintWorkwearBeard(c,G,view,shape) {
  if (view === 'N') return;
  const x = PFX + (view === 'E' ? 1.9 : 0);
  const y = G.headY, w = view === 'E' ? 4.1 : 5.2;
  const tuft = (points, colour) => shape(c, points.map(([dx,dy]) => [x+dx*w,y+dy]), colour);
  tuft([[-1,-.25],[.55,-.25],[.55,2],[1,2.6],[.98,6.5],[.45,8],[-.45,7.5],[-1,5]],'#30221b');
  tuft([[-.92,.35],[.46,.4],[.48,2.05],[.89,3],[.83,6.25],[.32,7.25],[-.45,6.8],[-.84,4.5]],'#493326');
  tuft([[-.84,1],[-.52,1],[-.23,2.65],[.38,3.35],[.29,4.25],[-.25,3.7],[-.74,2.7]],'#5b4231');
  tuft([[-.15,4.2],[.05,4.8],[.35,5.6],[.66,5.3],[.6,6.45],[.31,6.9],[.01,6.3]],'#52392a');
}

// The cart keeps its native horse, wheels, cargo and seat. Only its dwarf
// driver uses the same approved body as the walking carter.
const FPA_CART_DRIVER_BODIES=new Map();
function fpaDrawCartDriver(c,x,seatY,view){
  if(!window.FantasyPublishedAppearanceArt||!FantasyPublishedArt.images['gnome-walk'])return true;
  const actor={type:'carter',look:15,_exactYardPose:true};
  const source=personSprite(actor,view,'idle',0);
  if(!source._fantasyAppearance)return true;
  let body=FPA_CART_DRIVER_BODIES.get(source);
  if(!body){
    body=mkCanvas(source.width,source.height);
    body.getContext('2d').drawImage(source,0,0);
    fpaCleanAtlasArms(body,actor,view,'yardGrip',0);
    FPA_CART_DRIVER_BODIES.set(source,body);
    if(FPA_CART_DRIVER_BODIES.size>6)FPA_CART_DRIVER_BODIES.delete(FPA_CART_DRIVER_BODIES.keys().next().value);
  }
  const k=.42,footY=seatY+3.5,cloth=OUTFIT.carter.coat;
  const look=lookOf({...actor,look:LOOK_POOL[15]}),skin=SKINS[look.skin%SKINS.length];
  c.save();c.imageSmoothingEnabled=false;
  c.beginPath();c.rect(x-7,seatY-17,14,18.2);c.clip();
  c.translate(x,footY);c.scale(k,k);
  const near=view==='E'?[2.6,-10.8]:[-4,-10.5],far=view==='E'?[5.5,-15.3]:[4,-10.5];
  fpaWorkSleeve(c,view==='E'?[1.5,-15]:[4.2,-15],far,cloth,true);
  fpaSowFist(c,far,view==='E'?1.3:0,skin,true);
  c.drawImage(body,-PFX,-PFY,PW,PH);
  fpaWorkSleeve(c,[-3.2,-15],near,cloth);
  paintWorkwearShoulder(dwarfWorkwear(actor),(px,py)=>[-3.2-px,-15+py],
    (points,color)=>fpaSowPolygon(c,points,color));
  fpaSowFist(c,near,view==='E'?1.3:0,skin,false);
  c.restore();
  const handX=x+near[0]*k,handY=footY+near[1]*k;
  line(c,handX,handY,view==='E'?x+10:x-2,seatY+1,'#443426',.5);
  return true;
}

for (const [role, [cap, coat]] of Object.entries(DWARF_WORKWEAR)) {
  if (OUTFIT[role]) Object.assign(OUTFIT[role], { cap, coat });
}
if(typeof FantasyPublishedArt!=='undefined')FantasyPublishedArt.ready.then(()=>{CR_CACHE.clear();FPA_CART_DRIVER_BODIES.clear();});
