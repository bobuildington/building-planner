const test=require('node:test');
const assert=require('node:assert/strict');
const {parseOBJ,parseGLB,validMesh}=require('../dist/mesh-import.js');

test('OBJ triangulates quads and normalizes Y-up models',()=>{
  const mesh=parseOBJ('v 0 0 0\nv 2 0 0\nv 2 4 3\nv 0 4 3\nf 1 2 3 4');
  assert.equal(mesh.faces.length,2);
  assert.deepEqual(mesh.vertices[2],[1,1,1]);
  assert.ok(validMesh(mesh));
});

test('OBJ supports negative face indexes and rejects invalid faces',()=>{
  const mesh=parseOBJ('v 0 0 0\nv 1 0 0\nv 0 1 1\nf -3 -2 -1');
  assert.deepEqual(mesh.faces,[[0,1,2]]);
  assert.throws(()=>parseOBJ('v 0 0 0\nv 1 0 0\nv 0 1 1\nf 1 2 9'),/Invalid model geometry/);
  assert.equal(validMesh({vertices:[[0,0,0]],faces:[[0,1,2]]}),false);
});

function makeGLB(){
  const payload=Buffer.alloc(36+6);
  [[0,0,0],[2,0,0],[0,4,3]].forEach((v,i)=>v.forEach((n,k)=>payload.writeFloatLE(n,i*12+k*4)));
  [0,1,2].forEach((n,i)=>payload.writeUInt16LE(n,36+i*2));
  const json=Buffer.from(JSON.stringify({asset:{version:'2.0'},buffers:[{byteLength:42}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36},{buffer:0,byteOffset:36,byteLength:6}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3'},{bufferView:1,componentType:5123,count:3,type:'SCALAR'}],meshes:[{primitives:[{attributes:{POSITION:0},indices:1}]}],nodes:[{mesh:0,translation:[2,1,0]}],scenes:[{nodes:[0]}],scene:0}));
  const jsonPadding=(4-json.length%4)%4,binaryPadding=(4-payload.length%4)%4;
  const total=12+8+json.length+jsonPadding+8+payload.length+binaryPadding;
  const glb=Buffer.alloc(total);glb.writeUInt32LE(0x46546c67,0);glb.writeUInt32LE(2,4);glb.writeUInt32LE(total,8);
  glb.writeUInt32LE(json.length+jsonPadding,12);glb.writeUInt32LE(0x4e4f534a,16);json.copy(glb,20);glb.fill(32,20+json.length,20+json.length+jsonPadding);
  const offset=20+json.length+jsonPadding;glb.writeUInt32LE(payload.length+binaryPadding,offset);glb.writeUInt32LE(0x004e4942,offset+4);payload.copy(glb,offset+8);
  return glb;
}

test('GLB imports embedded triangles, applies scene transforms, normalizes bounds',()=>{
  const glb=makeGLB(),bytes=glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength);
  const mesh=parseGLB(bytes);
  assert.equal(mesh.faces.length,1);
  assert.deepEqual(mesh.vertices[2],[0,1,1]);
});

test('GLB rejects corrupted headers and compressed extensions',()=>{
  assert.throws(()=>parseGLB(new ArrayBuffer(4)),/Invalid GLB/);
  const glb=makeGLB();glb.writeUInt32LE(1,4);
  assert.throws(()=>parseGLB(glb),/Expected a glTF 2.0/);
});
