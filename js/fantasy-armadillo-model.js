function drawArmadCandidate(Q, P) {
  const C = ARMAD_MATERIAL, ball = P.curl >= 0.5, sw = P.leg, lunge = P.a > 0 ? P.a : 0;
  pbShadow(Q, ball ? 14 : 20);
  const Y = y => (P.dead ? -26 - y : y);                                                  // на спине — лапами вверх
  const spike = (x, y, ang, len, w) => pbPoly(Q, [[x - Math.sin(ang) * w, y + Math.cos(ang) * w], [x + Math.cos(ang) * len, y + Math.sin(ang) * len], [x + Math.sin(ang) * w, y - Math.cos(ang) * w]], (xx, yy) => pbPick(C.HO, 0.85 - Math.hypot(xx - x, yy - y) / len * 0.5, Q.dth(xx, yy)));
  if (ball) {
    const r = 11 + P.curl * 3.6, cy = -r - 0.5, sp = P.spin || 0;
    if (P.dust) Q.R(-r - 16, -7, -r, 0, (x, y) => (Q.dth(x, y) < 0.4 - ((x + r) / -16) * 0.3 && ((x + r + 7) ** 2 / 60 + (y + 2) ** 2 / 7) < 1 ? [200, 180, 140, 0.6] : null), false);
    pbBall(Q, 0, cy, r, r, C.SH, { amb: 0.46, tex: (x, y) => {
      const an = Math.atan2(y - cy, x) - sp, ring = ((an / Math.PI * 4) % 1 + 1) % 1, rr = Math.hypot(x, y - cy) / r;
      return (ring < 0.1 ? -0.34 : 0) + (rr > 0.4 && Math.floor(rr * 5 + ring * 4) % 2 ? -0.06 : 0.05);
    } });
    for (let k = 0; k < 8; k++) { const an = sp + k / 8 * Math.PI * 2; spike(Math.cos(an) * r * 0.92, cy + Math.sin(an) * r * 0.92, an, 6, 1.6); }   // шипы ядра
    if (P.bonk) for (let s = 0; s < 3; s++) { const an = s * 2.1 + P.bonk * 3; pbDot(Q, Math.cos(an) * 11, cy - r - 4 + Math.sin(an) * 2.4, [255, 242, 160], 0.7); }
    Q.outline([30, 22, 18]);
    return;
  }
  // лапы: толстые, когти-кирки
  const leg = (x, ph, near) => {
    const fx = x + ph * 3 + lunge * 2, ramp = near ? C.SK : C.SK.slice(0, 3);
    const knee = x + (fx - x) * .55;
    const facet = (points,color) => pbPoly(Q,points.map(([u,v])=>[u,Y(v)]),()=>color);
    facet([[x-3.9,-10],[x+.5,-12],[x+3.7,-9],[knee+2.8,-6],[knee+1.1,-3.4],[fx+3,-2],[fx+3.4,.4],[fx+1.8,1],[fx-2.8,1],[fx-3.2,-1],[knee-2,-3.2],[knee-3.4,-5.5]],ramp[0]);
    facet([[x-2.8,-9],[x+.6,-11],[x+2.6,-8],[knee+1.5,-5],[knee-.9,-4],[knee-2.3,-5.5]],ramp[near?3:2]);
    facet([[knee-1.8,-5],[knee+.8,-5.5],[fx+.5,-3],[fx+2.6,-1.7],[fx+2,.5],[fx-2.4,.5],[fx-2.5,-.8]],ramp[near?2:1]);
    if(near){
      facet([[x-3,-9.3],[x-.6,-11.2],[x+1.3,-10.7],[x+2.4,-8.9],[knee+.7,-7.1],[knee-1.7,-6]],ramp[3]);
      facet([[x-2.6,-9.5],[x-.7,-10.7],[x+.7,-10.3],[knee-.6,-7.7],[knee-1.8,-7]],ramp[4]);
      facet([[knee-.9,-5.5],[knee+.5,-4.8],[fx+.6,-2.7],[fx-.9,-1],[fx-1.5,-2]],ramp[2]);
      facet([[fx-2.5,-.8],[fx-.9,-1.5],[fx+1.6,-1.4],[fx+2.2,-.4],[fx+1.5,.5],[fx-2.4,.5]],ramp[3]);
    }
    for (let k = 2; k >= 0; k--) {
      const toe=fx+k*1.3;
      facet([[toe,-1.5],[toe+1.4,-1.7],[toe+2.7,-.8],[toe+3.6+k*.1,.6],[toe+1.2,.4]],C.HO[near?2:1]);
      if(near)facet([[toe+.7,-1.3],[toe+1.6,-1.4],[toe+2.9,.15]],C.HO[1]);
    }
  };
  leg(-11, -sw, false); leg(8, sw, false);
  // хвост-булава
  const tpts = []; for (let i = 0; i <= 6; i++) { const t = i / 6; tpts.push([-18 - t * 12, Y(-8 + t * 3 - Math.sin(t * 3) * 2), 3.6 * (1 - t * 0.5)]); }
  pbChain(Q, tpts, C.SH.slice(0, 5), { tex: (t) => ((((t * 7) % 1) < 0.2) ? -0.25 : 0) });
  const tb = tpts[6];
  pbBall(Q, tb[0] - 1, tb[1], 3.6, 3.2, C.SH, { amb: 0.5 });
  for (let k = 0; k < 5; k++) { const an = Math.PI * 0.6 + k / 4 * Math.PI * 0.9; spike(tb[0] - 1 + Math.cos(an) * 3, tb[1] + Math.sin(an) * 3, an, 4, 1); }
  // панцирь: высокий купол, кольца-пластины с кромками, передний и задний щиты
  pbBall(Q, -1, Y(-12), 20, 13, C.SH, { amb: 0.5, clip: (x, y) => (P.dead ? y > Y(-12) - 0.5 : y < -6.5), tex: (x, y) => {
    const grain = Q.hsh(Math.floor(x * 1.3) * 3.1 + Math.floor((y + .5) * 1.8)) > .55 ? .04 : 0;
    return grain - (Math.abs(y - Y(-9)) < 1.2 ? .12 : 0);
  } });
  // Overlapping plates follow the back and end in staggered lower facets.
  pbPoly(Q,[[-17,-10],[-11,-9],[-3,-8],[7,-9],[15,-11],[15,-7],[7,-5],[-6,-5],[-15,-7]].map(([x,y])=>[x,Y(y)]),()=>C.SH[1]);
  for(const [i,x] of [-12,-8.1,-4.2,-.3,3.6,7.5].entries()){
    const top=-12-13*Math.sqrt(1-((x+1)/20)**2);
    const bottom=-7-(i%3)*.65;
    const panel=(coords,color)=>pbPoly(Q,coords.map(([u,v])=>[x+u,Y(v)]),()=>color);
    panel([[-.2,top+.8],[2.9,top+.5],[2.3,top+5],[.6,top+10],[-2.2,bottom-1.8],[-4.8,bottom],[-5.6,bottom-1],[-3.1,top+9],[-1.2,top+4]],C.SH[1]);
    panel([[0,top+.9],[2.4,top+.7],[1.7,top+5],[-.1,top+9.5],[-2.9,bottom-1.7],[-4.8,bottom-1.1],[-2.7,top+8.5],[-.8,top+4]],C.SH[i<4?4:3]);
    panel([[0,top+.9],[2,top+.8],[1.4,top+4],[-.2,top+6],[-1.9,top+7.4],[-.9,top+4]],C.SH[4]);
    panel([[0,top+.9],[2,top+.8],[1.5,top+2.7],[-.5,top+3.7]],C.SH[i<4?5:4]);
    panel([[.3,top+8],[.8,top+8.1],[-1.8,bottom-2.4],[-4.3,bottom-.8],[-3.4,bottom-2.1]],C.SH[3]);
  }
  Q.path([[-20, Y(-6.6), 0.7], [18, Y(-6.6), 0.7]], () => C.SH[0]);
  for (let k = 0; k < 7; k++) { const x = -13 + k * 3.6, top = -12 - Math.sqrt(Math.max(0, 1 - ((x + 1) / 20) ** 2)) * 13; spike(x, Y(top + 1), P.dead ? Math.PI / 2 : -Math.PI / 2 - 0.25, 4.6 - Math.abs(k - 3) * 0.4, 1.3); }   // шипы по хребту
  for (const s of [-1, 1]) spike(s > 0 ? 15 : -18, Y(-9), s > 0 ? -0.3 : Math.PI + 0.3, 4, 1.1);   // боковые шипы щитов
  // голова: бронированная морда, рог на щитке, клыки, глаза горят
  const hx = 17 + lunge * 2.6 - P.curl * 3, hy = Y(-9 + (P.hurt > 0.5 ? 1 : 0));
  pbBlob(Q, [{ e: [hx, hy, 5, 4.2] }, { c: [[hx + 2, hy + 0.4, 3], [hx + 10, hy + 1.6, 1.8]] }], C.SK, { amb: 0.5, k: 2, depth: 3 });
  pbPoly(Q, [[hx - 3, hy - 4], [hx + 5, hy - 5.4], [hx + 9, hy - 2], [hx + 3, hy - 1.4], [hx - 3.4, hy - 1]], (x, y) => pbPick(C.SH, 0.7 - (y - hy + 5) / 5 * 0.3, Q.dth(x, y)));   // лобный щиток
  pbPoly(Q,[[hx-3,hy-3],[hx+1,hy-4],[hx+4,hy-2.8],[hx+2,hy-1],[hx-1,hy-.7]],()=>C.SH[4]);
  pbPoly(Q,[[hx-2,hy+.4],[hx+1,hy+.8],[hx+3,hy+2.1],[hx+7,hy+2.4],[hx+5,hy+3.1],[hx,hy+2.7]],()=>C.SK[1]);
  spike(hx + 3, hy - 4.6, -1.2, 6.4, 1.3);                                                  // рог
  for (const ex of [-2.2, -0.6]) Q.path([[hx + ex, hy - 3.6, 0.9], [hx + ex - 2.4, hy - 8.6, 0.25]], () => C.SK[2]);   // уши прижаты
  if (P.eye < 2) { pbBall(Q, hx + 2.6, hy - 0.6, 1.2, 0.9, C.EY, { amb: 0.7 }); Q.path([[hx + 2.4, hy - 1.2, 0.15], [hx + 2.6, hy, 0.15]], () => [20, 8, 4]); Q.R(hx, hy - 3, hx + 5, hy + 2, (x, y) => (Math.hypot(x - hx - 2.6, y - hy + 0.6) < 2.2 && Q.dth(x, y) < 0.3 ? [255, 170, 40, 0.5] : null), false); }
  else Q.path([[hx + 1.6, hy - 0.6, 0.3], [hx + 3.6, hy - 0.4, 0.3]], () => C.SK[0]);
  for (const [tx, l] of [[hx + 7.4, 3], [hx + 9, 2.4]]) Q.path([[tx, hy + 2.4, 0.6], [tx + 0.6, hy + 2.4 + l, 0.12]], () => C.HO[2]);   // клыки
  if (P.mouth > 0.4) Q.path([[hx + 5, hy + 2.6, 0.5], [hx + 10.4, hy + 2.2, 0.5]], () => [70, 20, 20]);
  pbDot(Q, hx + 10.6, hy + 1.2, C.SK[0], 0.5);                                             // ноздря
  leg(-13, sw, true); leg(10, -sw, true);
  Q.outline([30, 22, 18]);
}

