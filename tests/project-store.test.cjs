const assert=require('node:assert/strict');
const {createProjectStore}=require('../dist/project-store.js');

function memoryStorage(){
  const data=new Map();
  return {getItem:k=>data.has(k)?data.get(k):null,
    setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),data};
}
let sequence=0,time=100000;
const nextId=()=>String(++sequence);
const sample=()=>({name:'Original house',floors:[{id:'floor1',name:'Ground floor',items:[]}],activeFloorId:'floor1',prefabs:[]});
const storage=memoryStorage(),store=createProjectStore(storage,nextId,()=>time);
const original=store.init(sample());
assert.ok(original.id);
assert.equal(store.list().length,1);
assert.equal(store.activeId(),original.id);

original.floors[0].items.push({id:'room1',type:'room',x:0,y:0,w:5,h:5});
store.save(original);
assert.equal(store.list()[0].rooms,1);
assert.equal(store.hasRecovery(original.id),true,'earlier document must be recoverable');

const other=store.add({...sample(),name:'Second house'});
assert.notEqual(other.id,original.id);
assert.equal(store.list().length,2);
assert.equal(store.open(original.id).floors[0].items.length,1);
const copy=store.duplicate(original.id);
assert.equal(copy.name,'Original house copy');
assert.equal(copy.floors[0].items.length,1);
assert.equal(store.list().length,3);
assert.ok(store.remove(copy.id));
assert.equal(store.list().length,2);

const bundle=store.exportAll();
assert.equal(bundle.format,'houseplan-studio-library');
assert.equal(bundle.projects.length,2);
const restoreStore=createProjectStore(memoryStorage(),nextId,()=>time);
restoreStore.init(sample());
const imported=restoreStore.importAll(bundle);
assert.equal(imported.length,2);
assert.equal(restoreStore.list().length,3,'restore merges without overwriting existing projects');

const recovered=store.recover(original.id);
assert.ok(recovered);
assert.equal(recovered.floors[0].items.length,0,'recovery opens the earlier saved document');
assert.equal(store.open(original.id).floors[0].items.length,0);

const legacyStorage=memoryStorage();
legacyStorage.setItem('houseplan-studio-project-v2',JSON.stringify({...sample(),name:'Legacy project'}));
const migrated=createProjectStore(legacyStorage,nextId,()=>time).init(sample());
assert.equal(migrated.name,'Legacy project','single-project local storage must migrate');
assert.ok(migrated.id);

const brokenStorage=memoryStorage();
const broken=createProjectStore(brokenStorage,nextId,()=>time);
const first=broken.init(sample());
first.name='Updated';time+=61000;broken.save(first);
brokenStorage.setItem('houseplan-studio-document-'+first.id,'{broken json');
assert.equal(broken.load(first.id).name,'Original house','corrupted primary document falls back to recovery');
assert.equal(broken.remove(first.id),false,'cannot delete the final project');
console.log('Project store tests passed');
