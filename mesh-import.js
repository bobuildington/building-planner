/* Small, offline-friendly OBJ and uncompressed GLB geometry reader.
   Geometry is normalized into the editor's [width, depth, height] footprint. */
((root,factory)=>{
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.HouseMeshImport=api;
})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const MAX_FACES=900,MAX_VERTICES=3000;
  function normalize(vertices,faces){
    if(!vertices.length||!faces.length)throw Error('No triangular geometry found');
    if(vertices.length>MAX_VERTICES||faces.length>MAX_FACES)throw Error('Model is too detailed for mobile. Use a model with at most 900 triangles.');
    if(vertices.some(v=>v.length!==3||v.some(n=>!Number.isFinite(n)))||faces.some(f=>f.length!==3||f.some(i=>!Number.isInteger(i)||i<0||i>=vertices.length)))throw Error('Invalid model geometry');
    const low=[0,1,2].map(k=>Math.min(...vertices.map(v=>v[k])));
    const high=[0,1,2].map(k=>Math.max(...vertices.map(v=>v[k])));
    const ranges=high.map((v,k)=>v-low[k]);
    if(Math.max(...ranges)<1e-7)throw Error('Model has no visible size');
    // Preserve the original proportions inside the requested footprint, while
    // allowing thin surfaces (like a tabletop) to retain a sensible location.
    const normalized=vertices.map(v=>v.map((n,k)=>Number(((n-low[k])/Math.max(ranges[k],1e-7)).toFixed(5))));
    return {vertices:normalized,faces:faces.map(f=>f.slice()),triangles:faces.length};
  }
  function parseOBJ(source){
    const vertices=[],faces=[];
    for(const line of source.split(/\r?\n/)){
      const parts=line.trim().split(/\s+/);
      if(parts[0]==='v'&&parts.length>=4){
        const xyz=parts.slice(1,4).map(Number);
        // OBJ convention is Y-up, editor Z-up.
        vertices.push([xyz[0],xyz[2],xyz[1]]);
        if(vertices.length>MAX_VERTICES)throw Error('Model has too many vertices for mobile');
      }else if(parts[0]==='f'&&parts.length>=4){
        const polygon=parts.slice(1).map(token=>{
          const index=Number(token.split('/')[0]);
          return index<0?vertices.length+index:index-1;
        });
        for(let j=1;j<polygon.length-1;j++){
          faces.push([polygon[0],polygon[j],polygon[j+1]]);
          if(faces.length>MAX_FACES)throw Error('Model has too many triangles for mobile');
        }
      }
    }
    return normalize(vertices,faces);
  }
  const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  function multiply(a,b){const out=new Array(16).fill(0);for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)out[col*4+row]+=a[k*4+row]*b[col*4+k];return out}
  function nodeMatrix(n){
    if(Array.isArray(n.matrix)&&n.matrix.length===16)return n.matrix;
    const [x,y,z,w]=n.rotation||[0,0,0,1],s=n.scale||[1,1,1],t=n.translation||[0,0,0];
    const m=[1-2*(y*y+z*z),2*(x*y+z*w),2*(x*z-y*w),0,2*(x*y-z*w),1-2*(x*x+z*z),2*(y*z+x*w),0,2*(x*z+y*w),2*(y*z-x*w),1-2*(x*x+y*y),0,t[0],t[1],t[2],1];
    for(let col=0;col<3;col++)for(let row=0;row<3;row++)m[col*4+row]*=s[col];
    return m;
  }
  function parseGLB(buffer){
    const bytes=buffer instanceof ArrayBuffer?buffer:buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength);
    if(bytes.byteLength<20)throw Error('Invalid GLB file');
    const data=new DataView(bytes);
    if(data.getUint32(0,true)!==0x46546c67||data.getUint32(4,true)!==2||data.getUint32(8,true)!==bytes.byteLength)throw Error('Expected a glTF 2.0 .glb file');
    let json=null,binary=null,offset=12;
    while(offset+8<=bytes.byteLength){
      const length=data.getUint32(offset,true),type=data.getUint32(offset+4,true);offset+=8;
      if(length>bytes.byteLength-offset)throw Error('Truncated GLB chunk');
      if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,offset,length)));
      if(type===0x004e4942)binary=new DataView(bytes,offset,length);
      offset+=length;
    }
    if(!json||!binary)throw Error('GLB requires embedded mesh data');
    if(json.extensionsRequired?.length)throw Error('Compressed or extended GLB models are not supported. Export an uncompressed GLB.');
    const readAccessor=(index,components)=>{
      const acc=json.accessors?.[index],view=json.bufferViews?.[acc?.bufferView];
      if(!acc||!view||view.buffer!==0||acc.sparse||acc.type!==(components===3?'VEC3':'SCALAR'))throw Error('Unsupported GLB accessor');
      const sizes={5121:1,5123:2,5125:4,5126:4},size=sizes[acc.componentType];
      if(!size||(components===3&&acc.componentType!==5126))throw Error('Unsupported GLB vertex/index format');
      const stride=view.byteStride||components*size,start=(view.byteOffset||0)+(acc.byteOffset||0);
      if(!Number.isInteger(acc.count)||acc.count>150000||start<0||start+(acc.count-1)*stride+components*size>binary.byteLength)throw Error('Invalid GLB buffer length');
      const result=[];
      for(let i=0;i<acc.count;i++){
        const row=[];
        for(let j=0;j<components;j++){
          const at=start+i*stride+j*size;
          row.push(acc.componentType===5126?binary.getFloat32(at,true):acc.componentType===5125?binary.getUint32(at,true):acc.componentType===5123?binary.getUint16(at,true):binary.getUint8(at));
        }
        result.push(components===1?row[0]:row);
      }
      return result;
    };
    const vertices=[],faces=[];
    const nodes=json.nodes||[];
    const traverse=(nodeIndex,parent,visited)=>{
      if(visited.has(nodeIndex))return;
      const node=nodes[nodeIndex];if(!node)return;
      const next=new Set(visited);next.add(nodeIndex);
      const matrix=multiply(parent,nodeMatrix(node));
      if(Number.isInteger(node.mesh)){
        const mesh=json.meshes?.[node.mesh];
        for(const primitive of mesh?.primitives||[]){
          if(primitive.mode!==undefined&&primitive.mode!==4)continue;
          if(primitive.attributes?.POSITION===undefined)continue;
          const positions=readAccessor(primitive.attributes.POSITION,3),indices=primitive.indices===undefined?positions.map((_,i)=>i):readAccessor(primitive.indices,1);
          const base=vertices.length;
          for(const v of positions){
            const nx=matrix[0]*v[0]+matrix[4]*v[1]+matrix[8]*v[2]+matrix[12];
            const ny=matrix[1]*v[0]+matrix[5]*v[1]+matrix[9]*v[2]+matrix[13];
            const nz=matrix[2]*v[0]+matrix[6]*v[1]+matrix[10]*v[2]+matrix[14];
            vertices.push([nx,nz,ny]);
          }
          for(let i=0;i+2<indices.length;i+=3)faces.push([base+indices[i],base+indices[i+1],base+indices[i+2]]);
          if(faces.length>MAX_FACES||vertices.length>MAX_VERTICES)throw Error('Model is too detailed for mobile. Limit to 900 triangles.');
        }
      }
      for(const child of node.children||[])traverse(child,matrix,next);
    };
    const scene=json.scenes?.[json.scene||0];
    const roots=scene?.nodes||nodes.map((_,i)=>i).filter(i=>!nodes.some(n=>n.children?.includes(i)));
    for(const index of roots)traverse(index,identity(),new Set());
    return normalize(vertices,faces);
  }
  function validMesh(mesh){
    if(!mesh||!Array.isArray(mesh.vertices)||!Array.isArray(mesh.faces))return false;
    try{normalize(mesh.vertices,mesh.faces);return true}catch{return false}
  }
  return {parseOBJ,parseGLB,validMesh};
});
