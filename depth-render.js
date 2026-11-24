/* Perspective depth-buffer renderer for the indoor walkthrough.
 * The whole-building orbit keeps the faster painter renderer, while indoor
 * geometry is resolved pixel by pixel so floors cannot cover nearer objects.
 * Self-contained for offline/mobile use; no WebGL or downloaded libraries.
 */
((root,factory)=>{
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.HouseDepthRender=api;
})(typeof globalThis!=='undefined'?globalThis:this,(root)=>{
  'use strict';
  const finishes=typeof module==='object'&&module.exports?require('./room-finishes.js'):root.HouseRoomFinishes;
  function color(css){
    if(/^#[\da-f]{6}$/i.test(css))return [1,3,5].map(i=>parseInt(css.slice(i,i+2),16)).concat(1);
    const match=/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(css||'');
    return match?[Number(match[1]),Number(match[2]),Number(match[3]),match[4]===undefined?1:Number(match[4])]:[160,185,167,1];
  }
  function rasterize(polygons,width,height,scaleX=1,scaleY=1){
    const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
    const pixels=new Uint8ClampedArray(w*h*4);
    const depth=new Float32Array(w*h); // nearest reciprocal distance, initially 0
    const transparentStamp=new Uint16Array(w*h); // avoid double blending along triangle seams
    const solid=[],transparent=[];
    for(const poly of polygons){
      const rgba=color(poly.fill);
      if(rgba[3]<=0||!Array.isArray(poly.pts)||poly.pts.length<3)continue;
      (rgba[3]>=.9?solid:transparent).push({pts:poly.pts,rgba,depth:poly.depth,finish:poly.finish&&finishes?finishes.prepare(poly.finish):null});
    }
    // A transparent pane must be behind the opaque depth buffer to be hidden.
    // Transparent surfaces themselves are composed far-to-near afterward.
    transparent.sort((a,b)=>b.depth-a.depth);
    function triangle(a,b,c,rgba,blend,stamp,finish){
      const ax=a.x*scaleX,ay=a.y*scaleY,bx=b.x*scaleX,by=b.y*scaleY,cx=c.x*scaleX,cy=c.y*scaleY;
      const area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
      if(!Number.isFinite(area)||Math.abs(area)<.0001||Math.min(a.depth,b.depth,c.depth)<=0)return;
      const left=Math.max(0,Math.floor(Math.min(ax,bx,cx))),right=Math.min(w-1,Math.ceil(Math.max(ax,bx,cx)));
      const top=Math.max(0,Math.floor(Math.min(ay,by,cy))),bottom=Math.min(h-1,Math.ceil(Math.max(ay,by,cy)));
      if(left>right||top>bottom)return;
      const inverse=1/area,q0=1/a.depth,q1=1/b.depth,q2=1/c.depth;
      const textured=finish&&[a.u,a.v,b.u,b.v,c.u,c.v].every(Number.isFinite);
      for(let y=top;y<=bottom;y++){
        const py=y+.5;
        for(let x=left;x<=right;x++){
          const px=x+.5;
          const v0=((bx-px)*(cy-py)-(by-py)*(cx-px))*inverse;
          const v1=((cx-px)*(ay-py)-(cy-py)*(ax-px))*inverse;
          const v2=1-v0-v1;
          if(v0<-.00001||v1<-.00001||v2<-.00001)continue;
          const q=v0*q0+v1*q1+v2*q2,index=y*w+x,offset=index*4;
          if(blend){
            if(q<depth[index]+.00001||transparentStamp[index]===stamp)continue;
            transparentStamp[index]=stamp;
            const alpha=rgba[3],prior=pixels[offset+3]/255,out=alpha+prior*(1-alpha);
            if(out<=0)continue;
            for(let channel=0;channel<3;channel++)pixels[offset+channel]=(rgba[channel]*alpha+pixels[offset+channel]*prior*(1-alpha))/out;
            pixels[offset+3]=Math.round(out*255);
          }else if(q>depth[index]+.0000001){
            depth[index]=q;
            if(textured){
              // Perspective-correct room coordinates prevent wallpaper seams
              // from bending and floor tiles from swimming while looking around.
              const u=(v0*a.u*q0+v1*b.u*q1+v2*c.u*q2)/q;
              const v=(v0*a.v*q0+v1*b.v*q1+v2*c.v*q2)/q;
              const rgb=finishes.sample(finish,u,v);
              pixels[offset]=rgb>>16&255;pixels[offset+1]=rgb>>8&255;pixels[offset+2]=rgb&255;
            }else{
              pixels[offset]=rgba[0];pixels[offset+1]=rgba[1];pixels[offset+2]=rgba[2];
            }
            pixels[offset+3]=255;
          }
        }
      }
    }
    let stamp=0;
    for(const faces of [solid,transparent])for(const face of faces){
      stamp++;
      const pts=face.pts;
      for(let i=1;i<pts.length-1;i++)triangle(pts[0],pts[i],pts[i+1],face.rgba,faces===transparent,stamp,face.finish);
    }
    return pixels;
  }
  return {rasterize};
});