const ARMAD_MATERIAL = {
  ...PBA,
  SH: [[35,26,20],[65,45,31],[99,68,44],[137,97,59],[176,132,79],[216,177,116]],
  SK: [[40,29,24],[69,46,34],[102,70,49],[143,101,70],[182,136,94]]
};

// Directions run from front clockwise. The profile keeps its authored silhouette.
function drawArmadDirection(Q, P, direction) {
  const view = Math.min(direction, 8 - direction);
  if (view === 2 || P.curl >= .5) return drawArmadCandidate(Q, P);
  const C = ARMAD_MATERIAL;
  const angle = view * Math.PI / 4;
  const side = Math.sin(angle), depth = Math.cos(angle);
  const point = (across, along, height) => {
    const y = (along * depth - across * side) * .24 - height;
    return [across * depth + along * side, P.dead ? -26 - y : y];
  };
  const sphere = (u,v,z,rx,ry,palette,amb) =>
    pbBall(Q,...point(u,v,z),rx,ry,palette,{amb});
  const chain = (points,palette) =>
    pbChain(Q,points.map(([u,v,z,r])=>[...point(u,v,z),r]),palette);
  const facet = (points,color) => pbPoly(Q,points.map(p=>point(...p)),()=>color);
  const horn = (base,tip,width) => {
    const [x,y]=point(...base), [tx,ty]=point(...tip);
    pbPoly(Q,[[x-width,y],[tx,ty],[x+width,y]],(px,py)=>
      pbPick(C.HO,.72-Math.hypot(px-x,py-y)*.09,Q.dth(px,py)));
  };
  pbShadow(Q,view%2?18:13);
  const feet=[];
  for(const u of [-7,7])for(const v of [-11,9]){
    const stride=(P.leg||0)*Math.sign(u*v)*3;
    feet.push({u,v,stride,order:v*depth-u*side});
  }
  feet.sort((a,b)=>a.order-b.order);
  function leg({u,v,stride},near){
    const colors=near?C.SK:C.SK.slice(0,3);
    const forward=v+stride+Math.max(0,P.a||0)*2;
    const knee=v+stride*.55;
    chain([[u*.74,v,10,3.25],[u,knee,5,2.45],[u,forward,1,2.6]],colors);
    facet([[u-2,v,9],[u+.7,v+1.7,8],[u+1,knee+1,5],[u-.8,knee+.4,4.2],[u-2,knee-.7,5.8]],colors[near?3:2]);
    sphere(u,forward+.9,1.1,3,1.6,colors,.47);
    for(const toe of [-1,0,1]){
      const t=u+toe*1.2;
      facet([[t-.48,forward+1,.8],[t+.55,forward+1,1],[t+.65,forward+2.5,.55],[t+.2,forward+4,-.6]],C.HO[near?2:1]);
    }
  }
  function tail(){
    const bend=(P.leg||0)*2;
    chain([[0,-13,9,3.5],[bend*.5,-20,7,2.7],[bend,-27,5,1.8]],C.SH.slice(0,5));
    sphere(bend,-30,5,3.6,3.2,C.SH,.5);
    for(const u of [-1,1])horn([bend+u*2,-30,6],[bend+u*5,-32,8],1.1);
    horn([bend,-30,7],[bend,-33,11],1.1);
  }
  function head(){
    const along=17+Math.max(0,P.a||0)*2.6-(P.curl||0)*3;
    sphere(0,along,9,5.7,4.7,C.SK,.51);
    sphere(0,along+6,8,4.1,2.7,C.SK,.47);
    sphere(0,along+1,12,4.7,2.4,C.SH,.59);
    facet([[-4,along,12],[-2,along+4,13],[2,along+4,13],[4,along,12],[2.8,along+6,10],[-2.8,along+6,10]],C.SH[3]);
    facet([[-3,along+1,12.5],[-1,along+4,13.2],[1,along+4,13.2],[0,along+6,11.6],[-2.8,along+5,11]],C.SH[5]);
    horn([0,along+4,12],[0,along+6,19],1.6);
    for(const u of [-1,1]){
      horn([u*3.4,along-2,12],[u*5,along-4,16],.85);
      if(P.eye<2)sphere(u*3.9,along+2,10,1,.75,C.EY,.7);
      Q.path([[...point(u*2.8,along+8,7),.65],[...point(u*2.8,along+9,4.5),.16]],()=>C.HO[2]);
    }
    Q.path([[...point(-2,along+9,7.8),.3],[...point(2,along+9,7.8),.3]],()=>C.SK[0]);
  }
  feet.filter(f=>f.order<0).forEach(f=>leg(f,false));
  if(view<2)tail();
  const shellWidth=view%2?16.5:12.7;
  sphere(0,0,12,shellWidth,13,C.SH,.44);
  facet([[-shellWidth*.65,-13,7],[-shellWidth*.7,11,7],[shellWidth*.7,11,7],[shellWidth*.65,-13,7]],C.SH[1]);
  const bands=depth>0?[-10,-6,-2,2,6,10]:[10,6,2,-2,-6,-10];
  for(const v of bands){
    const radius=Math.sqrt(1-(v/20)**2);
    const ridge=[[-10*radius,v-3,10],[-8*radius,v-1.3,18],[0,v,12+12*radius],[8*radius,v-1.3,18],[10*radius,v-3,10]];
    const lower=ridge.map(([u,w,h])=>[u,w+2.5* Math.sign(depth),h-.9]);
    facet([...ridge,...lower.reverse()],C.SH[2]);
    const light=ridge.map(([u,w,h])=>[u,w+1.35*Math.sign(depth),h-.25]);
    facet([...ridge,...light.reverse()],C.SH[4]);
    Q.path(ridge.slice(0,3).map(p=>[...point(...p),.46]),()=>C.SH[5]);
  }
  for(const v of [-12,-7,-2,3,8,13]){
    const z=12+13*Math.sqrt(1-(v/20)**2);
    horn([0,v,z-1],[0,v-1,z+4],1.1);
  }
  feet.filter(f=>f.order>=0).forEach(f=>leg(f,true));
  if(view<2)head();
  else tail();
  Q.outline([30,22,18]);
}
