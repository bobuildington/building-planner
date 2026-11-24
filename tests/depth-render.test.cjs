const test=require('node:test');
const assert=require('node:assert/strict');
const {rasterize}=require('../dist/depth-render.js');

const quad=(fill,depth,coords=[[0,0],[20,0],[20,20],[0,20]])=>({
  pts:coords.map(([x,y])=>({x,y,depth})),fill,depth
});
const rgb=(image,width,x,y)=>[...image.slice((y*width+x)*4,(y*width+x)*4+4)];

test('near furniture hides a large floor even when supplied first',()=>{
  const near=quad('#b45332',2,[[5,5],[15,5],[15,15],[5,15]]);
  const floor=quad('#3e8f69',12);
  for(const polys of [[near,floor],[floor,near]]){
    const pixels=rasterize(polys,20,20);
    assert.deepEqual(rgb(pixels,20,10,10),[180,83,50,255]);
    assert.deepEqual(rgb(pixels,20,2,2),[62,143,105,255]);
  }
});

test('intersecting walls and floors use per-pixel perspective depth',()=>{
  const tilted={pts:[{x:0,y:0,depth:2},{x:20,y:0,depth:12},{x:20,y:20,depth:12},{x:0,y:20,depth:2}],fill:'#aa0000',depth:7};
  const planar=quad('#0044bb',5);
  const image=rasterize([planar,tilted],20,20);
  assert.deepEqual(rgb(image,20,1,10),[170,0,0,255]);
  assert.deepEqual(rgb(image,20,18,10),[0,68,187,255]);
});

test('transparent window blends over visible solids but not objects in front',()=>{
  const wall=quad('#204060',10),window=quad('rgba(100,200,250,0.5)',5),object=quad('#dd9933',2,[[5,5],[15,5],[15,15],[5,15]]);
  const image=rasterize([window,object,wall],20,20);
  assert.deepEqual(rgb(image,20,10,10),[221,153,51,255]);
  assert.deepEqual(rgb(image,20,2,2),[66,132,173,255]);
});

test('triangles outside the viewport and different winding orders are clipped safely',()=>{
  const vertices=[{x:-10,y:-10,depth:2},{x:30,y:-10,depth:2},{x:10,y:30,depth:2}];
  for(const pts of [vertices,[...vertices].reverse()]){
    const image=rasterize([{pts,fill:'#123456',depth:2}],20,20);
    assert.deepEqual(rgb(image,20,10,10),[18,52,86,255]);
    assert.equal(image.length,1600);
  }
});

test('floor textures survive perspective depth and are hidden by nearer furniture',()=>{
  const coords=[[0,0],[30,0],[30,30],[0,30]];
  const floor={...quad('#ffffff',10,coords),finish:{type:'floor',pattern:'checker',base:'#ffffff',accent:'#101010'}};
  floor.pts=floor.pts.map((p,i)=>({...p,u:coords[i][0]/2,v:coords[i][1]/2}));
  const image=rasterize([floor],30,30);
  assert.notDeepEqual(rgb(image,30,3,3),rgb(image,30,6,3));
  const furniture=quad('#a01234',2,[[12,12],[18,12],[18,18],[12,18]]);
  for(const sorted of [[floor,furniture],[furniture,floor]]){
    const painted=rasterize(sorted,30,30);
    assert.deepEqual(rgb(painted,30,15,15),[160,18,52,255]);
    assert.deepEqual(rgb(painted,30,3,3),rgb(image,30,3,3));
  }
});

test('wall textures use perspective-correct coordinates rather than screen pixels',()=>{
  const wall={
    pts:[{x:0,y:0,depth:3,u:0,v:0},{x:30,y:0,depth:12,u:9,v:0},{x:30,y:30,depth:12,u:9,v:8},{x:0,y:30,depth:3,u:0,v:8}],
    fill:'#abcdef',depth:8,finish:{type:'wall',pattern:'stripes',base:'#f0f0f0',accent:'#111111'}
  };
  const image=rasterize([wall],30,30);
  assert.equal(rgb(image,30,15,12)[3],255);
  const samples=Array.from({length:24},(_,i)=>rgb(image,30,i+3,12).join(','));
  assert.ok(new Set(samples).size>1);
});
