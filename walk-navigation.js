/* Small-step walkthrough navigation. Shared room edges and doorway passages
   remain traversable, even when an individual tap would land on a wall line. */
((root,factory)=>{
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.HouseWalkNavigation=api;
})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  function inside(x,y,rooms,doors){
    if(!rooms.length)return true;
    if(rooms.some(r=>x>=r.x-.025&&x<=r.x+r.w+.025&&y>=r.y-.025&&y<=r.y+r.h+.025))return true;
    // A placed door extends the walkable footprint a short distance across
    // its wall, accommodating small gaps between separately drawn rooms.
    return doors.some(d=>{
      if(d.type!=='door'||!Number.isFinite(d.width)||d.width<.5)return false;
      const a=(d.angle||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
      const dx=x-d.x,dy=y-d.y;
      return Math.abs(dx*c+dy*s)<=d.width/2-.12&&Math.abs(-dx*s+dy*c)<=.7;
    });
  }
  function move(position,direction,distance,rooms=[],doors=[],occupied=()=>false){
    if(!['forward','back','strafeLeft','strafeRight'].includes(direction)||!Number.isFinite(distance)||distance<=0)return {...position};
    const yaw=position.yaw||0,cos=Math.cos(yaw),sin=Math.sin(yaw);
    const vectors={forward:[cos,sin],back:[-cos,-sin],strafeLeft:[sin,-cos],strafeRight:[-sin,cos]};
    const [dx,dy]=vectors[direction],count=Math.max(1,Math.ceil(distance/.15)),step=distance/count;
    let x=position.x,y=position.y;
    const okay=(nx,ny)=>inside(nx,ny,rooms,doors)&&!occupied(nx,ny,.18);
    for(let i=0;i<count;i++){
      const nx=x+dx*step,ny=y+dy*step;
      if(okay(nx,ny)){x=nx;y=ny;continue}
      // Sliding along an obstruction avoids sticky corner collisions without
      // allowing the camera to leave the building footprint.
      if(okay(nx,y))x=nx;
      else if(okay(x,ny))y=ny;
      else break;
    }
    return {...position,x,y};
  }
  return {inside,move};
});
