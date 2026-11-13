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
};
DWARF_WORKWEAR.armorer = DWARF_WORKWEAR.smelter;
DWARF_WORKWEAR.breeder = DWARF_WORKWEAR.herder;

function dwarfWorkwear(u) {
  return DWARF_WORKWEAR[u.type] || null;
}

function paintDwarfWorkwear(c, q, view, shape, rect) {
  const style = dwarfWorkwear(q.holder);
  if (!style) return;
  const [, coat, plate, edge, material] = style;
  const x = PFX, y = PFY - 15;
  const profile = view === 'E';
  const shoulder = side => {
    const cx = x + side * (profile ? 3.5 : 4.5);
    const project = points => points.map(([px, py]) => [cx + side * px, y + py]);
    shape(c, project([[-2.5,.5],[-1.5,-1],[1,-1],[3,0],[4,2.5],[2.5,3.5],[-1,2.5]]), shade(plate,-.45));
    shape(c, project([[-2,0],[-1,-.5],[1,-.5],[2.5,.5],[3,2],[1.5,2.5],[-1,1.75]]), plate);
    shape(c, project([[-1.5,0],[.5,-.5],[2,.25],[2.75,1.25],[.5,.5],[-1,.75]]), edge);
    if (material === 'steel' || material === 'forge') {
      shape(c, project([[-.5,2],[2,1.75],[3,1.5],[3,2.25],[1.5,2.75],[-.5,2.75]]), shade(edge,-.25));
    } else if (material === 'quilt') {
      rect(c, cx - .5, y + .5, 1, 1, shade(plate,-.27));
    }
    rect(c, cx + side * 1.5 - .25, y + 1.5, .5, .5, '#c39b60');
  };
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
  if (profile) shoulder(-1);
  else {
    shoulder(-1);
    shoulder(1);
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

for (const [role, [cap, coat]] of Object.entries(DWARF_WORKWEAR)) {
  if (OUTFIT[role]) Object.assign(OUTFIT[role], { cap, coat });
}
