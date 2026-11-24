const assert=require('node:assert/strict');
const {collectWallSegments,magnetPoint,magnetBox,wallSections,connectionsAt,connectionSpan}=require('../dist/geometry.js');
const room=(id,x,y,w,h)=>({id,type:'room',x,y,w,h});

const adjacent=[room('living',0,0,10,10),room('kitchen',10,0,10,10)];
const walls=collectWallSegments(adjacent);
const shared=walls.filter(s=>s.x1===10&&s.x2===10);
assert.equal(shared.length,1,'adjoining rooms must produce one shared wall');
assert.deepEqual(shared[0].roomIds.sort(),['kitchen','living']);
assert.equal(shared[0].y2-shared[0].y1,10);

const partial=collectWallSegments([room('a',0,0,20,20),room('b',20,5,10,10)]);
const partialEdge=partial.filter(s=>s.x1===20&&s.x2===20);
assert.equal(partialEdge.length,3,'a T-junction splits the common edge into three nonoverlapping spans');
assert.equal(partialEdge.reduce((total,s)=>total+s.y2-s.y1,0),20);
assert.equal(partialEdge.filter(s=>s.roomIds.length===2).length,1);

const overlapping=collectWallSegments([...adjacent,{id:'custom-wall',type:'wall',x1:10,y1:0,x2:10,y2:10}]);
const overlapWall=overlapping.find(s=>s.x1===10&&s.x2===10);
assert.equal(overlapping.filter(s=>s.x1===10&&s.x2===10).length,1);
assert.deepEqual(overlapWall.wallIds,['custom-wall']);

const diagonal=collectWallSegments([
  {id:'slope1',type:'wall',x1:0,y1:0,x2:4,y2:4},
  {id:'slope2',type:'wall',x1:4,y1:4,x2:0,y2:0}
]);
assert.equal(diagonal.length,1,'reverse diagonal walls deduplicate');
assert.equal(diagonal[0].wallIds.length,2);

const snapped=magnetPoint({x:9.7,y:10.28},adjacent,.5,.5);
assert.equal(snapped.x,10);
assert.equal(snapped.y,10);
assert.equal(snapped.guideX,10);
const far=magnetPoint({x:6.2,y:4.1},adjacent,.5,.5);
assert.equal(far.x,6);
assert.equal(far.y,4);
assert.equal(far.guideX,null);
const moved=magnetBox({x:6.3,y:7.7,w:4,h:2},adjacent,.5,.5,'living');
assert.equal(moved.x,6,'the far side of a moving room should align to a neighbor');
assert.equal(moved.y,8);
const self=magnetPoint({x:.2,y:.2},[room('self',0,0,10,10)],.5,.5,'self');
assert.equal(self.guideX,null,'selected object must not snap to itself');

const apertures=[
  room('open-room',0,0,25,10),
  {id:'front-door',type:'door',x:7,y:0,angle:0,width:3},
  {id:'front-window',type:'window',x:17,y:0,angle:0,width:4}
];
const topWall=wallSections(apertures).find(s=>s.y1===0&&s.y2===0);
assert.equal(topWall.openings.length,2);
const at=(offset,height)=>topWall.sections.some(s=>s.start<=offset&&s.end>=offset&&s.bottom<=height&&s.top>=height);
assert.equal(at(7,4),false,'door has a genuine full-height lower opening');
assert.equal(at(7,7.2),true,'door retains a header above its opening');
assert.equal(at(17,1.5),true,'window has a solid wall below its sill');
assert.equal(at(17,5),false,'window is cut through at glass height');
assert.equal(at(17,7.5),true,'window has a solid lintel above');
assert.equal(at(3,4),true,'ordinary wall sections remain solid');

const crossJunction=wallSections([
  room('large',0,0,20,10),room('neighbor',10,-10,10,10),
  {id:'junction-door',type:'door',x:10,y:0,angle:0,width:4}
]).filter(s=>s.y1===0&&s.y2===0&&s.openings.some(o=>o.id==='junction-door'));
assert.ok(crossJunction.length>=2,'an opening across a T-junction cuts both segments');

const lift={id:'lift',type:'furniture',subType:'elevator',x:2,y:2,w:7,h:7,throughAll:true};
const stairs={id:'stairs',type:'furniture',subType:'stairs',x:12,y:2,w:4,h:10};
const levels=[{items:[lift,stairs]},{items:[]},{items:[]},{items:[]}];
assert.equal(connectionSpan(levels,0,lift),3);
assert.equal(connectionsAt(levels,1).length,2);
assert.deepEqual(connectionsAt(levels,2).map(x=>x.fixture.id),['lift']);
lift.throughAll=false;
assert.equal(connectionSpan(levels,0,lift),1);
assert.equal(connectionsAt(levels,2).length,0);
console.log('Geometry tests passed');
