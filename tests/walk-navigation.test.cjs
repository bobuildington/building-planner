const test=require('node:test');
const assert=require('node:assert/strict');
const {inside,move}=require('../dist/walk-navigation.js');

test('small movement steps pass between touching rooms without a dead zone',()=>{
  const rooms=[{x:0,y:0,w:10,h:10},{x:10,y:0,w:10,h:10}];
  const end=move({x:9.75,y:5,yaw:0},'forward',.65,rooms);
  assert.ok(end.x>10.35&&end.x<10.5);
});

test('a doorway bridges a small gap between rooms',()=>{
  const rooms=[{x:0,y:0,w:10,h:10},{x:10.8,y:0,w:10,h:10}];
  const from={x:9.6,y:5,yaw:0};
  const withoutDoor=move(from,'forward',1.5,rooms);
  assert.ok(withoutDoor.x<=10.025);
  const withDoor=move(from,'forward',1.5,rooms,[{type:'door',x:10.4,y:5,width:3,angle:90}]);
  assert.ok(withDoor.x>11);
  assert.ok(inside(10.4,5,rooms,[{type:'door',x:10.4,y:5,width:3,angle:90}]));
});

test('sideways stepping lets a user line up with the doorway',()=>{
  const rooms=[{x:0,y:0,w:15,h:15}];
  const from={x:7,y:7,yaw:0};
  const left=move(from,'strafeLeft',.65,rooms);
  const right=move(from,'strafeRight',.65,rooms);
  assert.ok(left.y<6.4);
  assert.ok(right.y>7.6);
  assert.equal(from.y,7);
});

test('movement cannot exit exterior walls or tall furniture',()=>{
  const room=[{x:0,y:0,w:10,h:10}];
  const exterior=move({x:9.7,y:5,yaw:0},'forward',2,room);
  assert.ok(exterior.x<=10.025);
  const blocked=move({x:3,y:5,yaw:0},'forward',3,room,[],x=>x>=4&&x<=6);
  assert.ok(blocked.x<4);
});

test('movement follows camera direction and ignores unknown actions',()=>{
  const from={x:5,y:5,yaw:Math.PI/2};
  assert.ok(move(from,'forward',.7,[]).y>5.6);
  assert.deepEqual(move(from,'jump',3,[]),from);
});
