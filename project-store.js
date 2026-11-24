/* Browser-local, multi-project library. Each project has its own save and recovery slot. */
(function(root, factory) {
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.HouseProjectStore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const INDEX='houseplan-studio-library-v1';
  const LEGACY='houseplan-studio-project-v2';
  const DOCUMENT='houseplan-studio-document-';
  const BACKUP='houseplan-studio-recovery-';
  const valid=p=>p&&typeof p==='object'&&Array.isArray(p.floors)&&p.floors.length>0&&p.floors.every(f=>Array.isArray(f.items));
  const parse=s=>{try{return JSON.parse(s)}catch{return null}};
  const copy=v=>JSON.parse(JSON.stringify(v));
  const metadata=p=>({id:p.id,name:String(p.name||'Untitled house').slice(0,70),
    floors:p.floors.length,rooms:p.floors.reduce((n,f)=>n+f.items.filter(e=>e.type==='room').length,0),
    updatedAt:new Date().toISOString()});
  function createProjectStore(storage,idFactory=()=>Math.random().toString(36).slice(2),now=()=>Date.now()){
    const documentKey=id=>DOCUMENT+id,backupKey=id=>BACKUP+id;
    function readIndex(){
      const value=parse(storage.getItem(INDEX));
      return value&&Array.isArray(value.entries)?value:{activeId:null,entries:[]};
    }
    function writeIndex(index){storage.setItem(INDEX,JSON.stringify(index))}
    function uniqueId(){
      let id;
      do{id='project-'+String(idFactory()).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,60)}while(!id||readIndex().entries.some(x=>x.id===id));
      return id;
    }
    function load(id){
      const current=parse(storage.getItem(documentKey(id)));
      if(valid(current))return current;
      const recovered=parse(storage.getItem(backupKey(id)));
      return valid(recovered)?recovered:null;
    }
    function save(project){
      if(!valid(project))throw Error('Cannot save an invalid project');
      const index=readIndex(),existing=index.entries.find(x=>x.id===project.id);
      const next=JSON.stringify(project),old=storage.getItem(documentKey(project.id));
      const backupDue=old&&old!==next&&(!existing?.backupAt||now()-existing.backupAt>60000);
      if(backupDue)storage.setItem(backupKey(project.id),old);
      // Write the document before its index metadata so a failed write cannot
      // make the index claim that unsaved work was safely stored.
      storage.setItem(documentKey(project.id),next);
      const entry={...metadata(project),...(backupDue?{backupAt:now()}:existing?.backupAt?{backupAt:existing.backupAt}:{})};
      const position=index.entries.findIndex(x=>x.id===project.id);
      if(position>=0)index.entries[position]=entry;
      else index.entries.push(entry);
      index.activeId=project.id;
      writeIndex(index);
      return entry;
    }
    function add(project,{name}={}){
      const next=copy(project);
      next.id=uniqueId();
      if(name)next.name=name;
      save(next);
      return next;
    }
    function init(seed){
      const index=readIndex();
      const ids=[index.activeId,...index.entries.map(x=>x.id)].filter(Boolean);
      for(const id of new Set(ids)){
        const project=load(id);
        if(project){
          project.id=id;
          if(index.activeId!==id){index.activeId=id;writeIndex(index)}
          return project;
        }
      }
      const old=parse(storage.getItem(LEGACY));
      return add(valid(old)?old:seed);
    }
    function open(id){
      if(!readIndex().entries.some(x=>x.id===id))return null;
      const project=load(id);if(!project)return null;
      const index=readIndex();index.activeId=id;writeIndex(index);return project;
    }
    function duplicate(id){
      const existing=load(id);if(!existing)return null;
      return add(existing,{name:String(existing.name||'Untitled house').slice(0,62)+' copy'});
    }
    function remove(id){
      const index=readIndex();
      if(index.entries.length<=1||!index.entries.some(e=>e.id===id))return false;
      index.entries=index.entries.filter(e=>e.id!==id);
      if(index.activeId===id)index.activeId=index.entries[0].id;
      writeIndex(index);
      storage.removeItem(documentKey(id));storage.removeItem(backupKey(id));
      return true;
    }
    function recover(id){
      const value=parse(storage.getItem(backupKey(id)));
      if(!valid(value))return null;
      value.id=id;save(value);return value;
    }
    function hasRecovery(id){return valid(parse(storage.getItem(backupKey(id))))}
    function exportAll(){
      const projects=readIndex().entries.map(entry=>load(entry.id)).filter(valid);
      return {format:'houseplan-studio-library',version:1,exportedAt:new Date().toISOString(),projects};
    }
    function importAll(bundle){
      if(bundle?.format!=='houseplan-studio-library'||!Array.isArray(bundle.projects)||!bundle.projects.length||bundle.projects.length>100||bundle.projects.some(p=>!valid(p)))throw Error('Not a valid project library backup');
      const added=[];
      for(const source of bundle.projects)added.push(add(source));
      return added;
    }
    return {init,save,add,load,open,duplicate,remove,recover,hasRecovery,exportAll,importAll,
      list:()=>readIndex().entries.slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),
      activeId:()=>readIndex().activeId};
  }
  return {createProjectStore};
});
