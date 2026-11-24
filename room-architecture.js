/* Room-height and wall-side helpers shared by the editor and 3D preview. */
((root,factory)=>{
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.HouseRoomArchitecture=api;
})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const sides=['north','east','south','west'];
  const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
  const roomHeight=r=>clamp(Number.isFinite(Number(r?.ceilingHeight))&&r?.ceilingHeight!==undefined?Number(r.ceilingHeight):8,7.5,20);
  const levelHeights=floors=>floors.map(f=>Math.max(8,...f.items.filter(e=>e.type==='room').map(roomHeight)));
  function levelOffsets(floors,separated=false){
    const heights=levelHeights(floors),offsets=[];let z=0;
    for(let i=0;i<heights.length;i++){offsets.push(z);z+=heights[i]+(separated?4:.7)}
    return offsets;
  }
  function sideOfRoom(room,wall){
    const cx=(wall.x1+wall.x2)/2,cy=(wall.y1+wall.y2)/2;
    const distances=[Math.abs(cy-room.y),Math.abs(cx-room.x-room.w),Math.abs(cy-room.y-room.h),Math.abs(cx-room.x)];
    return sides[distances.indexOf(Math.min(...distances))];
  }
  function roomFaceSign(room,wall){
    const midX=(wall.x1+wall.x2)/2,midY=(wall.y1+wall.y2)/2;
    const vx=room.x+room.w/2-midX,vy=room.y+room.h/2-midY;
    return Math.sign(vx*-wall.uy+vy*wall.ux)||1;
  }
  function isFrontExteriorWall(wall,room,theta){
    if(!room)return false;
    const side=sideOfRoom(room,wall);
    const outward=side==='north'?[0,-1]:side==='south'?[0,1]:side==='west'?[-1,0]:[1,0];
    const camera=[-Math.sin(theta),-Math.cos(theta)];
    return outward[0]*camera[0]+outward[1]*camera[1]>.27;
  }
  function ceilingForFixture(fixture,rooms){
    const x=fixture.x+fixture.w/2,y=fixture.y+fixture.h/2;
    const inRoom=rooms.find(r=>x>=r.x-.1&&x<=r.x+r.w+.1&&y>=r.y-.1&&y<=r.y+r.h+.1);
    return roomHeight(inRoom);
  }
  return {sides,roomHeight,levelHeights,levelOffsets,sideOfRoom,roomFaceSign,isFrontExteriorWall,ceilingForFixture};
});
