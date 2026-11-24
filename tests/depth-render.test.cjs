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
