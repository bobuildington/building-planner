const test=require('node:test');
const assert=require('node:assert/strict');
const rooms=require('../dist/room-architecture.js');

const box=(x,y,w,h,ceilingHeight)=>({type:'room',x,y,w,h,ceilingHeight});

test('new and existing rooms use practical ceiling heights',()=>{
  assert.equal(rooms.roomHeight(box(0,0,8,8)),8);
  assert.equal(rooms.roomHeight(box(0,0,8,8,12.5)),12.5);
  assert.equal(rooms.roomHeight(box(0,0,8,8,50)),20);
  assert.equal(rooms.roomHeight(box(0,0,8,8,4)),7.5);
});

test('upper floors lift automatically above tall rooms, even with mixed heights',()=>{
  const floors=[{items:[box(0,0,10,10,14),box(10,0,10,10,8)]},{items:[box(0,0,20,10,10)]},{items:[box(0,0,20,10,8)]}];
  assert.deepEqual(rooms.levelHeights(floors),[14,10,8]);
  assert.deepEqual(rooms.levelOffsets(floors),[0,14.7,25.4]);
  assert.deepEqual(rooms.levelOffsets(floors,true),[0,18,32]);
});

test('adjoining rooms can decorate opposite sides of one wall',()=>{
  const west=box(0,0,12,10),east=box(12,0,9,10);
  const wall={x1:12,y1:0,x2:12,y2:10,ux:0,uy:1};
  assert.equal(rooms.sideOfRoom(west,wall),'east');
  assert.equal(rooms.sideOfRoom(east,wall),'west');
  assert.notEqual(rooms.roomFaceSign(west,wall),rooms.roomFaceSign(east,wall));
});

test('cutaway targets exterior walls facing the orbit camera',()=>{
  const west=box(0,0,12,10);
  const north={x1:0,y1:0,x2:12,y2:0,ux:1,uy:0};
  const south={x1:0,y1:10,x2:12,y2:10,ux:1,uy:0};
  assert.equal(rooms.isFrontExteriorWall(north,west,0),true);
  assert.equal(rooms.isFrontExteriorWall(south,west,0),false);
});

test('fixtures follow their containing room ceiling',()=>{
  const list=[box(0,0,10,10,8),box(10,0,10,10,13.5)];
  assert.equal(rooms.ceilingForFixture({x:12,y:3,w:2,h:2},list),13.5);
  assert.equal(rooms.ceilingForFixture({x:1,y:3,w:2,h:2},list),8);
});
