const assert=require('node:assert/strict');
const {collectWallSegments,magnetPoint,magnetBox}=require('../dist/geometry.js');
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
console.log('Geometry tests passed');
