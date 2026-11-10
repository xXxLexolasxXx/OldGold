/* Authoring renderer for the village atlas. Runs only during the bake. */
'use strict';

function paintFrogVillage(c, name, phase, level, scale, ax, ay) {
  const ink = '#252c26';
  const wood = ['#392e26', '#514031', '#71553b', '#97734a', '#bd9766', '#d5ad78'];
  const slate = ['#263d3a', '#34514b', '#47695e', '#618474', '#81a18a'];
  const dyedSlate = ['#3e323c','#574350','#745363','#966e77','#b88988'];
  const leather = ['#45362e','#5f4937','#806045','#a47a53','#c99b6a'];
  const moss = ['#3c5133', '#576b3e', '#74834e', '#9b9b62'];
  const copper = ['#553c2d', '#805b39', '#aa7f49', '#caa05f', '#e6bc79'];
  const water = ['#243d3d', '#2e4947', '#365650', '#416359', '#587465'];
  const glow = phase === '1';
  const broken = phase === 'd';
  const k = 2 * scale;
  const X = x => Math.round(x*k + ax*2);
  const Y = y => Math.round(y*k + ay*2);

  function box(x, y, w, h, color) {
    const l = X(x), t = Y(y);
    c.fillStyle = color;
    c.fillRect(l, t, Math.max(1,X(x+w)-l), Math.max(1,Y(y+h)-t));
  }

  function pixelPoly(points, color) {
    const p = points.map(([x,y])=>[X(x),Y(y)]);
    const ys = p.map(a=>a[1]);
    c.fillStyle = color;
    for (let y = Math.min(...ys); y < Math.max(...ys); y++) {
      const cross = [];
      for (let i=0,j=p.length-1;i<p.length;j=i++) {
        const [x0,y0]=p[j], [x1,y1]=p[i], v=y+.5;
        if ((y0>v)!==(y1>v)) cross.push(x0+(x1-x0)*(v-y0)/(y1-y0));
      }
      cross.sort((a,b)=>a-b);
      for (let i=0;i<cross.length;i+=2) {
        const left=Math.ceil(cross[i]-.5), right=Math.ceil(cross[i+1]-.5);
        c.fillRect(left,y,right-left,1);
      }
    }
  }

  function segment(x, y, u, v, w, color) {
    const d = Math.hypot(u-x,v-y) || 1;
    const a = (v-y)*w/(2*d), b = (u-x)*w/(2*d);
    pixelPoly([[x-a,y+b],[u-a,v+b],[u+a,v-b],[x+a,y-b]],color);
  }

  function inside(points,x,y) {
    let hit=false;
    for(let i=0,j=points.length-1;i<points.length;j=i++){
      const [a,b]=points[j],[u,v]=points[i];
      if((b>y)!==(v>y)&&x<a+(u-a)*(y-b)/(v-b))hit=!hit;
    }
    return hit;
  }

  function flecks(points, colors, seed, cell=3, width=2.5) {
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    for(let y=Math.floor(Math.min(...ys));y<Math.max(...ys);y+=cell/scale){
      for(let x=Math.floor(Math.min(...xs));x<Math.max(...xs);x+=cell/scale){
        const h=(Math.imul(X(x)+seed,1597334677)^Math.imul(Y(y)+seed,3812015801))>>>0;
        if(h%9>2)continue;
        const xx=x+(h%5)*.25/scale, yy=y+((h>>>9)%4)*.25/scale;
        const w=(.5+((h>>>5)%4)*width/3)/scale, t=((h>>>17)%3===0?1:.5)/scale;
        if(inside(points,xx,yy)&&inside(points,xx+w,yy)&&inside(points,xx+w,yy+t)&&inside(points,xx,yy+t)){
          box(xx,yy,w,t,colors[(h>>>21)%colors.length]);
        }
      }
    }
  }

  function panel(points, base, shades, seed, cell, width) {
    pixelPoly(points,base);
    flecks(points,shades,seed,cell,width);
  }

  function peg(x,y,lit=true) {
    box(x-.75,y-.5,1.5,1.5,wood[0]);
    box(x-.5,y-.5,.75,.75,lit?copper[4]:wood[2]);
  }

  function post(x, y, h, w=3) {
    const points=[[x-w*.56,y],[x+w*.55,y-.5],[x+w*.37,y+h-1],[x+w*.15,y+h],[x-w*.45,y+h-.5]];
    panel(points,wood[0],[wood[2],moss[0]],4,2,1);
    segment(x-w*.22,y+.5,x-w*.15,y+h-1.2,w*.31,wood[2]);
    segment(x-w*.26,y+1,x-w*.2,y+h*.55,.5,wood[4]);
    for(const t of [.22,.35,.76])box(x-w*.53,y+h*t,w*1.03,.55,t<.5?wood[1]:moss[0]);
    box(x-w*.45,y+h-.75,w*.83,.65,moss[1]);
  }

  function lantern(x,y,lit=glow) {
    pixelPoly([[x-1,y-5],[x+1,y-5],[x+1,y-2.5],[x+2.5,y-1],[x+2,y+2],[x+.5,y+3],[x-1.5,y+2.5],[x-2.5,y+.5],[x-2,y-1.5],[x-1,y-2.5]],ink);
    box(x-1,y-1.5,2,3.5,lit?'#f4cb7e':copper[2]);
    box(x-.5,y-1.5,1,2,lit?'#fae0a6':copper[4]);
    box(x-1.5,y+2,3,.65,copper[1]);
    box(x-1.5,y-2,3,.65,copper[3]);
  }

  function bridge(points, ruin=false) {
    for(let i=1;i<points.length;i++){
      const [x,y]=points[i-1],[u,v]=points[i], d=Math.hypot(u-x,v-y);
      const dx=(u-x)/d,dy=(v-y)/d;
      for(let t=2;t<d;t+=10)post(x+t*dx,y+t*dy+1.7,ruin?4.5:6,2.7);
      segment(x,y+1,u,v+1,7.3,ink);
      segment(x,y+.7,u,v+.7,5.8,wood[1]);
      const colors=ruin?[wood[2],wood[3],moss[0]]:[wood[3],wood[4],wood[2],wood[3]];
      for(let t=1.5,j=0;t<d-1;t+=2.25,j++){
        const px=x+t*dx,py=y+t*dy, len=2.55+(j%7===2?.25:0);
        segment(px+dy*len,py-dx*len,px-dy*len,py+dx*len,1.65,colors[j%colors.length]);
        if(j%3===0)box(px-dy*.5,py+dx*.5,.55,.55,wood[0]);
        if(j%4===1)box(px+dy*1.8,py-dx*1.8,.65,.65,wood[5]);
      }
      segment(x,y-2.5,u,v-2.5,.5,wood[4]);
      segment(x,y+3.6,u,v+3.6,.65,wood[2]);
    }
  }

  function landing(x,y,w) {
    for(const f of [-.36,-.12,.14,.36])post(x+w*f,y+1,9);
    for(const f of [-.28,.25])segment(x+w*f,y+1,x+w*(f+.14),y+7,1.5,wood[1]);
    const a=x-w/2,b=x+w/2;
    pixelPoly([[a,y-3],[b-1,y-4],[b+1.5,y-.5],[b+1,y+4],[a+1,y+4],[a-1,y+1]],ink);
    panel([[a,y-2.5],[b-1,y-3],[b+.5,y+.5],[a,y+.5]],wood[4],[wood[2],wood[5]],12,2,2);
    panel([[a,y+1],[b+.5,y+1],[b,y+3],[a+.5,y+3]],wood[2],[wood[1],wood[3]],7,2,1.5);
    for(let u=a+2;u<b-1;u+=3.5){segment(u,y-2.5,u+.8,y+.1,.45,wood[2]);peg(u+.25,y-.6);}
  }

  function timberWall(x,y,w,h) {
    const l=x-w*.5,r=x+w*.5,t=y-h;
    pixelPoly([[l,t+1],[r-6,t],[r,t+3],[r,y-1],[r-5,y+1],[l,y]],ink);
    const front=[[l+1,t+1.5],[r-7,t+1],[r-7,y-.5],[l+1,y-1]];
    panel(front,wood[3],[wood[2],wood[4],wood[5]],34,2.6,2.8);
    panel([[r-6,t+1],[r-1,t+3],[r-1,y-1],[r-6,y-.2]],wood[1],[wood[2],wood[0]],27,2,1.6);
    for(let u=l+4;u<r-8;u+=3.5){
      segment(u,t+2,u,y-1,.5,wood[2]);
      if(Math.floor(u)%3===0)segment(u+.65,t+3,u+.65,y-2,.5,wood[4]);
    }
    for(const u of [l+2,r-7]){
      segment(u,t+1,u-.45,y-1,1.5,wood[1]);
      segment(u-.7,t+2,u-.9,y-2,.55,wood[4]);
      peg(u,t+3);peg(u,y-3);
    }
    box(l+1,y-1.7,r-l-7,.65,wood[4]);
  }

  function doorway(x,y,w,h,window=false) {
    const shape=(i,col)=>pixelPoly([[x-w/2+i,y-i],[x-w/2+i,y-h*.66],[x-2+i*.4,y-h+i],[x+1.5-i*.2,y-h+i],[x+w/2-i,y-h*.68],[x+w/2-i,y-i]],col);
    shape(0,ink);shape(.65,copper[2]);shape(1.5,wood[0]);
    if(window){
      pixelPoly([[x-2,y-2],[x-2,y-h*.61],[x,y-h+2],[x+1.5,y-h*.54],[x+1.5,y-2]],glow?'#d4ad6b':'#6b8b78');
      box(x-.3,y-h*.62,.55,h*.46,wood[1]);box(x-1.8,y-h*.38,3.4,.55,wood[1]);
    }else{
      for(let u=x-w/2+2;u<x+w/2-1.5;u+=2)segment(u,y-h*.53,u,y-1,.45,wood[2]);
      peg(x+w*.18,y-h*.29);
    }
    box(x-w/2+.5,y-.75,w-1,.65,wood[4]);
  }

  function roof(x,y,w,h,ramp=slate) {
    const outline=[[-.53,0],[-.44,-.12],[-.35,-.33],[-.27,-.62],[-.13,-.86],[-.09,-.98],[.14,-1],[.27,-.79],[.35,-.48],[.43,-.18],[.54,-.04],[.5,.12],[-.5,.12]];
    const outlineAt=outline.map(([u,v])=>[x+u*w,y+v*h]);
    pixelPoly(outlineAt,ink);
    const light=[[-.49,-.02],[-.42,-.12],[-.33,-.35],[-.25,-.62],[-.12,-.84],[-.08,-.94],[.135,-.95],[.085,-.72],[.1,-.46],[.16,-.22],[.24,-.04]].map(([u,v])=>[x+u*w,y+v*h]);
    const shade=[[.135,-.95],[.25,-.78],[.33,-.47],[.415,-.17],[.51,-.04],[.24,-.04],[.16,-.22],[.1,-.46],[.085,-.72]].map(([u,v])=>[x+u*w,y+v*h]);
    function shingles(surface, dark) {
      panel(surface,ramp[dark?0:1],dark?[ramp[1],ink]:[ramp[2],ramp[3]],11,3.5,3);
      const pitch=scale===2?2.15:2.5;
      for(let yy=y-h+.5,j=0;yy<y-1;yy+=pitch,j++){
        for(let xx=x-w*.52+j%2*2;xx<x+w*.51;xx+=3.65){
          if(!inside(surface,xx,yy)||!inside(surface,xx+2.7,yy)||!inside(surface,xx+.4,yy+1.5))continue;
          const cut=(Math.floor(xx*8+yy*14)+4096)%11;
          box(xx,yy,2.7,.55,ramp[dark?1:cut<3?3:2]);
          box(xx+.25,yy+.55,.6,.9,ramp[dark?1:2]);
          if(!dark&&cut===2)box(xx+.55,yy,1.25,.55,ramp[4]);
        }
      }
    }
    shingles(light,false);shingles(shade,true);
    for (const [u,v,dx,dy,tone] of [
      [-.16,-.81,.15,.1,2],[-.26,-.58,.12,.09,2],[-.14,-.46,.17,.09,2],
      [-.33,-.28,.09,.08,1],[-.22,-.19,.2,.08,2],[.22,-.49,.065,.12,1],[.32,-.16,.11,.09,1]
    ]) {
      const points=[[u,v],[u+dx*.78,v-dy*.14],[u+dx,v+dy*.48],[u+dx*.65,v+dy],[u+dx*.15,v+dy*.87]].map(([a,b])=>[x+w*a,y+h*b]);
      if (points.every(([a,b])=>inside(tone===1&&u>0?shade:light,a,b))) {
        panel(points,ramp[tone],[ramp[tone+1],ramp[tone-1]],23,2.2,1.9);
      }
    }
    segment(x+.138*w,y-.94*h,x+.091*w,y-.72*h,.7,ramp[3]);
    segment(x+.092*w,y-.72*h,x+.107*w,y-.45*h,.55,ramp[2]);
    segment(x+.107*w,y-.45*h,x+.24*w,y-.04*h,.55,ramp[2]);
    segment(x-w*.46,y+.25,x+w*.48,y+.25,.85,ramp[0]);
    segment(x-w*.48,y+1.25,x+w*.46,y+1.25,1,copper[1]);
    for(let u=x-w*.41;u<x+w*.41;u+=3.5){
      box(u,y+.65,1.1,.6,u<x?copper[3]:copper[2]);
    }
    for(const f of [-.48,.47]){
      const u=x+w*f;
      pixelPoly([[u-1.2,y+.9],[u-1.2,y-1.3],[u,y-2.4],[u+1.3,y-1],[u+1.1,y+.8]],copper[2]);
      box(u-.7,y-1.4,.7,.7,copper[4]);
    }
    const patch=[[x-w*.31,y-h*.33],[x-w*.18,y-h*.36],[x-w*.16,y-h*.27],[x-w*.24,y-h*.22],[x-w*.35,y-h*.26]];
    panel(patch,ramp[2],[moss[1],moss[2]],2,1.5,1.2);
  }

  function finial(x,y) {
    segment(x,y+10,x,y,1.65,wood[0]);
    segment(x-.45,y+10,x-.45,y+.5,.65,copper[3]);
    pixelPoly([[x-5,y-2],[x-3,y-2],[x-1,y],[x,y-4],[x+1,y],[x+3,y-2],[x+5,y-2],[x+4,y+1],[x+1.5,y+3],[x-1.5,y+3],[x-4,y+1]],ink);
    pixelPoly([[x-4,y-1],[x-2.5,y-.5],[x-.5,y+1],[x,y-2.8],[x+1,y+1],[x+4,y-1],[x+3.4,y+.5],[x+1,y+2.5],[x-1,y+2.5],[x-3,y+.5]],copper[2]);
    box(x-.5,y-1,1,2,copper[4]);box(x-2.8,y,1,.55,copper[3]);
  }

  function palace() {
    landing(0,-9,62);
    timberWall(0,-12,53,24);
    for(const x of [-18,-10,10,18])doorway(x,-15,6,12,true);
    doorway(0,-12,12,19,level<3);
    for(const x of [-24,23]){
      segment(x,-34,x*.98,-10,2.25,wood[0]);
      segment(x-.55,-32,x-.85,-12,.65,copper[2]);
      peg(x,-31);peg(x,-12);
      lantern(x,-21);
    }
    roof(0,-34,69,21);
    timberWall(0,-43,29,12);
    doorway(0,-44,9,8,true);
    roof(0,-54,45,15);
    for(const x of [-12,12]){
      segment(x,-54,x*.88,-62,1.2,wood[0]);
      box(x*.88-.75,-63,1.5,1.4,copper[3]);
    }
    finial(0,-81);
    const tip=glow?16:14;
    const banner=[[.5,-79],[8,-79],[tip,-76],[tip-4,-72],[tip-1,-69],[7,-70],[.5,-73]];
    panel(banner,'#623e4e',['#82505b','#a36d6c','#4d3541'],16,1.8,2);
    segment(1,-78.5,7.5,-78.5,.5,'#b37d73');
    pixelPoly([[4,-76],[6,-77],[8,-76],[7,-74],[5,-74]],copper[2]);
    box(5,-76.25,1.25,.55,copper[4]);
  }

  function fabric(x,y,w,h,ramp) {
    const left=x-w/2,right=x+w/2;
    const cloth=[[left,y],[right,y-.7],[right-.4,y+h-1],[right-1.6,y+h],[x+.2,y+h-1],[left+.5,y+h]];
    pixelPoly(cloth,ink);
    panel([[left+.5,y+.3],[right-.6,y],[right-1,y+h-1.2],[x+.1,y+h-1.7],[left+1,y+h-.85]],ramp[1],[ramp[2],ramp[0]],17,1.8,1.8);
    segment(left+.8,y+1,left+1.2,y+h-1.5,.55,ramp[3]);
    segment(right-1.2,y+1,right-1.6,y+h-2,.55,ramp[0]);
    const sy=y+h*.58;
    pixelPoly([[x-1.2,sy],[x,sy-1.6],[x+1.2,sy],[x,sy+1.5]],copper[3]);
    box(x-.25,sy-.5,.5,.5,copper[4]);
  }

  function dye() {
    const x=-60;
    landing(x,5,39);
    timberWall(x,2,33,19);
    doorway(x+2,1,9,14);
    roof(x,-16,43,16,dyedSlate);
    for(const [u,y,w,h,ramp] of [[-71,-13,6,10,dyedSlate],[-64,-12,4,9,slate],[-52,-13,6,11,dyedSlate]]){
      fabric(u,y,w,h,ramp);
      box(u-w*.55,y-.45,w*1.1,.6,wood[4]);
    }
    lantern(-77,-8);
    const basin=[[-78,-2],[-70,-2],[-69,0],[-70,4],[-76,4],[-78,2]];
    pixelPoly(basin,ink);
    panel([[-77,-1.5],[-70.5,-1.5],[-69.5,0],[-70.5,3],[-76,3],[-77.5,1]],copper[1],[copper[0],copper[2]],8,1.5,1.2);
    box(-76.5,-.85,5.5,1.3,dyedSlate[2]);box(-76.4,-1,2,.5,dyedSlate[4]);
    box(-76.4,1.4,4.3,.55,copper[3]);
  }

  function glass() {
    const x=60,y=-13;
    landing(x,5,40);
    timberWall(x,2,34,18);
    doorway(x+1,1,10,14);
    doorway(x-8,-1,5,10,true);
    doorway(x+9,-1,5,10,true);
    const shape=[[39,y+1],[41,y-6],[45,y-13],[52,y-20],[60,y-23],[67,y-22],[74,y-17],[79,y-9],[81,y],[78,y+3],[43,y+3]];
    const light=[[41,y],[43,y-6],[47,y-13],[53,y-19],[60,y-21],[62,y-14],[61,y-4],[59,y+1]];
    const shadow=[[60,y-21],[67,y-20],[73,y-16],[78,y-8],[79,y],[59,y+1],[61,y-4],[62,y-14]];
    pixelPoly(shape,ink);
    panel(light,'#50796f',['#5e8b7c','#709b87','#426b61'],14,2,2.2);
    panel(shadow,'#375b58',['#477269','#274b48'],12,2.4,2.2);
    for(const [x0,x1,x2] of [[44,47,55],[51,53,58],[59,62,61],[67,69,65],[74,75,69]]){
      segment(x0,y+1,x1,y-11,1.25,copper[0]);segment(x1,y-11,x2,y-19,1.25,copper[0]);
      segment(x0-.35,y,x1-.4,y-11,.55,copper[3]);segment(x1-.4,y-11,x2-.35,y-19,.55,copper[2]);
    }
    segment(43,y+.95,78,y+.95,1.15,copper[1]);
    segment(44,y+.45,61,y+.45,.55,copper[4]);
    for(const [u,v,w] of [[47,-18,2],[51,-23,3],[56,-26,2.5],[49,-17,2],[63,-29,1.8],[70,-20,1.2]]){
      box(u,v,w,.55,'#97ae95');box(u+.65,v-1,.55,1.3,'#a9bc9b');
    }
    lantern(76,-5);
  }

  function market() {
    const x=-49;
    landing(x,25,31);
    timberWall(x,22,25,13);
    box(x-9,11,18,8,wood[0]);box(x-8,12,16,5,wood[1]);
    box(x-9,17,17,2,wood[2]);box(x-9,17,15,.6,wood[4]);
    for(const [u,ramp] of [[x-6,copper],[x-1,moss],[x+4,dyedSlate]]){
      box(u-1.5,14,3,2.5,ramp[1]);box(u-1,13.5,2,1.25,ramp[2]);box(u-.7,14,.65,.6,ramp[3]);
    }
    const shade=[[x-16,9],[x-11,1],[x+8,1.5],[x+16,8],[x+14,11],[x-15,11]];
    pixelPoly(shade,ink);
    for(let i=0;i<6;i++){
      const a=x-14+i*4.8,b=x-10+i*3.4,r=i%2?slate:leather;
      panel([[a,8.5],[b,2],[b+3.3,2],[a+4.3,8.5],[a+4.3,10],[a+1,10.5],[a,9.7]],r[2],[r[1],r[3]],i,1.5,1.6);
      segment(b,2.8,a,8.3,.55,r[3]);
    }
    post(x-11,9,12,1.6);post(x+10,9,12,1.6);
  }

  function watch() {
    const x=87;
    landing(x,25,26);
    timberWall(x,22,21,19);
    for(const f of [-1,1]) {
      segment(x+f*7,22,x+f*5,4,1.6,wood[1]);
      segment(x+f*7-.4,21,x+f*5-.35,5,.55,wood[4]);
    }
    roof(x,4,28,10,leather);
    doorway(x-.8,18,8,10);
    box(x-5,7,7,2.2,ink);box(x-4,7,4,.55,copper[2]);
    lantern(x+8,11);
    for(let i=0;i<4;i++)box(x-11,15+i*1.85,4,.6,wood[4]);
    segment(x-11,14,x-11,22,.55,wood[2]);
  }

  function gate() {
    const x=12;
    for(const u of [x-10,x+10]){
      post(u,12,20,4.2);
      segment(u-1.4,16,u+2.2,19,1.45,wood[0]);segment(u-1.4,16,u+2.2,19,.6,copper[2]);
      lantern(u,22);
    }
    roof(x,13,29,10);
    pixelPoly([[x-3,10],[x-2,8],[x,6.5],[x+2,8],[x+3,10],[x+1.2,11.5],[x-1.2,11.5]],wood[0]);
    pixelPoly([[x-2,9.8],[x,7.5],[x+2,9.8],[x,10.6]],copper[3]);
    box(x-.45,9,.9,.6,copper[4]);
  }

  function ground() {
    const shore=[[-123,7],[-118,-3],[-105,-9],[-96,-15],[-77,-17],[-59,-19],[-43,-22],[-31,-21],[-16,-23],[0,-22],[18,-23],[27,-21],[46,-22],[65,-20],[77,-17],[91,-16],[104,-12],[112,-8],[121,-3],[124,4],[122,12],[124,18],[118,24],[110,30],[95,32],[88,36],[78,38],[62,38],[53,41],[36,43],[22,42],[13,44],[-11,43],[-21,44],[-35,40],[-51,41],[-63,38],[-77,37],[-87,33],[-102,29],[-111,25],[-119,20],[-122,14]];
    const pool=shore.map(([x,y],i)=>[x*.95+(i%3-1)*1.35,10+(y-10)*.86+(i%5-2)*.55]);
    const dark=pool.map(([x,y],i)=>[x*.9+(i%5-2)*1.4,10+(y-10)*.78+(i%3-1)*.55]);
    panel(shore,broken?'#4f513b':'#48543a',[moss[0],moss[1],wood[2],wood[3]],19,2.6,3.5);
    panel(pool,broken?'#435347':water[2],[water[1],water[3],moss[1]],39,3,3.4);
    panel(dark,broken?'#39493e':water[0],[water[1],water[2],water[3]],67,5,4.5);
    for(let i=0;i<shore.length;i++){
      const [x,y]=shore[i];
      if(i%3===0)rock(x*.985,y*.95+1,i,broken);
      if(i%3===1)reed(x*.99,y*.97+1,i);
    }
    for(const [x,y,w] of [[-106,8,9],[-84,21,12],[-63,31,9],[-34,25,10],[-13,33,7],[10,28,8],[38,32,13],[56,22,8],[74,13,10],[92,21,12],[110,15,6]]){
      box(x+(glow?.5:0),y,w,.5,water[4]);
      box(x+w*.3,y+1.15,w*.6,.5,water[3]);
      box(x+w*.6,y+2.25,w*.25,.5,water[2]);
    }
    if(broken)return ruins();
    bridge([[-100,12],[-69,7],[-37,6],[-17,-3],[0,-9],[33,3],[64,7],[100,15]]);
    bridge([[0,-6],[5,8],[7,19],[12,34]]);
    if(level>=2)bridge([[-35,8],[-38,21],[-57,27]]);
    if(level>=3)bridge([[61,8],[72,20],[87,27]]);
    for(const [x,y,i] of [[-108,13,1],[-83,25,2],[-20,29,0],[34,28,2],[66,28,1],[104,16,0]])lily(x,y,i);
  }

  function rock(x,y,i,ruin) {
    const w=2+i%3,h=1+i%2;
    const shape=[[x-w,y],[x-w*.68,y-h],[x+.8,y-h-.6],[x+w,y-.3],[x+w*.4,y+.95],[x-w*.6,y+.7]];
    panel(shape,ruin?'#595544':'#576052',[moss[1],wood[2],'#7a7d61'],i,1.4,1.2);
    segment(x-w*.52,y-h+.2,x+.6,y-h-.15,.55,ruin?'#797052':'#84846a');
  }

  function reed(x,y,i) {
    for(let j=0;j<4;j++){
      const a=x+j*.85-1, tip=a+(j-1.4)*.8, h=2.5+(i*7+j*5)%5;
      segment(a,y,tip,y-h,.55,moss[j%3]);
      if(j===2)box(tip-.4,y-h-.45,.8,1.6,wood[4]);
    }
  }

  function lily(x,y,i) {
    const shade=[[x-4,y],[x-2.4,y-1.5],[x+.6,y-2],[x+3,y-1.2],[x+4,y],[x+.5,y+.3],[x-.3,y+1],[x-2.3,y+1.2]];
    panel(shade,moss[1],[moss[0],moss[2]],i,1.15,1);
    box(x-.6,y-1.5,1.1,.55,moss[3]);
    if(i!==0){
      pixelPoly([[x-1.8,y-1.6],[x-1.35,y-2.7],[x-.45,y-2.25],[x+.1,y-3.1],[x+.85,y-2.45],[x+1.5,y-2.6],[x+1.4,y-1.4],[x+.45,y-.9]],'#b48580');
      box(x-.35,y-2,1,.55,'#e1b487');
    }
  }

  function ruins() {
    bridge([[-90,12],[-71,8],[-60,8]],true);
    bridge([[24,27],[44,20],[58,21]],true);
    bridge([[-17,9],[-6,4],[12,8]],true);
    const beam=(x,y,u,v,w)=>{
      segment(x,y,u,v,w,wood[0]);
      segment(x-.3,y,u-.3,v,w*.62,wood[2]);
      segment(x-.6,y-.3,u-.6,v-.3,.6,wood[4]);
    };
    landing(-2,-4,51);
    beam(-19,-5,-11,-30,3.6);
    beam(11,-4,19,-20,2.7);
    const eave=[[-29,-9],[-24,-21],[-13,-31],[-7,-42],[4,-45],[4,-37],[11,-35],[15,-30],[26,-26],[21,-21],[26,-15],[17,-10],[8,-15],[1,-12],[-7,-13],[-17,-9]];
    pixelPoly(eave,ink);
    panel([[-27,-10],[-23,-20],[-12,-30],[-6,-41],[3,-43],[3,-36],[11,-34],[14,-29],[24,-26],[20,-21],[24,-16],[17,-11],[7,-16],[1,-13],[-7,-14],[-17,-10]],slate[1],[slate[0],slate[2],moss[1],moss[2]],67,2.25,3.5);
    for(let i=0;i<7;i++)segment(-15+i*.2,-25+i*1.8,3+i*2,-32+i*1.7,.55,slate[i%3]);
    beam(-25,-9,-7,-15,2.1);
    beam(9,-14,30,-3,2.4);
    segment(3,-36,10,-45,1.1,copper[1]);
    box(9,-44,3,.7,copper[3]);
    for(const [x,y,i] of [[-27,-2,1],[-13,4,2],[10,1,3],[20,0,1],[26,3,4]])rock(x,y,i,true);

    // The dye house lost one roof slope. Its rack and dye vat survived.
    landing(-62,7,34);
    beam(-74,6,-72,-11,2.6);
    beam(-55,6,-61,-8,2.35);
    const dyeFall=[[-81,3],[-77,-7],[-71,-12],[-64,-9],[-61,-11],[-63,-6],[-55,-4],[-51,3],[-60,4],[-71,2]];
    pixelPoly(dyeFall,ink);
    panel([[-79,2],[-76,-6],[-71,-11],[-64,-8],[-62,-10],[-64,-5],[-56,-3],[-53,2],[-60,3],[-71,1]],dyedSlate[1],[dyedSlate[0],dyedSlate[2],moss[0]],30,2.3,2.5);
    for(let i=0;i<5;i++)segment(-76+i*.9,-5+i*1.4,-68+i*2,-7+i*1.6,.55,dyedSlate[2]);
    fabric(-53,-.5,4,6,dyedSlate);
    box(-49,1,6,4,wood[0]);box(-48,1,4,.7,copper[1]);box(-48,2,4,2,dyedSlate[2]);

    // Copper ribs and opaque green shards mark the collapsed glasshouse.
    landing(61,8,35);
    beam(46,7,47,-4,2.5);
    beam(70,6,76,-2,2.5);
    for(const [x,y,i] of [[45,6,0],[50,0,1],[56,4,2],[63,-3,3],[71,5,1],[78,1,3]]){
      const shard=[[x-3,y],[x-1,y-3.5],[x+2,y-2],[x+3,y+.5],[x,y+1.2]];
      pixelPoly(shard,slate[i%3]);
      segment(x-1,y-3,x+1.5,y-1.8,.55,i%2?slate[3]:slate[2]);
    }
    for(const [x,y,u,v] of [[46,-3,51,-12],[51,-12,57,-16],[55,2,60,-9],[60,-9,64,-11],[68,-1,74,-5],[74,-5,76,-2]]){
      segment(x,y,u,v,1.35,copper[0]);segment(x-.45,y,u-.45,v,.55,copper[2]);
    }

    // Torn canopy, leaning watchtower and broken gate stay recognizable.
    landing(-49,24,26);
    beam(-60,21,-56,11,2.2);
    fabric(-55,16,9,7,slate);
    fabric(-48,18,6,5,leather);
    box(-45,22,7,3,wood[1]);box(-44,21,5,1,wood[3]);
    landing(87,24,23);
    beam(81,21,77,7,2.7);beam(93,21,88,9,2.9);
    for(let i=0;i<4;i++)segment(78+i*.9,8+i*2,83+i*.8,8+i*2,.7,wood[3]);
    pixelPoly([[78,11],[82,3],[88,3],[93,9],[89,12],[86,10],[83,13]],wood[0]);
    panel([[79,10],[83,4],[88,4],[92,9],[89,11],[86,9],[83,12]],leather[1],[leather[2],moss[0]],43,1.85,1.6);
    beam(2,29,6,14,3.2);beam(23,30,27,25,3.4);
    segment(4,18,14,24,3,slate[0]);segment(4,17,14,23,.65,slate[2]);
    for(const [x,y,i] of [[-96,15,2],[-39,13,3],[-23,18,1],[22,23,1],[36,25,2],[65,17,4],[97,27,0]])rock(x,y,i,true);
    for(const [x,y,i] of [[-95,16,4],[-43,20,5],[-19,17,0],[14,14,4],[39,26,1],[73,18,2]])reed(x,y,i);
  }

  if(name==='ground')ground();
  if(name==='palace')palace();
  if(name==='dye')dye();
  if(name==='glass')glass();
  if(name==='market')market();
  if(name==='watch')watch();
  if(name==='gate')gate();
}

module.exports = paintFrogVillage;
