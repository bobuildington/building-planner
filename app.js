(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const svg = $('plan'), drawing = $('drawing'), underlay = $('underlayLayer'), connectionsLayer=$('connectionsLayer'), tempDrawing = $('tempDrawing'), handles = $('interactionLayer');
  const snapGuides=$('snapGuideLayer'), geometry=window.HouseGeometry;
  const modelCanvas = $('modelCanvas'), ctx3d = modelCanvas.getContext('2d');
  const walkCanvas=document.createElement('canvas'),walkContext=walkCanvas.getContext('2d');
  let uid = 100;
  const id = () => 'p' + Date.now().toString(36) + (uid++).toString(36);
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone = x => JSON.parse(JSON.stringify(x));
  const round = n => Math.round(n*10)/10;
  const nice = n => String(Math.round(n*10)/10).replace(/\.0$/,'');
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const names = {sofa:'Sofa',bed:'Bed',table:'Dining table',desk:'Desk',sink:'Sink',toilet:'Toilet',stove:'Stove',plant:'Plant',stairs:'Stairs',elevator:'Elevator',rug:'Area rug',ceilingLight:'Ceiling light',pendant:'Pendant lamp',ceilingFan:'Ceiling fan'};
  const sizes = {sofa:[6,3],bed:[5,7],table:[5,4],desk:[4,2],sink:[2.5,2],toilet:[2,3],stove:[2.5,2.5],plant:[2,2],stairs:[4,10],elevator:[7,7],rug:[7,5],ceilingLight:[2.3,2.3],pendant:[2.8,2.8],ceilingFan:[5,5]};
  const safeColor = color => /^#[0-9a-f]{6}$/i.test(color||'')?color:'#b5bfa7';
  const floorMaterials={default:['Classic pale','#e4f0e3'],oak:['Natural oak','#d8bc91'],walnut:['Dark walnut','#8e725e'],tile:['Soft tile','#d5dcd9'],concrete:['Concrete','#adb7b4'],carpet:['Carpet','#b7c9b2'],stone:['Warm stone','#c5b6a2']};
  const wallMaterials={sage:['Sage','#aecbb7'],white:['Soft white','#e5e6df'],sand:['Sand','#dfc8ad'],blue:['Dusty blue','#acc7d1'],clay:['Warm clay','#ceafa3']};
  const materialKey=(dict,value,fallback)=>Object.hasOwn(dict,value)?value:fallback;
  const finishes=window.HouseRoomFinishes;
  const architecture=window.HouseRoomArchitecture;
  const ceilingTypes=new Set(['ceilingLight','pendant','ceilingFan']);
  const roomTextureCache=new Map();
  const defaultFloorPattern={default:'plain',oak:'planks',walnut:'planks',tile:'tile',concrete:'plain',carpet:'carpet',stone:'stone'};
  const floorFinish=e=>finishes.prepare({type:'floor',pattern:finishes.validPattern('floor',e?.floorPattern)?e.floorPattern:defaultFloorPattern[materialKey(floorMaterials,e?.floorMaterial,'default')],base:e?.floorTint||floorMaterials[materialKey(floorMaterials,e?.floorMaterial,'default')][1],accent:e?.floorAccent||'#8e9c89'});
  const wallFinish=e=>finishes.prepare({type:'wall',pattern:finishes.validPattern('wall',e?.wallPattern)?e.wallPattern:'paint',base:e?.wallTint||wallMaterials[materialKey(wallMaterials,e?.wallMaterial,'sage')][1],accent:e?.wallAccent||'#719483'});
  const wallFinishForSide=(room,side)=>{
    const common=wallFinish(room),override=room?.wallSides?.[side];
    return override?finishes.prepare({type:'wall',pattern:override.pattern||common.pattern,base:override.base||common.base,accent:override.accent||common.accent}):common;
  };
  const objectName = e => e.type==='furniture'?(e.subType==='custom'?e.name||'Custom object':names[e.subType]||'Object'):e.type[0].toUpperCase()+e.type.slice(1);
  const room=(x,y,w,h,name)=>({id:id(),type:'room',x,y,w,h,name});
  const furniture=(subType,x,y,extra={})=>({id:id(),type:'furniture',subType,x,y,w:sizes[subType]?.[0]||4,h:sizes[subType]?.[1]||3,rotation:0,...(subType==='elevator'?{throughAll:true}:{}),...(subType==='rug'?{color:'#c49d7b'}:{}),...(ceilingTypes.has(subType)?{drop:subType==='pendant'?2.2:subType==='ceilingFan'?1.2:.3,color:'#f7d999'}:{}),...extra});
  const opening=(type,x,y,angle,width)=>({id:id(),type,x,y,angle,width});
  const sample=()=>{
    const ground={id:id(),name:'Ground floor',items:[
      room(7,7,17,12,'Living room'),room(24,7,12,12,'Kitchen'),
      room(7,19,13,11,'Bedroom'),room(20,19,8,11,'Bathroom'),room(28,19,8,11,'Office'),
      opening('door',15,7,0,3),opening('door',24,12,90,3),opening('door',13,19,0,3),
      opening('door',23,19,0,2.5),opening('door',32,19,0,2.5),
      opening('window',11,7,0,4),opening('window',32,7,0,4),opening('window',7,24,90,4),
      furniture('sofa',9.5,10),furniture('table',29,11),furniture('bed',9,22),
      furniture('sink',21,25),furniture('toilet',25,25),furniture('desk',30,23),
      furniture('rug',11,13),furniture('ceilingFan',15,10),furniture('pendant',30,10)
    ]};
    const upper={id:id(),name:'Second floor',items:[
      room(7,7,16,12,'Primary bedroom'),room(23,7,13,12,'Bedroom 2'),
      room(7,19,13,11,'Bathroom'),room(20,19,16,11,'Loft / lounge'),
      opening('door',14,19,0,3),opening('door',28,19,0,3),
      opening('window',12,7,0,4),opening('window',30,7,0,4),opening('window',36,23,90,4),
      furniture('bed',10,10),furniture('bed',26,10),furniture('sink',10,23),
      furniture('sofa',24,23),furniture('plant',32,25),furniture('ceilingLight',11,13)
    ]};
    return {name:'The Evergreen House',floors:[ground,upper],activeFloorId:ground.id,viewMode:'2d',prefabs:[]};
  };
  const store=window.HouseProjectStore.createProjectStore(localStorage,()=>id());
  let project;
  try{project=store.init(sample())}catch(e){project=sample()}
  if(!Array.isArray(project.prefabs))project.prefabs=[];
  if(!project.floors.some(f=>f.id===project.activeFloorId))project.activeFloorId=project.floors[0].id;
  project.viewMode='2d';
  const floor=()=>project.floors.find(f=>f.id===project.activeFloorId)||project.floors[0];
  let selected=null, activeTool='select', furnitureTool=null, currentTab='properties',wallScope='all';
  let showUnderlay=true,alignBelow=true,magnetEnabled=true;
  let snapEnabled=true, pointer=null, draft=null, history=[], future=[], saveTimer=null;
  let sheetOpen=false;
  const isMobile=()=>matchMedia('(max-width: 840px)').matches;
  const touchPoints=new Map();
  let pinch=null;
  let camera={cx:22,cy:18.5,zoom:1};
  let orbit={theta:-0.73,phi:0.86,zoom:1};
  let spin=null, showAll=true, separateFloors=false,cutawayWalls=true,xrayWalls=false;
  let cameraMode='orbit',walk={x:15,y:15,z:5.1,yaw:0,pitch:0};
  let hintTimer=null;
  const state=()=>JSON.stringify(project);
  function changed(previous){if(previous!==state()){history.push(previous);if(history.length>80)history.shift();future=[];save();render();return true}return false}
  function persistNow(){
    if(saveTimer===null)return !$('saveState').textContent.includes('unavailable');
    clearTimeout(saveTimer);saveTimer=null;
    try{store.save(project);$('saveState').textContent='● Saved locally';return true}
    catch(e){$('saveState').textContent='● Save unavailable';return false}
  }
  function requireSaved(){if(!persistNow())throw Error('Your current design has not saved. Export it before switching projects.')}
  function save(){
    $('saveState').textContent='● Saving…';
    clearTimeout(saveTimer);
    saveTimer=setTimeout(persistNow,200);
  }
  // Phones may suspend a PWA before the normal save debounce finishes.
  addEventListener('pagehide',persistNow);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')persistNow()});
  function toast(message){const t=$('toast');t.textContent=message;t.classList.add('show');clearTimeout(hintTimer);hintTimer=setTimeout(()=>t.classList.remove('show'),2600)}
  function setStatus(message){$('statusMessage').textContent=message}
  function snap(v){return snapEnabled?Math.round(v*2)/2:round(v)}
  function snapTolerance(){return Math.min(1.65,Math.max(.18,viewSize().w/Math.max(svg.clientWidth,1)*13))}
  function activeFloorIndex(){return project.floors.findIndex(f=>f.id===project.activeFloorId)}
  function alignmentItems(){
    const i=activeFloorIndex(),items=floor().items;
    return i>0&&alignBelow?[...items,...project.floors[i-1].items.filter(e=>e.type==='room'||e.type==='wall')]:items;
  }
  function snapPoint(raw,exclude=null){
    return magnetEnabled?geometry.magnetPoint(raw,alignmentItems(),snapTolerance(),snapEnabled?.5:.1,exclude):{x:snap(raw.x),y:snap(raw.y),guideX:null,guideY:null};
  }
  function snapBox(box,exclude=null){
    return magnetEnabled?geometry.magnetBox(box,alignmentItems(),snapTolerance(),snapEnabled?.5:.1,exclude):{x:snap(box.x),y:snap(box.y),guideX:null,guideY:null};
  }
  function showSnapGuides(match){
    if(!match||match.guideX===null&&match.guideY===null){snapGuides.innerHTML='';return}
    const {w,h}=viewSize(),left=camera.cx-w/2,top=camera.cy-h/2,stroke='stroke="#2eab72" stroke-width=".14" stroke-dasharray=".4 .25"';
    snapGuides.innerHTML=(match.guideX!==null?`<line x1="${match.guideX}" x2="${match.guideX}" y1="${top}" y2="${top+h}" ${stroke}/>`:'')+
      (match.guideY!==null?`<line x1="${left}" x2="${left+w}" y1="${match.guideY}" y2="${match.guideY}" ${stroke}/>`:'');
  }
  function getPoint(event){
    const p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;
    const m=svg.getScreenCTM();if(!m)return {x:0,y:0};
    const o=p.matrixTransform(m.inverse());return {x:o.x,y:o.y};
  }
  function viewSize(){
    const box=$('stage').getBoundingClientRect();
    const w=(isMobile()?43:57)/camera.zoom,h=w*(Math.max(1,box.height)/Math.max(1,box.width));
    return {w,h};
  }
  function updateView(){const {w,h}=viewSize();svg.setAttribute('viewBox',`${camera.cx-w/2} ${camera.cy-h/2} ${w} ${h}`);$('zoomText').textContent=Math.round(camera.zoom*100)+'%';const line=document.querySelector('.scale-line');if(line)line.style.width=Math.max(20,Math.min(135,5*$('stage').clientWidth/w))+'px'}
  function lineDist(p,a,b){
    const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
    if(!den)return {d:Math.hypot(p.x-a.x,p.y-a.y),point:a,angle:0};
    const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/den,0,1);
    const q={x:a.x+t*dx,y:a.y+t*dy};
    return {d:Math.hypot(q.x-p.x,q.y-p.y),point:q,angle:Math.atan2(dy,dx)*180/Math.PI,length:Math.sqrt(den)};
  }
  function nearWall(p){
    const edges=[];
    for(const e of floor().items){
      if(e.type==='wall')edges.push([{x:e.x1,y:e.y1},{x:e.x2,y:e.y2}]);
      if(e.type==='room'){
        const x=e.x,y=e.y,w=e.w,h=e.h;
        edges.push([{x,y},{x:x+w,y}],[{x:x+w,y},{x:x+w,y:y+h}],[{x:x+w,y:y+h},{x,y:y+h}],[{x,y:y+h},{x,y}]);
      }
    }
    let best=null;
    for(const [a,b] of edges){const v=lineDist(p,a,b);if(!best||v.d<best.d)best=v}
    return best&&best.d<1.5&&best.length>1.5?best:null;
  }
  function itemById(itemId){return floor().items.find(x=>x.id===itemId)}
  function getTarget(evt){const el=evt.target.closest('[data-id]');return el?.getAttribute('data-id')||null}
  function svgText(t,x,y,size,color,extra=''){return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="${color}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="${size}" ${extra}>${esc(t)}</text>`}
  function showRoom(e){
    // Room fills remain individually selectable; their wall outlines are
    // generated once for the entire floor by collectWallSegments().
    const patternId='finish-'+String(e.id).replace(/[^a-z0-9_-]/gi,'');
    return `<g data-id="${e.id}" class="plan-item"><defs>${finishes.svgFloorPattern(patternId,floorFinish(e))}</defs><rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" fill="url(#${patternId})" fill-opacity=".92" stroke="${e.id===selected?'#438e68':'none'}" stroke-width=".12" stroke-dasharray=".4 .2"/><rect x="${e.x+.26}" y="${e.y+.26}" width="${Math.max(0,e.w-.52)}" height="${Math.max(0,e.h-.52)}" fill="none" stroke="#b3c8b7" stroke-width=".045" pointer-events="none"/></g>`;
  }
  function showRoomAnnotation(e){return `<g pointer-events="none"><rect x="${e.x+.75}" y="${e.y+.74}" width="${Math.min(e.w-1.4,Math.max(4,e.name.length*.43+1.4))}" height="2.2" rx=".26" fill="#f6faf5" fill-opacity=".88"/><text x="${e.x+1.1}" y="${e.y+1.58}" fill="#446457" font-family="Inter,Segoe UI,Arial,sans-serif" font-weight="700" font-size=".72">${esc(e.name)}</text><text x="${e.x+1.1}" y="${e.y+2.42}" fill="#8da797" font-family="Inter,Segoe UI,Arial,sans-serif" font-size=".57">${nice(e.w)}' × ${nice(e.h)}'</text></g>`}
  function showWall(e){
    const len=Math.hypot(e.x2-e.x1,e.y2-e.y1);
    return `<g data-id="${e.id}" class="plan-item">${selected===e.id?`<line x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}" stroke="#348560" stroke-width=".52" stroke-linecap="round"/>${svgText(nice(len)+" ft",(e.x1+e.x2)/2,(e.y1+e.y2)/2-1,.65,'#3c825d','pointer-events="none"')}`:''}<line x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}" stroke="transparent" stroke-width="1.3"/></g>`;
  }
  function showOpening(e){
    const width=e.width||3,door=e.type==='door';
    const g=`translate(${e.x} ${e.y}) rotate(${e.angle||0})`;
    return `<g data-id="${e.id}" transform="${g}" class="plan-item"><line x1="${-width/2}" x2="${width/2}" y1="0" y2="0" stroke="#fbfcfa" stroke-width=".67" />${door?`<path d="M ${-width/2} 0 L ${-width/2} ${-width} A ${width} ${width} 0 0 1 ${width/2} 0" fill="none" stroke="#cb9c72" stroke-width=".11"/><line x1="${-width/2}" y1="0" x2="${-width/2}" y2="${-width}" stroke="#b17d50" stroke-width=".19"/>`:`<rect x="${-width/2}" y="-.18" width="${width}" height=".36" fill="#d8eef0" stroke="#5c9ca9" stroke-width=".12"/><line x1="${-width/2}" x2="${width/2}" y1="0" y2="0" stroke="#83bdc1" stroke-width=".07"/>`}<rect x="${-width/2}" y="-.45" width="${width}" height=".9" fill="transparent" stroke="${selected===e.id?'#4eab7b':'transparent'}" stroke-width=".12"/></g>`;
  }
  function showFurniture(e){
    const x=e.x,y=e.y,w=e.w,h=e.h,c=e.subType;
    const shape=[];
    if(c==='rug'){
      shape.push(`<rect width="${w}" height="${h}" rx=".22" fill="${safeColor(e.color||'#c49d7b')}" stroke="#b38d6a" stroke-width=".13"/><rect x=".32" y=".32" width="${w-.64}" height="${h-.64}" rx=".12" fill="none" stroke="#fff7e9" stroke-opacity=".8" stroke-width=".16" stroke-dasharray=".25 .11"/>`);
    }else if(ceilingTypes.has(c)){
      shape.push(`<circle cx="${w/2}" cy="${h/2}" r="${Math.min(w,h)*.46}" fill="#f9edc7" fill-opacity=".25" stroke="#c2a77d" stroke-width=".11" stroke-dasharray=".24 .16"/>`);
      if(c==='ceilingFan'){
        for(let i=0;i<4;i++)shape.push(`<ellipse cx="${w/2}" cy="${h/2-.98}" rx=".32" ry="1.05" transform="rotate(${i*90} ${w/2} ${h/2})" fill="#b2b8a8" stroke="#6e8c77" stroke-width=".1"/>`);
      }
      shape.push(`<circle cx="${w/2}" cy="${h/2}" r="${c==='ceilingFan'?'.42':'.65'}" fill="#fce7a7" stroke="#bc9865" stroke-width=".12"/>`);
    }else shape.push(`<rect width="${w}" height="${h}" rx=".24" fill="#dce5d8" stroke="#8fa995" stroke-width=".12"/>`);
    if(c==='sofa'){shape.push(`<rect x=".2" y=".18" width="${w-.4}" height=".85" rx=".27" fill="#afc6b6" stroke="#95b3a1" stroke-width=".1"/><rect x=".2" y="1.1" width="${w-.4}" height="${h-1.3}" rx=".35" fill="#c6d8cb"/><path d="M ${w/2} 1.2 V ${h-.25}" stroke="#9eb9a8" stroke-width=".08"/>`)}
    else if(c==='bed'){shape.push(`<rect x=".3" y=".3" width="${w-.6}" height="${h-.6}" rx=".25" fill="#f9f9ef" stroke="#acc2b1" stroke-width=".08"/><rect x=".4" y=".5" width="${(w-.9)/2}" height="1.3" rx=".2" fill="#b8d0bb"/><rect x="${w/2+.05}" y=".5" width="${(w-.9)/2}" height="1.3" rx=".2" fill="#b8d0bb"/><path d="M .4 2.1 H ${w-.4}" stroke="#abc2b0" stroke-width=".12"/>`)}
    else if(c==='table'){shape.push(`<rect x=".4" y=".35" width="${w-.8}" height="${h-.7}" rx=".45" fill="#d4b99c" stroke="#ad987a" stroke-width=".12"/><circle cx="${w/2}" cy="${h/2}" r=".48" fill="#f3e7d7"/>`)}
    else if(c==='desk'){shape.push(`<rect x=".3" y=".25" width="${w-.6}" height="${h-.5}" rx=".12" fill="#d6bda0" stroke="#ab997f" stroke-width=".12"/><rect x=".6" y=".42" width="1.1" height=".7" rx=".1" fill="#e4e8df"/>`)}
    else if(c==='sink'){shape.push(`<rect x=".25" y=".25" width="${w-.5}" height="${h-.5}" rx=".35" fill="#eef7f5" stroke="#a7c1ba" stroke-width=".12"/><ellipse cx="${w/2}" cy="${h/2}" rx="${w*.28}" ry="${h*.25}" fill="#c9e2e0"/><circle cx="${w/2}" cy="${h/2}" r=".09" fill="#789c9c"/>`)}
    else if(c==='toilet'){shape.push(`<rect x=".35" y=".2" width="${w-.7}" height=".62" rx=".14" fill="#f4f7f3" stroke="#9db9af" stroke-width=".1"/><ellipse cx="${w/2}" cy="${h*.59}" rx="${w*.34}" ry="${h*.29}" fill="#fbfefd" stroke="#9db9af" stroke-width=".12"/>`)}
    else if(c==='stove'){for(let i=0;i<2;i++)for(let j=0;j<2;j++)shape.push(`<circle cx="${.65+i*1.18}" cy="${.65+j*1.18}" r=".35" fill="none" stroke="#7b9a88" stroke-width=".1"/>`)}
    else if(c==='plant'){shape.push(`<circle cx="${w/2}" cy="${h/2}" r="${Math.min(w,h)*.39}" fill="#84b88d"/><circle cx="${w/2-.27}" cy="${h/2-.2}" r=".41" fill="#4c9163"/><circle cx="${w/2+.3}" cy="${h/2+.18}" r=".39" fill="#64a676"/>`)}
    else if(c==='stairs'){
      shape.push(`<rect x=".2" y=".2" width="${Math.max(.1,w-.4)}" height="${Math.max(.1,h-.4)}" fill="#e4e7dd" stroke="#7f9d87" stroke-width=".1"/>`);
      for(let i=1;i<9;i++)shape.push(`<path d="M .2 ${h*i/9} H ${w-.2}" stroke="#7b9687" stroke-width=".1"/>`);
      shape.push(`<path d="M ${w/2} ${h-.6} V .8 m -0.65 .75 l .65 -.75 l .65 .75" fill="none" stroke="#2e7958" stroke-width=".16"/>`);
    }else if(c==='elevator'){
      shape.push(`<rect x=".4" y=".4" width="${Math.max(.1,w-.8)}" height="${Math.max(.1,h-.8)}" fill="#d6e9ea" stroke="#5a99a0" stroke-width=".15"/><path d="M ${w/2} .4 V ${h-.4}" stroke="#6099a0" stroke-width=".13"/>`);
      shape.push(svgText('LIFT',w/2,h/2,Math.min(.9,w/4),'#407982','font-weight="800"'));
    }else if(c==='custom'){
      shape.push(`<rect x=".18" y=".18" width="${Math.max(.1,w-.36)}" height="${Math.max(.1,h-.36)}" rx=".15" fill="${safeColor(e.color)}" fill-opacity=".7" stroke="#759281" stroke-width=".11"/>`);
      shape.push(svgText(e.name||'Custom',w/2,h/2,Math.min(.75,Math.max(.3,w/6)),'#315742','font-weight="700"'));
      if(e.mount==='ceiling')shape.push(svgText('CEILING',w/2,h-.32,.35,'#7e735b','font-weight="800"'));
    }
    return `<g data-id="${e.id}" transform="translate(${x} ${y}) rotate(${e.rotation||0} ${w/2} ${h/2})" class="plan-item">${shape.join('')}<rect width="${w}" height="${h}" rx=".18" fill="transparent" stroke="${selected===e.id?'#408c65':'transparent'}" stroke-width=".15" stroke-dasharray=".28 .18"/></g>`;
  }
  function showLabel(e){return `<g data-id="${e.id}" class="plan-item">${svgText(e.text||'Label',e.x,e.y,.9,selected===e.id?'#3a8b60':'#496d58','font-weight="700"')}</g>`}
  function showMeasure(e){return `<g data-id="${e.id}"><line x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}" stroke="#bb9076" stroke-width=".09" stroke-dasharray=".28 .16"/><circle cx="${e.x1}" cy="${e.y1}" r=".15" fill="#bb9076"/><circle cx="${e.x2}" cy="${e.y2}" r=".15" fill="#bb9076"/>${svgText(nice(Math.hypot(e.x2-e.x1,e.y2-e.y1))+' ft',(e.x1+e.x2)/2,(e.y1+e.y2)/2-.55,.67,'#ad7856')}</g>`}
  const showItem = e => e.type==='room'?showRoom(e):e.type==='wall'?showWall(e):e.type==='door'||e.type==='window'?showOpening(e):e.type==='furniture'?showFurniture(e):e.type==='label'?showLabel(e):e.type==='measure'?showMeasure(e):'';
  function renderUnderlay(){
    const i=activeFloorIndex();
    const enabled=showUnderlay&&i>0&&project.viewMode==='2d';
    underlay.innerHTML=enabled?project.floors[i-1].items.map(e=>{
      if(e.type==='room')return `<rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" fill="none" stroke="#3387a7" stroke-width=".2" stroke-dasharray=".6 .3"/>`;
      if(e.type==='wall')return `<line x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}" stroke="#3387a7" stroke-width=".22" stroke-dasharray=".6 .3"/>`;
      if(e.type==='furniture'&&['stairs','elevator'].includes(e.subType))return `<g transform="translate(${e.x} ${e.y}) rotate(${e.rotation||0} ${e.w/2} ${e.h/2})"><rect width="${e.w}" height="${e.h}" fill="#7eb8c1" fill-opacity=".13" stroke="#3387a7" stroke-width=".22" stroke-dasharray=".35 .2"/></g>`;
      return '';
    }).join(''):'';
    renderVerticalConnections();
  }
  function renderVerticalConnections(){
    if(project.viewMode!=='2d'){connectionsLayer.innerHTML='';return}
    connectionsLayer.innerHTML=geometry.connectionsAt(project.floors,activeFloorIndex()).map(({fixture:e})=>{
      const isElevator=e.subType==='elevator',label=isElevator?'LIFT SHAFT':'STAIR OPENING';
      return `<g transform="translate(${e.x} ${e.y}) rotate(${e.rotation||0} ${e.w/2} ${e.h/2})"><rect width="${e.w}" height="${e.h}" fill="${isElevator?'#83c2ce':'#e5b980'}" fill-opacity=".18" stroke="${isElevator?'#408c99':'#af7b3e'}" stroke-width=".19" stroke-dasharray=".4 .22"/>${svgText(label,e.w/2,e.h/2,Math.min(.7,e.w/9),'#6c6d5a','font-weight="700"')}</g>`;
    }).join('');
  }
  function renderPrefabPalette(){
    document.querySelectorAll('#furniturePalette [data-prefab-id]').forEach(el=>el.remove());
    $('newPrefabBtn').insertAdjacentHTML('afterend',project.prefabs.map(p=>`<button data-prefab-id="${esc(p.id)}" title="${esc(p.category||'Furniture')} · ${esc(p.name)}"><span class="prefab-color-chip" style="color:${safeColor(p.color)}">${p.mesh?'⬡':p.shape==='table'?'▦':p.shape==='shelf'?'▤':'▣'}</span>${esc(p.name)}</button>`).join(''));
  }
  function renderPlan(){
    const all=floor().items;
    const order={room:0,wall:1,furniture:2,measure:3,label:4,door:5,window:5};
    const walls=geometry.collectWallSegments(all).map(s=>`<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="${s.roomIds.length>1?'#426c59':'#3b574c'}" stroke-width=".42" stroke-linecap="square" pointer-events="none"/>`).join('');
    const other=[...all].filter(e=>e.type!=='room'&&e.type!=='wall').sort((a,b)=>(order[a.type]||0)-(order[b.type]||0)+(a.subType==='rug'?-0.25:0)-(b.subType==='rug'?-0.25:0)).map(showItem).join('');
    drawing.innerHTML=all.filter(e=>e.type==='room').map(showRoom).join('')+walls+other+all.filter(e=>e.type==='wall').map(showWall).join('')+all.filter(e=>e.type==='room').map(showRoomAnnotation).join('');
    renderUnderlay();
    const e=itemById(selected);
    let h='';
    const dot=(x,y,key)=>`<g data-handle="${key}" style="cursor:crosshair"><circle data-handle="${key}" cx="${x}" cy="${y}" r="${isMobile()?1.75:.47}" fill="transparent"/><circle data-handle="${key}" cx="${x}" cy="${y}" r="${isMobile()?.68:.35}" fill="white" stroke="#3a9668" stroke-width=".13"/></g>`;
    if(e?.type==='room'||e?.type==='furniture'){
      const x=e.x,y=e.y,w=e.w,hgt=e.h;
      h+=`<rect x="${x}" y="${y}" width="${w}" height="${hgt}" fill="none" stroke="#3d9b6c" stroke-width=".09" stroke-dasharray=".3 .21" pointer-events="none"/>`;
      h+=dot(x,y,'nw')+dot(x+w,y,'ne')+dot(x,y+hgt,'sw')+dot(x+w,y+hgt,'se');
    }else if(e?.type==='wall'||e?.type==='measure')h+=dot(e.x1,e.y1,'start')+dot(e.x2,e.y2,'end');
    handles.innerHTML=h;
    updateView();
  }
  function renderFloorTabs(){
    $('floorTabs').innerHTML=project.floors.map((f,i)=>`<button class="floor-tab ${f.id===project.activeFloorId?'active':''}" data-floor="${esc(f.id)}" role="tab" aria-selected="${f.id===project.activeFloorId}">${i===0?'⌂ ':''}${esc(f.name)}</button>`).join('');
    $('floorBreadcrumb').textContent=floor().name.toUpperCase();
    $('modeBreadcrumb').textContent=project.viewMode==='3d'?'3D BUILDING':'2D FLOOR PLAN';
    $('mode2D').classList.toggle('active',project.viewMode==='2d');
    $('mode3D').classList.toggle('active',project.viewMode==='3d');
    $('threeDStage').classList.toggle('hidden',project.viewMode!=='3d');
    $('snapLabel').style.display=project.viewMode==='3d'?'none':'';
    $('canvasHint').style.display=project.viewMode==='3d'?'none':'';
    const canUnderlay=project.viewMode==='2d'&&activeFloorIndex()>0;
    $('floorGuides').classList.toggle('hidden',!canUnderlay);
    $('underlayToggle').setAttribute('aria-pressed',String(showUnderlay));
    $('underlayText').textContent='Below: '+(showUnderlay?'On':'Off');
    $('alignBelowToggle').setAttribute('aria-pressed',String(alignBelow));
    $('alignBelowText').textContent='Align below: '+(alignBelow?'On':'Off');
    document.querySelector('.three-d-help').textContent=cameraMode==='walk'?'Drag to look around':isMobile()?'Drag to rotate · Pinch to zoom':'Drag to rotate · Scroll to zoom';
    $('zoomText').textContent=Math.round(camera.zoom*100)+'%';
    if(project.viewMode==='3d')render3D();
  }
  function numberField(key,label,value,step='0.5'){return `<div class="field-group"><label class="field-label" for="fld-${key}">${label}</label><input id="fld-${key}" class="field-input" type="number" step="${step}" data-field="${key}" value="${round(value)}"></div>`}
  function textField(key,label,value){return `<div class="field-group"><label class="field-label" for="fld-${key}">${label}</label><input id="fld-${key}" class="field-input" type="text" data-field="${key}" value="${esc(value)}" maxlength="70"></div>`}
  function area(f){return f.items.filter(i=>i.type==='room').reduce((s,i)=>s+i.w*i.h,0)}
  function materialSelect(key,label,dict,current){return `<div class="field-group"><label class="field-label" for="fld-${key}">${label}</label><select id="fld-${key}" class="field-input" data-field="${key}">${Object.entries(dict).map(([k,v])=>`<option value="${k}" ${current===k?'selected':''}>${esc(v[0])}</option>`).join('')}</select></div>`}
  function patternSelect(key,label,dict,current){return `<div class="field-group"><label class="field-label" for="fld-${key}">${label}</label><select id="fld-${key}" class="field-input" data-field="${key}">${Object.entries(dict).map(([k,v])=>`<option value="${k}" ${current===k?'selected':''}>${esc(v)}</option>`).join('')}</select></div>`}
  function colorField(key,label,color){return `<div class="field-group"><label class="field-label" for="fld-${key}">${label}</label><input id="fld-${key}" class="style-color-input" type="color" data-field="${key}" value="${color}" aria-label="${label}"></div>`}
  function roomStyleFields(e){
    const fl=floorFinish(e),wl=wallScope==='all'?wallFinish(e):wallFinishForSide(e,wallScope);
    const palette=wallScope==='all'?materialKey(wallMaterials,e.wallMaterial,'sage'):Object.entries(wallMaterials).find(([,v])=>v[1].toLowerCase()===wl.base.toLowerCase())?.[0]||'sage';
    return `<div class="inspector-section-title room-style-heading">ROOM STYLE</div><p class="room-style-note">Decorate floors and walls independently. Each surface is visible in your 3D walkthrough.</p><div class="room-style-previews"><div class="room-style-preview"><div class="room-style-sample" style="${finishes.previewCss(fl)}"></div><strong>Floor preview</strong></div><div class="room-style-preview"><div class="room-style-sample" style="${finishes.previewCss(wl)}"></div><strong>${wallScope==='all'?'Wallpaper preview':esc(wallScope)+' wall'}</strong></div></div><div class="room-style-subtitle">Flooring</div>${materialSelect('floorMaterial','Floor palette',floorMaterials,materialKey(floorMaterials,e.floorMaterial,'default'))}${patternSelect('floorPattern','Floor pattern',finishes.floorPatterns,fl.pattern)}<div class="room-style-colors">${colorField('floorTint','Floor color',fl.base)}${colorField('floorAccent','Floor detail',fl.accent)}</div><div class="room-style-subtitle">Walls & wallpaper</div><div class="field-group"><label class="field-label" for="fld-wallScope">Style which wall?</label><select id="fld-wallScope" class="field-input" data-field="wallScope"><option value="all" ${wallScope==='all'?'selected':''}>All four walls</option>${architecture.sides.map(s=>`<option value="${s}" ${wallScope===s?'selected':''}>${s[0].toUpperCase()+s.slice(1)} wall</option>`).join('')}</select></div>${materialSelect('wallMaterial','Wall palette',wallMaterials,palette)}${patternSelect('wallPattern','Wallpaper pattern',finishes.wallPatterns,wl.pattern)}<div class="room-style-colors">${colorField('wallTint','Wall color',wl.base)}${colorField('wallAccent','Pattern color',wl.accent)}</div>${wallScope!=='all'?`<p class="room-style-note wall-scope-note">Only the ${esc(wallScope)} wall changes. Shared walls can have a different finish on either side.</p><button class="secondary-action" data-action="resetWallStyle">Use room style on this wall</button>`:''}`;
  }
  function renderProperties(){
    const p=$('propertiesContent'),f=floor(),e=itemById(selected);
    if(currentTab==='overview'){
      p.innerHTML=`<div class="inspector-eyebrow">PROJECT SUMMARY</div><h2 class="inspector-heading">${esc(project.name)}</h2><div class="overview-card"><div class="overview-number">${Math.round(project.floors.reduce((s,l)=>s+area(l),0)).toLocaleString()} <span style="font-size:12px">sq ft</span></div><div class="overview-label">Total drawn room area across all floors</div></div><div class="stat-row"><span>Number of floors</span><strong>${project.floors.length}</strong></div><div class="stat-row"><span>Current floor</span><strong>${esc(f.name)}</strong></div><div class="stat-row"><span>Rooms on this floor</span><strong>${f.items.filter(i=>i.type==='room').length}</strong></div><div class="inspector-divider"></div><div class="inspector-section-title">FLOOR MANAGEMENT</div>${textField('floorName','Floor name',f.name)}<button class="secondary-action" data-action="duplicateFloor">Duplicate this floor</button><button class="secondary-action" data-action="addFloor">＋ Add another floor</button>${project.floors.length>1?'<button class="delete-btn" data-action="removeFloor">Remove this floor</button>':''}<div class="inspector-section-title">FLOORS IN PROJECT</div><div class="layer-list">${project.floors.map((l,i)=>`<div class="layer-item"><span>${esc(l.name)}</span><strong>${Math.round(area(l))} ft²</strong></div>`).join('')}</div>`;
      return;
    }
    if(!e){
      p.innerHTML=`<div class="empty-state"><div class="inspector-eyebrow">WELCOME TO YOUR STUDIO</div><h2 class="inspector-heading">Design something wonderful.</h2><p class="inspector-copy">Create spaces with precision, add the details that make a house a home, then explore every floor in 3D.</p><div class="selection-illustration"><svg viewBox="0 0 150 110" fill="none"><path d="M26 93V28h44v38h52v27H26Z" fill="#e4f0e5" stroke="#7fa68a" stroke-width="4"/><path d="M70 28h52v38M26 59h44M90 66v27" stroke="#719c7e" stroke-width="3"/><path d="M80 28v-8h16v8M48 93V81h14v12" stroke="#d5b08c" stroke-width="4"/><circle cx="100" cy="46" r="8" fill="#9cbdad"/></svg></div><div class="inspector-section-title">QUICK START</div><p class="mini-tip">① Choose <strong>Room</strong> and drag out a space.<br>② Add doors, windows, and furniture.<br>③ Click <strong>3D building</strong> to see all floors.</p><div class="inspector-divider"></div><div class="inspector-section-title">CURRENT FLOOR</div><div class="stat-row"><span>Rooms</span><strong>${f.items.filter(i=>i.type==='room').length}</strong></div><div class="stat-row"><span>Floor area</span><strong>${Math.round(area(f))} ft²</strong></div><button class="secondary-action" data-action="overview">Manage floors →</button></div>`;
      return;
    }
    const typeName=objectName(e);
    let fields='';
    if(e.type==='room')fields+=textField('name','Room name',e.name);
    if(e.type==='label')fields+=textField('text','Label text',e.text);
    if(e.type==='room'||e.type==='furniture'||e.type==='label'){
      fields+=`<div class="field-row">${numberField('x','X position (ft)',e.x)}${numberField('y','Y position (ft)',e.y)}</div>`;
      if(e.type!=='label')fields+=`<div class="field-row">${numberField('w','Width (ft)',e.w)}${numberField('h','Depth (ft)',e.h)}</div>`;
      if(e.subType==='custom')fields+=numberField('height','3D height (ft)',e.height||3);
      if(e.subType==='custom')fields+=`<div class="field-group"><label class="field-label" for="fld-mount">Place this object</label><select id="fld-mount" class="field-input" data-field="mount"><option value="floor" ${e.mount!=='ceiling'?'selected':''}>On the floor</option><option value="ceiling" ${e.mount==='ceiling'?'selected':''}>Mounted to ceiling</option></select></div>`;
      if(e.subType==='custom'&&e.mount==='ceiling')fields+=numberField('drop','Gap beneath ceiling (ft)',Number.isFinite(e.drop)?e.drop:.2);
      if(ceilingTypes.has(e.subType))fields+=numberField('drop','Hang below ceiling (ft)',Number.isFinite(e.drop)?e.drop:1);
      if(e.subType==='rug'||ceilingTypes.has(e.subType))fields+=colorField('color',e.subType==='rug'?'Rug color':'Fixture color',safeColor(e.color||'#f7d999'));
      if(e.subType==='elevator')fields+=`<div class="field-group"><label class="field-label" for="fld-throughAll">Elevator shaft connects</label><select id="fld-throughAll" class="field-input" data-field="throughAll"><option value="all" ${e.throughAll!==false?'selected':''}>All floors above</option><option value="next" ${e.throughAll===false?'selected':''}>Next floor only</option></select><p class="inspector-copy">The shaft and floor openings follow this choice in 3D.</p></div>`;
    }else if(e.type==='door'||e.type==='window'){
      fields+=`<div class="field-row">${numberField('x','X (ft)',e.x)}${numberField('y','Y (ft)',e.y)}</div>${numberField('width','Opening width (ft)',e.width)}${numberField('angle','Wall angle (degrees)',e.angle,1)}`;
    }else{
      fields+=`<div class="field-row">${numberField('x1','Start X',e.x1)}${numberField('y1','Start Y',e.y1)}</div><div class="field-row">${numberField('x2','End X',e.x2)}${numberField('y2','End Y',e.y2)}</div>`;
    }
    if(e.type==='furniture')fields+=`<button class="secondary-action" data-action="rotate">↻ Rotate furniture 90°</button>`;
    p.innerHTML=`<div class="inspector-eyebrow">SELECTED ELEMENT</div><h2 class="inspector-heading">${esc(typeName)}</h2><p class="inspector-copy">Adjust the exact dimensions below. All measurements are in feet.</p>${e.type==='room'?`<div class="inspector-section-title room-style-heading">CEILING HEIGHT</div>${numberField('ceilingHeight','Height above floor (ft)',architecture.roomHeight(e))}<p class="room-style-note">Raises this room's walls and ceiling-mounted objects in 3D.</p>${roomStyleFields(e)}`:''}<div class="inspector-divider"></div><div class="inspector-section-title">DIMENSIONS &amp; POSITION</div>${fields}${e.type==='room'? `<div class="stat-row"><span>Floor area</span><strong>${Math.round(e.w*e.h)} ft²</strong></div>`:''}<button class="delete-btn" data-action="delete">Delete ${esc(typeName.toLowerCase())}</button>`;
  }
  function render(){
    $('projectName').value=project.name;
    renderPlan();renderFloorTabs();renderProperties();renderPrefabPalette();
    $('undoBtn').disabled=!history.length;$('redoBtn').disabled=!future.length;
    svg.dataset.tool=activeTool;
    document.querySelectorAll('.tool').forEach(el=>el.classList.toggle('active',el.dataset.tool===activeTool));
    document.querySelectorAll('[data-furniture],[data-prefab-id]').forEach(el=>el.classList.toggle('active',el.dataset.furniture===furnitureTool||'prefab:'+el.dataset.prefabId===furnitureTool));
    document.querySelectorAll('.right-tab').forEach(el=>el.classList.toggle('active',el.dataset.tab===currentTab));
    $('mobileMoreBtn').classList.toggle('tool-engaged',['label','measure','pan'].includes(activeTool));
    $('mobileFurnitureBtn').classList.toggle('tool-engaged',activeTool==='furniture');
    const chosen=itemById(selected),quickVisible=!!chosen&&project.viewMode==='2d';
    $('selectionToolbar').classList.toggle('hidden',!quickVisible);
    $('quickRotate').hidden=chosen?.type!=='furniture';
    $('magnetToggle').classList.toggle('active',magnetEnabled);
    $('magnetToggle').setAttribute('aria-pressed',String(magnetEnabled));
    updateMobileUI();
  }
  function updateMobileUI(){
    const panel=document.querySelector('.properties-panel'),e=itemById(selected);
    panel.classList.toggle('open',sheetOpen&&isMobile());
    $('mobileSheetToggle').setAttribute('aria-expanded',String(sheetOpen&&isMobile()));
    $('mobileSheetArrow').textContent=sheetOpen?'⌄':'⌃';
    $('mobileSheetTitle').textContent=currentTab==='overview'?'Project overview':e?(e.type==='room'?e.name:objectName(e))+' · Edit details':'Properties & dimensions';
  }
  function closeMobileToolMenus(){
    document.querySelector('.tools-panel').classList.remove('show-more','show-furniture');
    $('mobileMoreBtn').classList.remove('active');$('mobileFurnitureBtn').classList.remove('active');
    $('mobileMoreBtn').setAttribute('aria-expanded','false');$('mobileFurnitureBtn').setAttribute('aria-expanded','false');
  }
  function setTool(tool,sub){
    activeTool=tool;furnitureTool=sub||null;
    selected=null;draft=null;tempDrawing.innerHTML='';
    sheetOpen=false;
    closeMobileToolMenus();
    const titles={select:'Click an object to edit',room:'Drag to draw a room',wall:'Drag to draw a wall',door:'Click an existing wall to add a door',window:'Click an existing wall to add a window',measure:'Drag between two points to measure',label:'Click to add text',pan:'Drag to pan the canvas',furniture:'Click where you want to place furniture'};
    setStatus(titles[tool]);render();
  }
  function resize(e,handle,p,old){
    if(handle==='start'||handle==='end'){e[handle==='start'?'x1':'x2']=snap(p.x);e[handle==='start'?'y1':'y2']=snap(p.y);return}
    const x1=handle.includes('w')?snap(p.x):old.x;
    const y1=handle.includes('n')?snap(p.y):old.y;
    const x2=handle.includes('e')?snap(p.x):old.x+old.w;
    const y2=handle.includes('s')?snap(p.y):old.y+old.h;
    if(Math.abs(x2-x1)<1||Math.abs(y2-y1)<1)return;
    e.x=Math.min(x1,x2);e.y=Math.min(y1,y2);e.w=Math.abs(x2-x1);e.h=Math.abs(y2-y1);
  }
  function renderDraft(){
    if(!draft)return tempDrawing.innerHTML='';
    const a=draft.a,b=draft.b;
    if(draft.type==='room'){
      const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(b.x-a.x),h=Math.abs(b.y-a.y);
      tempDrawing.innerHTML=`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#b2d8bd" fill-opacity=".3" stroke="#40855e" stroke-width=".18" stroke-dasharray=".3 .18"/>${svgText(nice(w)+"' × "+nice(h)+"'",x+w/2,y+h/2,.7,'#357e52')}`;
    }else{
      tempDrawing.innerHTML=`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#4a936f" stroke-width=".2" stroke-dasharray=".3 .2"/>${svgText(nice(Math.hypot(b.x-a.x,b.y-a.y))+" ft",(a.x+b.x)/2,(a.y+b.y)/2-.7,.7,'#317e56')}`;
    }
  }
  function beginPinch(){
    if(touchPoints.size<2)return;
    if(pointer?.old&&pointer?.itemId){const e=itemById(pointer.itemId);if(e)Object.assign(e,clone(pointer.old))}
    pointer=null;draft=null;tempDrawing.innerHTML='';showSnapGuides(null);renderPlan();
    const p=[...touchPoints.values()],mid={x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2};
    pinch={distance:Math.max(10,Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)),zoom:camera.zoom,anchor:getPoint({clientX:mid.x,clientY:mid.y})};
  }
  function movePinch(){
    if(!pinch||touchPoints.size<2)return;
    const p=[...touchPoints.values()],mid={x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2};
    camera.zoom=clamp(pinch.zoom*Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)/pinch.distance,.35,3.8);
    const r=svg.getBoundingClientRect(),d=viewSize();
    camera.cx=pinch.anchor.x-(mid.x-r.left-r.width/2)/r.width*d.w;
    camera.cy=pinch.anchor.y-(mid.y-r.top-r.height/2)/r.height*d.h;
    updateView();
  }
  function onDown(evt){
    if(project.viewMode!=='2d'||evt.button>0)return;
    evt.preventDefault();svg.setPointerCapture(evt.pointerId);
    if(evt.pointerType==='touch'){
      touchPoints.set(evt.pointerId,{x:evt.clientX,y:evt.clientY});
      if(touchPoints.size>=2){beginPinch();return}
    }
    const raw=getPoint(evt),p={x:snap(raw.x),y:snap(raw.y)};
    if(activeTool==='pan'||evt.buttons===4){pointer={kind:'pan',start:{x:evt.clientX,y:evt.clientY},before:{...camera}};return}
    if(['room','wall','measure'].includes(activeTool)){
      const aligned=snapPoint(raw);
      draft={type:activeTool,a:{x:aligned.x,y:aligned.y},b:{x:aligned.x,y:aligned.y}};
      pointer={kind:'draw',start:draft.a};showSnapGuides(aligned);renderDraft();return;
    }
    if(activeTool==='door'||activeTool==='window'){
      const wall=nearWall(raw);
      if(!wall){toast('Click close to a wall to place a '+activeTool);return}
      const before=state();floor().items.push(opening(activeTool,snap(wall.point.x),snap(wall.point.y),Math.round(wall.angle),activeTool==='door'?3:4));changed(before);return;
    }
    if(activeTool==='label'){
      const label=prompt('Label text:','Add a label');
      if(label?.trim()){const before=state();const e={id:id(),type:'label',x:p.x,y:p.y,text:label.trim().slice(0,70)};floor().items.push(e);selected=e.id;changed(before)}
      return;
    }
    if(activeTool==='furniture'){
      const prefab=furnitureTool?.startsWith('prefab:')?project.prefabs.find(x=>x.id===furnitureTool.slice(7)):null;
      const kind=prefab?'custom':furnitureTool,dimensions=prefab?[prefab.w,prefab.h]:sizes[kind];
      if(!dimensions){toast('That prefab is no longer available');setTool('select');return}
      const extra=prefab?{w:prefab.w,h:prefab.h,height:prefab.height,name:prefab.name,color:prefab.color,prefabId:prefab.id,category:prefab.category,shape:prefab.shape,...(prefab.mesh?{mesh:prefab.mesh}:{})}:{};
      if(ceilingTypes.has(kind)&&!floor().items.some(r=>r.type==='room'&&p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h)){
        toast('Tap inside a room to mount this fixture on its ceiling');return;
      }
      const before=state(),e=furniture(kind,p.x-dimensions[0]/2,p.y-dimensions[1]/2,extra);
      floor().items.push(e);selected=e.id;changed(before);return;
    }
    const handle=evt.target.closest('[data-handle]')?.getAttribute('data-handle'),target=handle?selected:getTarget(evt);
    if(target!==selected){selected=target;wallScope='all';sheetOpen=!!target;currentTab='properties';render()}
    if(!target){
      if(evt.pointerType==='touch')pointer={kind:'pan',start:{x:evt.clientX,y:evt.clientY},before:{...camera}};
      else pointer=null;
      return;
    }
    const item=itemById(target);
    pointer={kind:handle?'resize':'move',start:p,before:state(),itemId:target,old:clone(item),handle};
  }
  function onMove(evt){
    if(evt.pointerType==='touch'&&touchPoints.has(evt.pointerId)){
      touchPoints.set(evt.pointerId,{x:evt.clientX,y:evt.clientY});
      if(pinch){movePinch();return}
    }
    const raw=getPoint(evt);$('cursorPosition').textContent=`X: ${nice(raw.x)} ft   Y: ${nice(raw.y)} ft`;
    if(!pointer)return;
    if(pointer.kind==='pan'){
      const r=svg.getBoundingClientRect(),dims=viewSize();
      camera.cx=pointer.before.cx-(evt.clientX-pointer.start.x)/r.width*dims.w;
      camera.cy=pointer.before.cy-(evt.clientY-pointer.start.y)/r.height*dims.h;updateView();return;
    }
    let p={x:snap(raw.x),y:snap(raw.y)};
    if(pointer.kind==='draw'){
      const aligned=snapPoint(raw);p={x:aligned.x,y:aligned.y};
      if(evt.shiftKey&&(activeTool==='wall'||activeTool==='measure')){
        if(Math.abs(p.x-pointer.start.x)>Math.abs(p.y-pointer.start.y))p.y=pointer.start.y;else p.x=pointer.start.x;
      }
      showSnapGuides(aligned);draft.b=p;renderDraft();return;
    }
    const e=itemById(pointer.itemId);if(!e)return;
    Object.assign(e,clone(pointer.old));
    if(pointer.kind==='resize'){
      const aligned=snapPoint(raw,e.id);p={x:aligned.x,y:aligned.y};showSnapGuides(aligned);
      resize(e,pointer.handle,p,pointer.old);
    }
    else{
      const dx=snap(p.x-pointer.start.x),dy=snap(p.y-pointer.start.y);
      if(e.type==='wall'||e.type==='measure'){
        const aligned=snapPoint({x:pointer.old.x1+dx,y:pointer.old.y1+dy},e.id);
        const offsetX=aligned.x-pointer.old.x1,offsetY=aligned.y-pointer.old.y1;
        e.x1=round(pointer.old.x1+offsetX);e.y1=round(pointer.old.y1+offsetY);
        e.x2=round(pointer.old.x2+offsetX);e.y2=round(pointer.old.y2+offsetY);
        showSnapGuides(aligned);
      }else if(e.type==='room'||e.type==='furniture'){
        const aligned=snapBox({x:pointer.old.x+dx,y:pointer.old.y+dy,w:e.w,h:e.h},e.id);
        e.x=aligned.x;e.y=aligned.y;showSnapGuides(aligned);
      }else{e.x=round(pointer.old.x+dx);e.y=round(pointer.old.y+dy);showSnapGuides(null)}
    }
    renderPlan();
  }
  function onUp(evt){
    if(evt.pointerType==='touch'){
      touchPoints.delete(evt.pointerId);
      if(pinch){if(touchPoints.size<2)pinch=null;pointer=null;return}
    }
    if(!pointer){showSnapGuides(null);return}
    if(pointer.kind==='draw'&&draft){
      const a=draft.a,b=draft.b,w=Math.abs(b.x-a.x),h=Math.abs(b.y-a.y),length=Math.hypot(w,h);
      const before=state();
      if(draft.type==='room'&&w>=2&&h>=2){
        const name='Room '+(floor().items.filter(e=>e.type==='room').length+1);
        const e=room(Math.min(a.x,b.x),Math.min(a.y,b.y),w,h,name);floor().items.push(e);selected=e.id;setTool('select');selected=e.id;
      }else if((draft.type==='wall'||draft.type==='measure')&&length>=1){
        const e={id:id(),type:draft.type,x1:a.x,y1:a.y,x2:b.x,y2:b.y};floor().items.push(e);selected=e.id;setTool('select');selected=e.id;
      }else toast('Draw a larger shape to add it');
      if(selected)sheetOpen=true;
      draft=null;tempDrawing.innerHTML='';pointer=null;showSnapGuides(null);changed(before);render();return;
    }
    if(pointer.kind==='move'||pointer.kind==='resize')changed(pointer.before);
    pointer=null;showSnapGuides(null);render();
  }
  svg.addEventListener('pointerdown',onDown);
  svg.addEventListener('pointermove',onMove);
  svg.addEventListener('pointerup',onUp);
  svg.addEventListener('pointercancel',evt=>{touchPoints.delete(evt.pointerId);pinch=null;pointer=null;draft=null;tempDrawing.innerHTML='';showSnapGuides(null);render()});
  svg.addEventListener('wheel',evt=>{if(project.viewMode!=='2d')return;evt.preventDefault();camera.zoom=clamp(camera.zoom*(evt.deltaY<0?1.12:.89),.35,3.8);updateView()},{passive:false});
  document.querySelectorAll('.tool').forEach(b=>b.addEventListener('click',()=>{setMode('2d');setTool(b.dataset.tool)}));
  $('furniturePalette').addEventListener('click',e=>{
    const b=e.target.closest('[data-furniture],[data-prefab-id]');if(!b)return;
    setMode('2d');setTool('furniture',b.dataset.furniture||'prefab:'+b.dataset.prefabId);
    if(b.dataset.furniture==='stairs')toast('Stairs open the next floor above');
    if(b.dataset.furniture==='elevator')toast('Elevator connects all floors above by default');
  });
  $('mobileMoreBtn').addEventListener('click',()=>{
    const p=document.querySelector('.tools-panel'),on=!p.classList.contains('show-more');
    closeMobileToolMenus();p.classList.toggle('show-more',on);$('mobileMoreBtn').classList.toggle('active',on);$('mobileMoreBtn').setAttribute('aria-expanded',String(on));
  });
  $('mobileFurnitureBtn').addEventListener('click',()=>{
    const p=document.querySelector('.tools-panel'),on=!p.classList.contains('show-furniture');
    closeMobileToolMenus();p.classList.toggle('show-furniture',on);$('mobileFurnitureBtn').classList.toggle('active',on);$('mobileFurnitureBtn').setAttribute('aria-expanded',String(on));
  });
  $('mobileSheetToggle').addEventListener('click',()=>{sheetOpen=!sheetOpen;updateMobileUI()});
  function setMode(mode){if(mode==='2d'&&cameraMode==='walk')exitWalk();project.viewMode=mode;sheetOpen=false;closeMobileToolMenus();save();render();if(mode==='3d')requestAnimationFrame(render3D)}
  $('mode2D').addEventListener('click',()=>setMode('2d'));
  $('mode3D').addEventListener('click',()=>setMode('3d'));
  $('floorTabs').addEventListener('click',evt=>{const b=evt.target.closest('[data-floor]');if(!b)return;project.activeFloorId=b.dataset.floor;if(cameraMode==='walk')resetWalk();selected=null;sheetOpen=false;save();render()});
  function addFloor(duplicate=false){
    const before=state(),n=project.floors.length+1;
    const source=duplicate?clone(floor().items).map(e=>({...e,id:id()})):[];
    const f={id:id(),name:duplicate?floor().name+' copy':n===2?'Second floor':n===3?'Third floor':'Floor '+n,items:source};
    project.floors.push(f);project.activeFloorId=f.id;selected=null;sheetOpen=false;changed(before);
    toast(duplicate?'Floor duplicated':'New floor added');return f;
  }
  $('addFloorBtn').addEventListener('click',()=>addFloor());
  $('snapCheck').addEventListener('change',e=>{snapEnabled=e.target.checked;setStatus(snapEnabled?'Snap to half-foot grid enabled':'Freehand positioning enabled')});
  $('magnetToggle').addEventListener('click',()=>{magnetEnabled=!magnetEnabled;showSnapGuides(null);render();toast(magnetEnabled?'Magnetic wall alignment enabled':'Magnetic wall alignment disabled')});
  $('underlayToggle').addEventListener('click',()=>{showUnderlay=!showUnderlay;renderPlan();renderFloorTabs()});
  $('alignBelowToggle').addEventListener('click',()=>{alignBelow=!alignBelow;renderFloorTabs();toast(alignBelow?'Aligning to the floor below':'Lower-floor alignment off')});
  $('traceBelowBtn').addEventListener('click',()=>{
    const i=activeFloorIndex();if(i<=0)return;
    const existing=floor().items,lower=project.floors[i-1].items;
    const same=(a,b)=>{
      if(a.type!==b.type)return false;
      if(a.type==='room')return ['x','y','w','h'].every(k=>Math.abs(a[k]-b[k])<.01);
      const forward=['x1','y1','x2','y2'].every(k=>Math.abs(a[k]-b[k])<.01);
      const reverse=Math.abs(a.x1-b.x2)<.01&&Math.abs(a.y1-b.y2)<.01&&Math.abs(a.x2-b.x1)<.01&&Math.abs(a.y2-b.y1)<.01;
      return forward||reverse;
    };
    const copied=lower.filter(e=>e.type==='room'||e.type==='wall').filter(e=>!existing.some(v=>same(e,v))).map(e=>({...clone(e),id:id()}));
    if(!copied.length){toast('All lower-floor rooms are already traced');return}
    const before=state();floor().items.push(...copied);selected=null;changed(before);
    toast('Traced '+copied.length+' rooms and walls — Undo to revert');
  });
  document.querySelectorAll('.right-tab').forEach(b=>b.addEventListener('click',()=>{currentTab=b.dataset.tab;sheetOpen=true;render()}));
  $('propertiesContent').addEventListener('change',evt=>{
    const input=evt.target.closest('[data-field]');if(!input)return;
    const before=state();const key=input.dataset.field;
    if(key==='wallScope'){wallScope=architecture.sides.includes(input.value)?input.value:'all';renderProperties();return}
    if(key==='floorName'){floor().name=input.value.trim()||floor().name}
    else{
      const e=itemById(selected);if(!e)return;
      const setWallStyle=(field,value)=>{
        if(wallScope==='all'){e[field==='base'?'wallTint':field==='accent'?'wallAccent':'wallPattern']=value;return}
        if(!e.wallSides||typeof e.wallSides!=='object')e.wallSides={};
        const current=wallFinishForSide(e,wallScope);
        e.wallSides[wallScope]={pattern:current.pattern,base:current.base,accent:current.accent,[field]:value};
      };
      if(['name','text'].includes(key))e[key]=input.value.trim()||e[key];
      else if(key==='throughAll')e.throughAll=input.value==='all';
      else if(key==='mount')e.mount=input.value==='ceiling'?'ceiling':'floor';
      else if(key==='floorMaterial'){e.floorMaterial=materialKey(floorMaterials,input.value,'default');delete e.floorTint;if(!finishes.validPattern('floor',e.floorPattern))delete e.floorPattern}
      else if(key==='wallMaterial'){
        const chosen=materialKey(wallMaterials,input.value,'sage');
        if(wallScope==='all'){e.wallMaterial=chosen;delete e.wallTint}
        else setWallStyle('base',wallMaterials[chosen][1]);
      }
      else if(key==='wallPattern')setWallStyle('pattern',finishes.validPattern('wall',input.value)?input.value:'paint');
      else if(key==='floorPattern')e.floorPattern=finishes.validPattern('floor',input.value)?input.value:'plain';
      else if(key==='wallTint'||key==='wallAccent')setWallStyle(key==='wallTint'?'base':'accent',finishes.hex(input.value,'#dfe7dc'));
      else if(key==='floorTint'||key==='floorAccent')e[key]=finishes.hex(input.value,'#d8c6ad');
      else if(key==='color')e.color=safeColor(input.value);
      else{const v=Number(input.value);if(!Number.isFinite(v))return;let n=round(v);if(['w','h','width','height'].includes(key))n=clamp(n,.5,key==='height'?30:100);if(key==='ceilingHeight')n=clamp(n,7.5,20);if(key==='drop')n=clamp(n,.2,5);e[key]=n}
    }
    changed(before);
  });
  $('propertiesContent').addEventListener('click',evt=>{
    const b=evt.target.closest('[data-action]');if(!b)return;
    if(b.dataset.action==='overview'){currentTab='overview';render();return}
    if(b.dataset.action==='addFloor'){addFloor();return}
    if(b.dataset.action==='duplicateFloor'){addFloor(true);return}
    if(b.dataset.action==='removeFloor'){
      if(project.floors.length<=1)return;
      if(!confirm('Delete '+floor().name+' and everything on it?'))return;
      const before=state();project.floors=project.floors.filter(x=>x.id!==project.activeFloorId);project.activeFloorId=project.floors[0].id;selected=null;changed(before);return;
    }
    const e=itemById(selected);if(!e)return;
    const before=state();
    if(b.dataset.action==='resetWallStyle'&&wallScope!=='all'){
      if(e.wallSides)delete e.wallSides[wallScope];
      changed(before);renderProperties();return;
    }
    if(b.dataset.action==='delete'){floor().items=floor().items.filter(x=>x.id!==e.id);selected=null}
    if(b.dataset.action==='rotate')e.rotation=((e.rotation||0)+90)%360;
    changed(before);
  });
  $('projectName').addEventListener('change',evt=>{const before=state();project.name=evt.target.value.trim()||'Untitled house';changed(before)});
  $('undoBtn').addEventListener('click',undo);$('redoBtn').addEventListener('click',redo);
  function undo(){if(!history.length)return;future.push(state());project=JSON.parse(history.pop());selected=null;save();render()}
  function redo(){if(!future.length)return;history.push(state());project=JSON.parse(future.pop());selected=null;save();render()}
  function deleteSelected(){if(!selected)return;const before=state();floor().items=floor().items.filter(e=>e.id!==selected);selected=null;changed(before)}
  function duplicateSelected(){
    const e=itemById(selected);if(!e)return;
    const before=state(),copyItem=clone(e);copyItem.id=id();
    if(e.type==='wall'||e.type==='measure'){copyItem.x1+=2;copyItem.x2+=2;copyItem.y1+=2;copyItem.y2+=2}
    else{copyItem.x=round((copyItem.x||0)+2);copyItem.y=round((copyItem.y||0)+2)}
    floor().items.push(copyItem);activeTool='select';furnitureTool=null;selected=copyItem.id;sheetOpen=false;
    changed(before);toast('Copy placed — drag to position');
  }
  $('quickEdit').addEventListener('click',()=>{if(!selected)return;activeTool='select';furnitureTool=null;currentTab='properties';sheetOpen=true;render()});
  $('quickDuplicate').addEventListener('click',duplicateSelected);
  $('quickRotate').addEventListener('click',()=>{
    const e=itemById(selected);if(e?.type!=='furniture')return;
    const before=state();e.rotation=((e.rotation||0)+90)%360;activeTool='select';furnitureTool=null;changed(before);
  });
  $('quickDelete').addEventListener('click',()=>{activeTool='select';furnitureTool=null;deleteSelected()});
  document.addEventListener('keydown',evt=>{
    if(!$('prefabDialog').classList.contains('hidden')){if(evt.key==='Escape')closePrefabDialog();return}
    if(!$('projectsDialog').classList.contains('hidden')){if(evt.key==='Escape')closeProjectsDialog();return}
    if(evt.target.matches('input,textarea,select'))return;
    const key=evt.key.toLowerCase();
    if((evt.ctrlKey||evt.metaKey)&&key==='z'){evt.preventDefault();evt.shiftKey?redo():undo();return}
    if((evt.ctrlKey||evt.metaKey)&&key==='y'){evt.preventDefault();redo();return}
    if(project.viewMode==='3d'&&cameraMode==='walk'){
      const actions={w:'forward',arrowup:'forward',s:'back',arrowdown:'back',a:'left',arrowleft:'left',d:'right',arrowright:'right',q:'strafeLeft',e:'strafeRight'};
      if(actions[key]){evt.preventDefault();walkStep(actions[key]);return}
      if(key==='escape'){evt.preventDefault();exitWalk();return}
      return;
    }
    if(key==='delete'||key==='backspace'){evt.preventDefault();deleteSelected();return}
    if(key==='escape'){selected=null;setTool('select');return}
    if(project.viewMode==='3d')return;
    const shortcuts={v:'select',r:'room',w:'wall',d:'door',n:'window',t:'label',m:'measure',h:'pan'};
    if(shortcuts[key]){evt.preventDefault();setTool(shortcuts[key])}
  });
  $('zoomIn').addEventListener('click',()=>{camera.zoom=clamp(camera.zoom*1.2,.3,4);updateView()});
  $('zoomOut').addEventListener('click',()=>{camera.zoom=clamp(camera.zoom/1.2,.3,4);updateView()});
  $('fitBtn').addEventListener('click',fitDrawing);
  function fitDrawing(){
    const ext=extent(project.floors.map(f=>f.items).flat());
    const ratio=$('stage').clientHeight/$('stage').clientWidth;
    camera.cx=(ext.minX+ext.maxX)/2;camera.cy=(ext.minY+ext.maxY)/2;
    const spanX=Math.max(30,ext.maxX-ext.minX+10),spanY=Math.max(20,ext.maxY-ext.minY+10);
    camera.zoom=clamp((isMobile()?43:57)/Math.max(spanX,spanY/Math.max(.1,ratio)),.3,2);
    updateView();
  }
  function extent(items){
    let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;
    const push=(x,y)=>{a=Math.min(a,x);b=Math.min(b,y);c=Math.max(c,x);d=Math.max(d,y)};
    items.forEach(e=>{
      if(e.type==='room'){push(e.x,e.y);push(e.x+e.w,e.y+e.h)}
      else if(e.type==='furniture'){
        const angle=(e.rotation||0)*Math.PI/180,co=Math.cos(angle),si=Math.sin(angle),mx=e.x+e.w/2,my=e.y+e.h/2;
        for(const [px,py] of [[e.x,e.y],[e.x+e.w,e.y],[e.x+e.w,e.y+e.h],[e.x,e.y+e.h]]){
          const dx=px-mx,dy=py-my;push(mx+dx*co-dy*si,my+dx*si+dy*co);
        }
      }
      else if(e.type==='wall'||e.type==='measure'){push(e.x1,e.y1);push(e.x2,e.y2)}
      else if(Number.isFinite(e.x)){push(e.x,e.y)}
    });
    return Number.isFinite(a)?{minX:a,minY:b,maxX:c,maxY:d}:{minX:0,minY:0,maxX:42,maxY:34};
  }

  // Interactive 3D building projection: every plan floor occupies its own
  // elevation, with open-top rooms, extruded walls, furniture, and openings.
  function render3D(){
    if(project.viewMode!=='3d'||!ctx3d)return;
    const rect=modelCanvas.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    const dpr=Math.min(devicePixelRatio||1,2);
    const pixelWidth=Math.round(rect.width*dpr),pixelHeight=Math.round(rect.height*dpr);
    // Resizing a canvas reallocates its backing store; only do it when needed.
    if(modelCanvas.width!==pixelWidth)modelCanvas.width=pixelWidth;
    if(modelCanvas.height!==pixelHeight)modelCanvas.height=pixelHeight;
    const cw=rect.width,ch=rect.height;ctx3d.setTransform(dpr,0,0,dpr,0,0);ctx3d.clearRect(0,0,cw,ch);
    const visible=cameraMode==='walk'?[floor()]:showAll?project.floors:[floor()];
    const ext=extent(visible.flatMap(f=>f.items));
    const ox=(ext.minX+ext.maxX)/2,oy=(ext.minY+ext.maxY)/2;
    const cx=ox,cy=oy,levels=architecture.levelOffsets(project.floors,separateFloors);
    const floorBase=i=>cameraMode==='walk'||!showAll?0:levels[i];
    const upper=visible.reduce((m,f)=>{const i=project.floors.findIndex(l=>l.id===f.id);return Math.max(m,floorBase(i)+Math.max(8,...f.items.filter(e=>e.type==='room').map(architecture.roomHeight)))},8);
    const cos=Math.cos(orbit.theta),sin=Math.sin(orbit.theta),sPhi=Math.sin(orbit.phi),cPhi=Math.cos(orbit.phi);
    const transform=(x,y,z)=>{
      const dx=x-cx,dy=y-cy,rx=cos*dx-sin*dy,ry=sin*dx+cos*dy;
      return {x:rx,y:-ry*sPhi-(z-upper*.45)*cPhi,depth:ry*cPhi-(z-upper*.45)*sPhi};
    };
    const bounds=[];
    // Fit to the actual highest walls, not an empty imaginary story above the
    // building. This uses more of a phone's limited 3D viewing area.
    const highestStructure=visible.reduce((highest,f)=>{
      const i=project.floors.findIndex(l=>l.id===f.id),base=floorBase(i);
      const extra=f.items.reduce((height,e)=>{
        if(e.type!=='furniture')return height;
        if(e.subType==='custom')return Math.max(height,clamp(Number(e.height)||3,.5,30));
        if(e.subType==='elevator'&&showAll)return Math.max(height,levels[geometry.connectionSpan(project.floors,i,e)]-levels[i]);
        return height;
      },Math.max(8,...f.items.filter(e=>e.type==='room').map(architecture.roomHeight)));
      return Math.max(highest,base+extra);
    },8);
    for(const z of [-1,highestStructure+2])for(const x of [ext.minX-3,ext.maxX+3])for(const y of [ext.minY-3,ext.maxY+3])bounds.push(transform(x,y,z));
    const bw=Math.max(...bounds.map(p=>p.x))-Math.min(...bounds.map(p=>p.x));
    const bh=Math.max(...bounds.map(p=>p.y))-Math.min(...bounds.map(p=>p.y));
    const scale=Math.min(cw*.87/Math.max(15,bw),ch*.80/Math.max(18,bh))*orbit.zoom;
    const xcenter=(Math.max(...bounds.map(p=>p.x))+Math.min(...bounds.map(p=>p.x)))/2;
    const ycenter=(Math.max(...bounds.map(p=>p.y))+Math.min(...bounds.map(p=>p.y)))/2;
    const projectP=(x,y,z)=>{const p=transform(x,y,z);return {x:cw/2+(p.x-xcenter)*scale,y:ch/2+(p.y-ycenter)*scale,depth:p.depth}};
    const walkthroughPoint=(x,y,z)=>{
      const dx=x-walk.x,dy=y-walk.y,dz=z-walk.z;
      const forward=dx*Math.cos(walk.yaw)+dy*Math.sin(walk.yaw);
      const right=-dx*Math.sin(walk.yaw)+dy*Math.cos(walk.yaw);
      return {x:right,y:dz*Math.cos(walk.pitch)-forward*Math.sin(walk.pitch),depth:forward*Math.cos(walk.pitch)+dz*Math.sin(walk.pitch)};
    };
    const clipNear=(vertices)=>{
      const near=.17,result=[];
      for(let j=0;j<vertices.length;j++){
        const prev=vertices[(j+vertices.length-1)%vertices.length],curr=vertices[j];
        const a=prev.depth>=near,b=curr.depth>=near;
        if(a!==b){const t=(near-prev.depth)/(curr.depth-prev.depth);result.push({x:prev.x+(curr.x-prev.x)*t,y:prev.y+(curr.y-prev.y)*t,depth:near,u:prev.u+(curr.u-prev.u)*t,v:prev.v+(curr.v-prev.v)*t})}
        if(b)result.push(curr);
      }
      return result;
    };
    const polys=[];
    const add=(points,fill,stroke='#739586',width=1,kind='face',finish=null,uvs=null)=>{
      const world=points.map((p,i)=>({...(cameraMode==='walk'?walkthroughPoint(...p):projectP(...p)),u:uvs?.[i]?.[0],v:uvs?.[i]?.[1]}));
      const pts=cameraMode==='walk'?clipNear(world).map(p=>({x:cw/2+p.x*Math.min(cw,ch)*.74/p.depth,y:ch/2-p.y*Math.min(cw,ch)*.74/p.depth,depth:p.depth,u:p.u,v:p.v})):world;
      if(pts.length<3)return;
      polys.push({pts,fill,stroke,width,depth:pts.reduce((s,p)=>s+p.depth,0)/pts.length,kind,finish});
    };
    const shade=(hex,factor)=>'#'+[1,3,5].map(i=>clamp(Math.round(parseInt(hex.slice(i,i+2),16)*factor),0,255).toString(16).padStart(2,'0')).join('');
    // A complete solid has a top, bottom, and all four sides. Which sides are
    // visible changes as the user orbits the model, so none can be omitted.
    const cuboid=(corners,z,height,fill,stroke='#739586',kind='solid',width=.65,finish=null)=>{
      const bottom=corners.map(([x,y])=>[x,y,z]);
      const top=corners.map(([x,y])=>[x,y,z+height]);
      add([...bottom].reverse(),shade(fill,.68),stroke,width,kind);
      [0.81,.90,.73,.86].forEach((factor,i)=>{
        const next=(i+1)%4;
        add([bottom[i],bottom[next],top[next],top[i]],shade(fill,factor),stroke,width,kind);
      });
      add(top,fill,stroke,width,kind,finish,finish?corners:null);
    };
    // A wall is a thin solid with two faces and jambs. Sections above/below
    // apertures are the only solids drawn, leaving actual see-through holes.
    const wallPiece=(wall,span,z,plus,minus)=>{
      const a=[wall.x1+wall.ux*span.start,wall.y1+wall.uy*span.start];
      const b=[wall.x1+wall.ux*span.end,wall.y1+wall.uy*span.end];
      const nx=-wall.uy*.17,ny=wall.ux*.17,lo=z+span.bottom,hi=z+span.top;
      const a1=[a[0]+nx,a[1]+ny],b1=[b[0]+nx,b[1]+ny];
      const a2=[a[0]-nx,a[1]-ny],b2=[b[0]-nx,b[1]-ny];
      const alpha=cameraMode==='walk'||!xrayWalls?1:.43;
      const tint=(hex,a)=>`rgba(${[1,3,5].map(k=>parseInt(hex.slice(k,k+2),16)).join(',')},${a})`;
      add([[...a1,lo],[...b1,lo],[...b1,hi],[...a1,hi]],tint(plus.base,alpha),shade(plus.base,.7),.36,'wall',plus,[[span.start,span.bottom],[span.end,span.bottom],[span.end,span.top],[span.start,span.top]]);
      add([[...b2,lo],[...a2,lo],[...a2,hi],[...b2,hi]],tint(minus.base,alpha),shade(minus.base,.7),.36,'wall',minus,[[span.end,span.bottom],[span.start,span.bottom],[span.start,span.top],[span.end,span.top]]);
      add([[...a2,lo],[...a1,lo],[...a1,hi],[...a2,hi]],tint(shade(plus.base,.79),alpha),'#7d9c87',.25,'jamb');
      add([[...b1,lo],[...b2,lo],[...b2,hi],[...b1,hi]],tint(shade(minus.base,.79),alpha),'#7d9c87',.25,'jamb');
      add([[...a1,hi],[...b1,hi],[...b2,hi],[...a2,hi]],shade(plus.base,.9),shade(plus.base,.7),.35,'wall-top');
      if(span.bottom>.01)add([[...a2,lo],[...b2,lo],[...b1,lo],[...a1,lo]],shade(plus.base,.88),shade(plus.base,.7),.3,'wall-sill');
    };
    const rotatedCorners=(e,x=e.x,y=e.y,w=e.w,h=e.h)=>{
      const angle=(e.rotation||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),mx=e.x+e.w/2,my=e.y+e.h/2;
      return [[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(([px,py])=>{
        const dx=px-mx,dy=py-my;
        return [mx+dx*c-dy*s,my+dx*s+dy*c];
      });
    };
    // Split a floor slab around the footprint of a stair or elevator from the
    // level below. Keeping the pieces rectangular avoids fake floor surfaces
    // across the opening, while preserving editable room rectangles in 2D.
    const slabSections=(room,holes)=>{
      let parts=[{x:room.x,y:room.y,w:room.w,h:room.h}];
      for(const hole of holes){
        const next=[];
        for(const r of parts){
          const x1=Math.max(r.x,hole.x),x2=Math.min(r.x+r.w,hole.x+hole.w);
          const y1=Math.max(r.y,hole.y),y2=Math.min(r.y+r.h,hole.y+hole.h);
          if(x2-x1<.01||y2-y1<.01){next.push(r);continue}
          next.push({x:r.x,y:r.y,w:x1-r.x,h:r.h},{x:x2,y:r.y,w:r.x+r.w-x2,h:r.h},{x:x1,y:r.y,w:x2-x1,h:y1-r.y},{x:x1,y:y2,w:x2-x1,h:r.y+r.h-y2});
        }
        parts=next.filter(p=>p.w>.01&&p.h>.01);
      }
      return parts;
    };
    const palette=['#e4f0e3','#e8eee2','#e4edf0','#eee9e0','#eff0e4','#e6efe7','#e5edf1'];
    visible.forEach(f=>{
      const i=project.floors.findIndex(l=>l.id===f.id),z=floorBase(i),rooms=f.items.filter(e=>e.type==='room');
      const tallest=Math.max(8,...rooms.map(architecture.roomHeight));
      const holes=geometry.connectionsAt(project.floors,i).map(({fixture:e})=>{
        const points=rotatedCorners(e),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
        const x=Math.min(...xs),y=Math.min(...ys);
        return {x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y};
      });
      // Every opening cuts the wall mesh itself. This also works when a door
      // crosses a T-junction splitting one wall into multiple unique segments.
      const doorLeaves=new Set();
      for(const wall of geometry.wallSections(f.items,tallest)){
        const owners=rooms.filter(e=>wall.roomIds.includes(e.id));
        if(cameraMode!=='walk'&&cutawayWalls&&owners.length===1&&architecture.isFrontExteriorWall(wall,owners[0],orbit.theta))continue;
        const fallback=wallFinish(owners[0]),faces={plus:fallback,minus:fallback};
        for(const owner of owners){
          const side=architecture.sideOfRoom(owner,wall),face=architecture.roomFaceSign(owner,wall)>0?'plus':'minus';
          faces[face]=wallFinishForSide(owner,side);
        }
        const wallHeight=Math.max(8,...owners.map(architecture.roomHeight));
        wall.sections.forEach(section=>{
          const top=Math.min(section.top,wallHeight);
          if(top>section.bottom+.01)wallPiece(wall,{...section,top},z,faces.plus,faces.minus);
        });
        for(const opening of wall.openings){
          const point=t=>[wall.x1+wall.ux*t,wall.y1+wall.uy*t];
          const a=point(opening.start),b=point(opening.end);
          if(opening.type==='window'){
            add([[...a,z+opening.bottom],[...b,z+opening.bottom],[...b,z+opening.top],[...a,z+opening.top]],'rgba(117,198,213,.46)','#408b9a',1.3,'glass');
          }else if(!doorLeaves.has(opening.id)){
            doorLeaves.add(opening.id);
            const hinge=point(opening.center-opening.width/2);
            const swing=opening.width*.87,dx=wall.ux*.46-wall.uy*.89,dy=wall.uy*.46+wall.ux*.89;
            const end=[hinge[0]+dx*swing,hinge[1]+dy*swing];
            add([[...hinge,z+.08],[...end,z+.08],[...end,z+6.55],[...hinge,z+6.55]],'rgba(207,170,123,.65)','#9f7951',.9,'door-leaf');
          }
        }
      }
      f.items.forEach((e,k)=>{
        if(e.type==='room'){
          const {x,y,w,h}=e;
          // Slabs follow the actual room footprint, not the bounding box of
          // every floor. An added room must never create dangling edge lines.
          const finish=floorFinish(e);
          for(const part of slabSections(e,holes))cuboid([[part.x,part.y],[part.x+part.w,part.y],[part.x+part.w,part.y+part.h],[part.x,part.y+part.h]],z-.25,.35,finish.base||palette[k%palette.length],'#9db3a3','floor',.3,finish);
          // A real ceiling appears only while walking inside. The orbit view
          // stays open-topped so furniture and all levels remain inspectable.
          if(cameraMode==='walk')add([[x,y,z+architecture.roomHeight(e)],[x+w,y,z+architecture.roomHeight(e)],[x+w,y+h,z+architecture.roomHeight(e)],[x,y+h,z+architecture.roomHeight(e)]],'#f1efe8','#d3d6ce',.25,'ceiling');
        }else if(e.type==='furniture'){
          const {x,y,w,h}=e;
          if(e.subType==='stairs'){
            const steps=8,rise=(levels[i+1]===undefined?architecture.roomHeight(rooms[0]):levels[i+1]-levels[i])/steps;
            for(let step=0;step<steps;step++)cuboid(rotatedCorners(e,x,y+h*step/steps,w,h/steps),z+.1,(step+1)*rise,'#c8b9a0','#8b9986','stairs',.6);
          }else if(e.subType==='elevator'){
            const corners=rotatedCorners(e);
            const endFloor=geometry.connectionSpan(project.floors,i,e);
            const shaftHeight=showAll?Math.max(8,levels[endFloor]-levels[i]):8;
            cuboid(corners,z+.1,.35,'#b9d7d7','#568a91','elevator',.65);
            for(let side=0;side<4;side++){
              const a=corners[side],b=corners[(side+1)%4];
              add([[...a,z+.45],[...b,z+.45],[...b,z+shaftHeight],[...a,z+shaftHeight]],'rgba(111,169,179,.25)','#568c97',.75,'elevator-shaft');
            }
          }else if(e.subType==='rug'){
            const rugColor=safeColor(e.color||'#c49d7b');
            cuboid(rotatedCorners(e),z+.1,.07,rugColor,shade(rugColor,.71),'rug',.2);
            const border=rotatedCorners(e,x+.25,y+.25,Math.max(.1,w-.5),Math.max(.1,h-.5));
            add(border.map(p=>[...p,z+.18]),shade(rugColor,1.11),shade(rugColor,.79),.8,'rug-border');
            const center=rotatedCorners(e,x+.52,y+.52,Math.max(.1,w-1.04),Math.max(.1,h-1.04));
            add(center.map(p=>[...p,z+.182]),rugColor,shade(rugColor,.85),.6,'rug-center',finishes.prepare({type:'floor',pattern:'herringbone',base:rugColor,accent:shade(rugColor,.79)}),center);
          }else if(ceilingTypes.has(e.subType)){
            const ceiling=architecture.ceilingForFixture(e,rooms),drop=clamp(Number(e.drop)||.3,.2,5);
            const cx=x+w/2,cy=y+h/2,mountZ=z+ceiling-.08,headZ=z+ceiling-drop;
            const disc=(radius,height)=>Array.from({length:12},(_,j)=>{const a=j*Math.PI/6;return [cx+Math.cos(a)*radius,cy+Math.sin(a)*radius,height]});
            const glow=safeColor(e.color||'#f7d999');
            add(disc(.52,mountZ),'#eeeae0','#abac9f',.35,'ceiling-mount');
            cuboid([[cx-.09,cy-.09],[cx+.09,cy-.09],[cx+.09,cy+.09],[cx-.09,cy+.09]],headZ,Math.max(.1,mountZ-headZ),'#a49b8c','#827b6b','fixture',.3);
            if(e.subType==='ceilingFan'){
              for(let blade=0;blade<4;blade++){
                const a=(e.rotation||0)*Math.PI/180+blade*Math.PI/2,ux=Math.cos(a),uy=Math.sin(a),vx=-uy,vy=ux;
                const quad=[[.38,-.31],[Math.min(w,h)*.46,-.27],[Math.min(w,h)*.46,.27],[.38,.31]].map(([r,t])=>[cx+ux*r+vx*t,cy+uy*r+vy*t]);
                cuboid(quad,headZ-.12,.13,'#b7a68b','#8c806f','fan-blade',.25);
              }
              add(disc(.48,headZ+.04),'#b5ad9f','#877f73',.5,'fan-hub');
              add(disc(.35,headZ-.13),glow,'#c9a96a',.25,'fan-light');
            }else if(e.subType==='pendant'){
              const radius=Math.min(w,h)*.43,top=disc(.3,headZ+.55),rim=disc(radius,headZ);
              for(let j=0;j<12;j++)add([top[j],top[(j+1)%12],rim[(j+1)%12],rim[j]],j%2?'#c9b8a0':'#ddc8a7','#ad9d85',.22,'pendant-shade');
              add([...rim].reverse(),glow,'#d3b177',.35,'light');
            }else{
              add(disc(1.05,headZ+.08),'#eee7d6','#b9a98d',.45,'light-rim');
              add(disc(.86,headZ-.01),glow,'#d1b279',.3,'light');
            }
          }else{
            const roomCeiling=architecture.ceilingForFixture(e,rooms),isMounted=e.subType==='custom'&&e.mount==='ceiling';
            const hz=e.subType==='custom'?clamp(Number(e.height)||3,.5,isMounted?roomCeiling-.4:30):e.subType==='plant'?2.7:e.subType==='bed'||e.subType==='sofa'?2:2.8;
            const baseZ=isMounted?z+roomCeiling-hz-clamp(Number(e.drop)||.2,.2,5):z+.1;
            const topColor=e.subType==='custom'?safeColor(e.color):e.subType==='plant'?'#719b71':e.subType==='table'||e.subType==='desk'?'#cfae88':e.subType==='bed'?'#eff5e9':'#a2bda7';
            const objectPart=(u,v,uw,vh,base,height,color=topColor)=>cuboid(rotatedCorners(e,e.x+u*e.w,e.y+v*e.h,uw*e.w,vh*e.h),baseZ+base*hz,Math.max(.05,height*hz),color,'#789887','furniture',.4);
            if(e.subType==='sofa'){
              objectPart(.03,.07,.94,.85,.12,.30,'#b4c9ba');
              objectPart(.03,.02,.94,.28,.44,.55,'#94b2a1');
              objectPart(.02,.09,.17,.85,.35,.48,'#9eb9a8');
              objectPart(.81,.09,.17,.85,.35,.48,'#9eb9a8');
              objectPart(.2,.34,.29,.56,.43,.16,'#d1dfd1');
              objectPart(.51,.34,.29,.56,.43,.16,'#c6d9ca');
            }else if(e.subType==='bed'){
              objectPart(0,.04,1,.92,.08,.28,'#9baf9d');
              objectPart(.04,.07,.92,.86,.29,.40,'#f7f5ed');
              objectPart(.04,.34,.92,.58,.68,.15,'#e6efdd');
              objectPart(.08,.11,.37,.19,.69,.17,'#d4e0d0');
              objectPart(.55,.11,.37,.19,.69,.17,'#d4e0d0');
              objectPart(0,0,1,.12,.09,.88,'#8b9d8c');
            }else if(e.subType==='sink'){
              objectPart(0,0,1,1,0,.77,'#b5c5bb');
              objectPart(.05,.05,.90,.90,.78,.12,'#f1f4ed');
              objectPart(.18,.14,.64,.62,.90,.035,'#b7d4d1');
              objectPart(.45,.10,.1,.13,.94,.06,'#879e9b');
            }else if(e.subType==='toilet'){
              objectPart(.06,.02,.88,.25,0,1,'#dbe7df');
              objectPart(.18,.30,.64,.63,0,.49,'#f1f5ef');
              objectPart(.22,.36,.56,.53,.5,.14,'#fafcf6');
              objectPart(.36,.49,.28,.25,.65,.025,'#c5dfda');
            }else if(e.subType==='stove'){
              objectPart(0,0,1,1,0,.84,'#8f9e97');
              objectPart(.03,.03,.94,.94,.85,.10,'#e0e4df');
              for(const u of [.18,.62])for(const v of [.15,.59])objectPart(u,v,.20,.2,.95,.02,'#526d62');
            }else if(e.subType==='plant'){
              objectPart(.26,.26,.48,.48,0,.34,'#b49a76');
              objectPart(.18,.21,.64,.60,.33,.32,'#629d72');
              objectPart(.05,.05,.46,.52,.59,.30,'#73ad7f');
              objectPart(.45,.21,.48,.54,.61,.31,'#548e65');
            }else if(e.subType==='custom'&&e.mesh&&window.HouseMeshImport?.validMesh(e.mesh)){
              const angle=(e.rotation||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),mx=e.x+e.w/2,my=e.y+e.h/2;
              const points=e.mesh.vertices.map(v=>{const x=e.x+v[0]*e.w,y=e.y+v[1]*e.h,dx=x-mx,dy=y-my;return [mx+dx*c-dy*s,my+dx*s+dy*c,baseZ+v[2]*hz]});
              for(const triangle of e.mesh.faces){
                const p=triangle.map(j=>points[j]);
                const ax=p[1][0]-p[0][0],ay=p[1][1]-p[0][1],az=p[1][2]-p[0][2],bx=p[2][0]-p[0][0],by=p[2][1]-p[0][1],bz=p[2][2]-p[0][2];
                const nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx,mag=Math.hypot(nx,ny,nz)||1;
                const light=clamp(.72+(nx*.24-ny*.21+nz*.35)/mag,.44,1);
                const color=shade(topColor,light);add(p,color,color,.12,'mesh');
              }
            }else if(e.subType==='custom'&&e.shape==='table'){
              objectPart(.05,.05,.9,.9,.82,.18);
              for(const u of [.08,.82])for(const v of [.08,.82])objectPart(u,v,.1,.1,0,.83,shade(topColor,.75));
            }else if(e.subType==='custom'&&e.shape==='shelf'){
              objectPart(0,0,.11,1,0,1);objectPart(.89,0,.11,1,0,1);
              for(const tier of [0,.33,.66,.94])objectPart(0,0,1,1,tier,.07,shade(topColor,1));
            }else if(e.subType==='custom'&&e.shape==='cylinder'){
              const centerX=e.x+e.w/2,centerY=e.y+e.h/2,angle=(e.rotation||0)*Math.PI/180;
              const rim=Array.from({length:12},(_,j)=>{const t=j*Math.PI/6+angle;return [centerX+Math.cos(t)*e.w/2,centerY+Math.sin(t)*e.h/2]});
              add(rim.map(p=>[...p,baseZ+hz]),topColor,shade(topColor,.75),.35,'furniture');
              for(let j=0;j<12;j++){const a=rim[j],b=rim[(j+1)%12];add([[...a,baseZ],[...b,baseZ],[...b,baseZ+hz],[...a,baseZ+hz]],shade(topColor,.72+.2*Math.sin(j*.5)**2),shade(topColor,.64),.3,'furniture')}
            }else if(e.subType==='custom'&&e.shape==='cabinet'){
              objectPart(0,0,1,1,0,1);objectPart(.06,.01,.88,.035,.13,.75,shade(topColor,1));
            }else if(e.subType==='table'||e.subType==='desk'){
              objectPart(.03,.03,.94,.94,.72,.15);
              for(const u of [.08,.82])for(const v of [.08,.82])objectPart(u,v,.1,.1,0,.74,shade(topColor,.74));
            }else cuboid(rotatedCorners(e),baseZ,hz,topColor,'#6e9680','furniture');
          }
        }
      });
    });
    if(cameraMode==='walk'&&walkContext&&window.HouseDepthRender){
      // Limit indoor software-rendering resolution for low-powered phones.
      // Depth testing resolves every pixel, including surfaces that intersect
      // in screen space; average polygon sorting cannot do that reliably.
      const factor=Math.min(1,740/Math.max(cw,ch));
      const rw=Math.max(1,Math.round(cw*factor)),rh=Math.max(1,Math.round(ch*factor));
      if(walkCanvas.width!==rw)walkCanvas.width=rw;
      if(walkCanvas.height!==rh)walkCanvas.height=rh;
      const frame=walkContext.createImageData(rw,rh);
      frame.data.set(window.HouseDepthRender.rasterize(polys,rw,rh,rw/cw,rh/ch));
      walkContext.putImageData(frame,0,0);
      ctx3d.imageSmoothingEnabled=true;
      ctx3d.drawImage(walkCanvas,0,0,cw,ch);
    }else{
      polys.sort((a,b)=>b.depth-a.depth);
      ctx3d.lineJoin='round';
      const paintFinish=(p)=>{
        if(!p.finish||!p.pts.every(v=>Number.isFinite(v.u)&&Number.isFinite(v.v)))return false;
        const [a,b,c]=p.pts,du=b.u-a.u,dv=b.v-a.v,eu=c.u-a.u,ev=c.v-a.v,det=du*ev-eu*dv;
        if(Math.abs(det)<.0001)return false;
        const xu=((b.x-a.x)*ev-(c.x-a.x)*dv)/det,xv=((c.x-a.x)*du-(b.x-a.x)*eu)/det;
        const yu=((b.y-a.y)*ev-(c.y-a.y)*dv)/det,yv=((c.y-a.y)*du-(b.y-a.y)*eu)/det;
        const tx=a.x-xu*a.u-xv*a.v,ty=a.y-yu*a.u-yv*a.v;
        const f=finishes.prepare(p.finish),key=[f.type,f.pattern,f.base,f.accent].join('|');
        let pattern=roomTextureCache.get(key);
        if(!pattern){
          // A 32-foot tile avoids obvious repeated seams within most rooms.
          const tex=document.createElement('canvas');tex.width=tex.height=384;
          const tc=tex.getContext('2d'),data=tc.createImageData(384,384);
          for(let y=0;y<384;y++)for(let x=0;x<384;x++){
            const rgb=finishes.sample(f,x/12,y/12),offset=(y*384+x)*4;
            data.data[offset]=rgb>>16&255;data.data[offset+1]=rgb>>8&255;data.data[offset+2]=rgb&255;data.data[offset+3]=255;
          }
          tc.putImageData(data,0,0);
          pattern=ctx3d.createPattern(tex,'repeat');
          if(roomTextureCache.size>40)roomTextureCache.clear();
          roomTextureCache.set(key,pattern);
        }
        const us=p.pts.map(v=>v.u),vs=p.pts.map(v=>v.v),umin=Math.min(...us),vmin=Math.min(...vs),umax=Math.max(...us),vmax=Math.max(...vs);
        const alpha=Number(/rgba\([^)]*,\s*([\d.]+)\)/i.exec(p.fill)?.[1]||1);
        ctx3d.save();ctx3d.clip();ctx3d.globalAlpha=alpha;
        ctx3d.transform(xu/12,yu/12,xv/12,yv/12,tx,ty);
        ctx3d.fillStyle=pattern;ctx3d.fillRect(umin*12-2,vmin*12-2,(umax-umin)*12+4,(vmax-vmin)*12+4);
        ctx3d.restore();
        return true;
      };
      for(const p of polys){
        ctx3d.beginPath();
        p.pts.forEach((v,i)=>i?ctx3d.lineTo(v.x,v.y):ctx3d.moveTo(v.x,v.y));
        ctx3d.closePath();if(!paintFinish(p)){ctx3d.fillStyle=p.fill;ctx3d.fill()}
        ctx3d.strokeStyle=p.stroke;ctx3d.lineWidth=p.width;ctx3d.stroke();
      }
    }
    $('modelFloorList').innerHTML=visible.map(f=>`<span class="model-floor-tag">${esc(f.name)} · ${Math.round(area(f))} ft²</span>`).reverse().join('');
  }
  function occupiedInWalk(x,y,clearance){
    return floor().items.some(e=>{
      if(e.type!=='furniture'||['stairs','elevator'].includes(e.subType))return false;
      if(e.mount==='ceiling'||ceilingTypes.has(e.subType)||e.subType==='rug')return false;
      // The camera is at eye height: a sofa or bed should not force the
      // viewpoint against the wall. Only full-height fixtures block it.
      if((e.subType==='custom'?Number(e.height)||3:3)<4.5)return false;
      const centerX=e.x+e.w/2,centerY=e.y+e.h/2,angle=-(e.rotation||0)*Math.PI/180;
      const dx=x-centerX,dy=y-centerY;
      const localX=dx*Math.cos(angle)-dy*Math.sin(angle),localY=dx*Math.sin(angle)+dy*Math.cos(angle);
      return Math.abs(localX)<e.w/2+clearance&&Math.abs(localY)<e.h/2+clearance;
    });
  }
  function resetWalk(){
    const rooms=floor().items.filter(e=>e.type==='room');
    const start=rooms[0];
    let x=start?start.x+start.w/2:15,y=start?start.y+start.h/2:15;
    if(start){
      const offsets=[[0,0],[.2,.15],[-.2,.15],[.2,-.15],[-.2,-.15],[.3,0],[-.3,0],[0,.3],[0,-.3]];
      const safe=offsets.map(([u,v])=>({x:start.x+start.w*(.5+u),y:start.y+start.h*(.5+v)}))
        .find(p=>p.x>start.x+.7&&p.x<start.x+start.w-.7&&p.y>start.y+.7&&p.y<start.y+start.h-.7&&!occupiedInWalk(p.x,p.y,.75));
      if(safe){x=safe.x;y=safe.y}
    }
    const nearEdge=(p,r)=>p.x>=r.x-.35&&p.x<=r.x+r.w+.35&&p.y>=r.y-.35&&p.y<=r.y+r.h+.35&&
      (Math.abs(p.x-r.x)<.4||Math.abs(p.x-r.x-r.w)<.4||Math.abs(p.y-r.y)<.4||Math.abs(p.y-r.y-r.h)<.4);
    const openings=start?floor().items.filter(e=>(e.type==='window'||e.type==='door')&&nearEdge(e,start)):[];
    const focus=openings.find(e=>e.type==='window')||openings[0];
    // Aim toward an opening where possible, otherwise toward a corner.
    const lookX=focus?.x??(start?.x??x-5),lookY=focus?.y??(start?.y??y-5);
    walk={x,y,z:5.1,yaw:Math.atan2(lookY-y,lookX-x),pitch:-.12};
    $('walkFloor').innerHTML=project.floors.map(f=>`<option value="${esc(f.id)}" ${f.id===project.activeFloorId?'selected':''}>${esc(f.name)}</option>`).join('');
  }
  function enterWalk(){
    cameraMode='walk';resetWalk();$('threeDStage').classList.add('walking');$('walkToolbar').classList.remove('hidden');render3D();
    toast('Walkthrough started. Drag to look, use the arrows to move.');
  }
  function exitWalk(){stopWalkHold();cameraMode='orbit';$('threeDStage').classList.remove('walking');$('walkToolbar').classList.add('hidden');render3D()}
  function walkStep(direction){
    if(cameraMode!=='walk')return;
    if(direction==='left')walk.yaw-=Math.PI/24;
    else if(direction==='right')walk.yaw+=Math.PI/24;
    else{
      const rooms=floor().items.filter(e=>e.type==='room');
      const doors=floor().items.filter(e=>e.type==='door');
      const next=window.HouseWalkNavigation.move(walk,direction,.65,rooms,doors,occupiedInWalk);
      walk.x=next.x;walk.y=next.y;
    }
    requestModelRender();
  }
  let pendingWalkFrame=false;
  function requestModelRender(){
    if(cameraMode!=='walk'){render3D();return}
    if(pendingWalkFrame)return;
    pendingWalkFrame=true;
    requestAnimationFrame(()=>{pendingWalkFrame=false;render3D()});
  }
  $('enterWalk').addEventListener('click',enterWalk);
  $('exitWalk').addEventListener('click',exitWalk);
  $('walkFloor').addEventListener('change',e=>{stopWalkHold();project.activeFloorId=e.target.value;selected=null;resetWalk();save();render()});
  let walkingHoldTimeout=null,walkingHoldInterval=null;
  function stopWalkHold(){
    clearTimeout(walkingHoldTimeout);clearInterval(walkingHoldInterval);
    walkingHoldTimeout=null;walkingHoldInterval=null;
  }
  document.querySelectorAll('[data-walk]').forEach(b=>{
    b.addEventListener('pointerdown',e=>{
      if(e.pointerType==='mouse'&&e.button!==0)return;
      e.preventDefault();stopWalkHold();walkStep(b.dataset.walk);
      if(b.setPointerCapture)b.setPointerCapture(e.pointerId);
      walkingHoldTimeout=setTimeout(()=>{
        walkingHoldInterval=setInterval(()=>walkStep(b.dataset.walk),135);
      },240);
    });
    for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,stopWalkHold);
    // Keyboard activation creates a click without pointerdown.
    b.addEventListener('click',e=>{if(e.detail===0)walkStep(b.dataset.walk)});
  });
  const modelTouches=new Map();let modelPinch=null;
  modelCanvas.addEventListener('pointerdown',e=>{
    modelCanvas.setPointerCapture(e.pointerId);
    if(e.pointerType==='touch'){
      modelTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(modelTouches.size>=2){if(cameraMode==='walk'){spin=null;return}const p=[...modelTouches.values()];modelPinch={distance:Math.max(10,Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)),zoom:orbit.zoom};spin=null;return}
    }
    spin={x:e.clientX,y:e.clientY,theta:cameraMode==='walk'?walk.yaw:orbit.theta,phi:cameraMode==='walk'?walk.pitch:orbit.phi};
  });
  modelCanvas.addEventListener('pointermove',e=>{
    if(e.pointerType==='touch'&&modelTouches.has(e.pointerId)){
      modelTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(modelPinch&&modelTouches.size>=2){const p=[...modelTouches.values()];orbit.zoom=clamp(modelPinch.zoom*Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)/modelPinch.distance,.5,3);render3D();return}
    }
    if(!spin)return;
    // Direct-touch look: moving a finger up moves the scene up, and moving
    // it down moves the scene down. Do not change the orbit camera's drag.
    if(cameraMode==='walk'){walk.yaw=spin.theta-(e.clientX-spin.x)*.007;walk.pitch=clamp(spin.phi+(e.clientY-spin.y)*.006,-.6,.6)}
    else{orbit.theta=spin.theta+(e.clientX-spin.x)*.012;orbit.phi=clamp(spin.phi+(e.clientY-spin.y)*.009,.25,1.48)}
    requestModelRender();
  });
  const stopModelPointer=e=>{modelTouches.delete(e.pointerId);if(modelTouches.size<2)modelPinch=null;spin=null};
  modelCanvas.addEventListener('pointerup',stopModelPointer);
  modelCanvas.addEventListener('pointercancel',stopModelPointer);
  modelCanvas.addEventListener('wheel',e=>{e.preventDefault();if(cameraMode==='walk')walkStep(e.deltaY<0?'forward':'back');else{orbit.zoom=clamp(orbit.zoom*(e.deltaY<0?1.11:.9),.5,3);render3D()}},{passive:false});
  $('showAllFloors').addEventListener('change',e=>{showAll=e.target.checked;render3D()});
  $('separateFloors').addEventListener('change',e=>{separateFloors=e.target.checked;render3D()});
  $('cutawayWalls').addEventListener('change',e=>{cutawayWalls=e.target.checked;render3D()});
  $('xrayWalls').addEventListener('change',e=>{xrayWalls=e.target.checked;render3D()});
  $('reset3D').addEventListener('click',()=>{orbit={theta:-.73,phi:.86,zoom:1};render3D()});
  function activateProject(next){
    project=next;if(!Array.isArray(project.prefabs))project.prefabs=[];
    cameraMode='orbit';$('threeDStage').classList.remove('walking');$('walkToolbar').classList.add('hidden');
    project.viewMode='2d';selected=null;activeTool='select';furnitureTool=null;
    history=[];future=[];pointer=null;draft=null;showSnapGuides(null);
    camera={cx:22,cy:18.5,zoom:1};currentTab='properties';sheetOpen=false;
    closeMobileToolMenus();closeProjectsDialog();render();fitDrawing();
  }
  function createNewProject(){
    try{
      requireSaved();
      const f={id:id(),name:'Ground floor',items:[]};
      const next=store.add({name:'Untitled house',floors:[f],activeFloorId:f.id,viewMode:'2d',prefabs:[]});
      activateProject(next);toast('New project ready. Your other designs are in My projects.');
    }catch(e){toast('Could not create project: '+e.message)}
  }
  function renderProjectsList(){
    const entries=store.list();
    $('projectsList').innerHTML=entries.map(entry=>{
      const current=entry.id===project.id,when=new Date(entry.updatedAt).toLocaleDateString();
      return `<div class="project-entry ${current?'current':''}"><div class="project-entry-info"><strong>${esc(entry.name)} ${current?'· Current':''}</strong><small>${entry.floors} floor${entry.floors===1?'':'s'} · ${entry.rooms} rooms · Saved ${esc(when)}</small></div><div class="project-entry-actions"><button data-project-operation="open" data-project-id="${esc(entry.id)}" ${current?'disabled':''}>${current?'Open now':'Open'}</button><button data-project-operation="duplicate" data-project-id="${esc(entry.id)}">Copy</button>${store.hasRecovery(entry.id)?`<button data-project-operation="recover" data-project-id="${esc(entry.id)}">Recover</button>`:''}<button data-project-operation="delete" data-project-id="${esc(entry.id)}" ${entries.length===1?'disabled':''}>Delete</button></div></div>`;
    }).join('');
  }
  function closeProjectsDialog(){$('projectsDialog').classList.add('hidden')}
  function openProjectsDialog(){
    persistNow();renderProjectsList();$('projectsDialog').classList.remove('hidden');
    // Browsers can protect frequently used offline projects from automatic
    // storage-pressure eviction. A downloaded backup is still recommended.
    if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
  }
  $('newBtn').addEventListener('click',createNewProject);
  $('projectsBtn').addEventListener('click',openProjectsDialog);
  $('closeProjectsDialog').addEventListener('click',closeProjectsDialog);
  $('projectsDialog').addEventListener('click',e=>{if(e.target===$('projectsDialog'))closeProjectsDialog()});
  $('createProjectBtn').addEventListener('click',createNewProject);
  $('backupAllBtn').addEventListener('click',()=>{
    try{persistNow();download(new Blob([JSON.stringify(store.exportAll(),null,2)],{type:'application/json'}),'houseplan-all-projects-backup.json');toast('All projects downloaded as a backup')}
    catch(e){toast('Backup failed: '+e.message)}
  });
  $('restoreLibraryBtn').addEventListener('click',()=>$('fileInput').click());
  $('projectsList').addEventListener('click',e=>{
    const b=e.target.closest('[data-project-operation]');if(!b)return;
    const operation=b.dataset.projectOperation,target=b.dataset.projectId;
    try{
      requireSaved();
      if(operation==='open'){
        const next=store.open(target);if(!next)throw Error('That project could not be read');
        activateProject(next);toast('Project opened');
      }else if(operation==='duplicate'){
        const next=store.duplicate(target);if(!next)throw Error('Project not found');
        activateProject(next);toast('Project copied');
      }else if(operation==='delete'){
        if(!confirm('Permanently delete this project from this device? Export a backup first if you want to keep it.'))return;
        if(!store.remove(target))throw Error('The last project cannot be deleted');
        if(target===project.id){
          const next=store.open(store.activeId());if(next)activateProject(next);
        }
        renderProjectsList();toast('Project deleted');
      }else if(operation==='recover'){
        if(!confirm('Restore an earlier saved version of this project? The current version will be replaced.'))return;
        const recovered=store.recover(target);if(!recovered)throw Error('No recovery save available');
        if(target===project.id)activateProject(recovered);
        else store.open(project.id);
        renderProjectsList();toast('Earlier save restored');
      }
    }catch(err){toast('Project action failed: '+err.message)}
  });
  $('projectMenuBtn').addEventListener('click',e=>{e.stopPropagation();$('exportMenu').classList.add('hidden');const open=$('projectMenu').classList.toggle('hidden')===false;$('projectMenuBtn').setAttribute('aria-expanded',String(open))});
  $('projectMenu').addEventListener('click',e=>{
    const b=e.target.closest('[data-project-action]');if(!b)return;
    $('projectMenu').classList.add('hidden');$('projectMenuBtn').setAttribute('aria-expanded','false');
    if(b.dataset.projectAction==='new')$('newBtn').click();
    if(b.dataset.projectAction==='library')openProjectsDialog();
    if(b.dataset.projectAction==='import')$('fileInput').click();
    if(b.dataset.projectAction==='overview'){currentTab='overview';sheetOpen=true;render()}
  });
  function renderPrefabList(){
    const filter=$('prefabFilter').value;
    const visible=project.prefabs.filter(p=>filter==='all'||(p.category||'Furniture')===filter);
    $('prefabList').innerHTML=visible.length?visible.map(p=>`<div class="prefab-entry"><span>${esc(p.name)} · ${esc(p.category||'Furniture')} ${p.mesh?'· '+p.mesh.faces.length+' triangles':'· '+esc(p.shape||'box')} · ${nice(p.w)} × ${nice(p.h)} × ${nice(p.height||3)} ft</span><button type="button" data-remove-prefab="${esc(p.id)}" aria-label="Remove ${esc(p.name)} from prefab library">Remove</button></div>`).join(''):'<p>No prefabs in this category yet.</p>';
  }
  $('prefabFilter').addEventListener('change',renderPrefabList);
  let pendingMesh=null;
  function closePrefabDialog(){$('prefabDialog').classList.add('hidden')}
  $('newPrefabBtn').addEventListener('click',()=>{
    pendingMesh=null;$('prefabModel').value='';$('prefabModelStatus').textContent='Optional OBJ/GLB: up to 900 triangles, no textures. The model is saved inside your project.';
    renderPrefabList();$('prefabDialog').classList.remove('hidden');$('prefabName').focus();
  });
  $('prefabModel').addEventListener('change',async e=>{
    pendingMesh=null;const file=e.target.files?.[0];
    if(!file){$('prefabModelStatus').textContent='No model selected — your chosen 3D shape will be used.';return}
    const status=$('prefabModelStatus');status.textContent='Reading model…';
    try{
      if(file.size>1048576)throw Error('Max file size is 1 MB. Please simplify the model first.');
      const ext=file.name.toLowerCase().split('.').pop();
      if(ext!=='obj'&&ext!=='glb')throw Error('Choose an .obj or .glb model.');
      const mesh=ext==='obj'?window.HouseMeshImport.parseOBJ(await file.text()):window.HouseMeshImport.parseGLB(await file.arrayBuffer());
      pendingMesh={vertices:mesh.vertices,faces:mesh.faces};
      status.textContent=`✓ ${file.name}: ${mesh.triangles} triangles ready. The 3D shape menu is ignored when using an imported model.`;
      if(!$('prefabName').value.trim())$('prefabName').value=file.name.replace(/\.(obj|glb)$/i,'').slice(0,50);
    }catch(err){status.textContent='Model could not load: '+err.message;e.target.value=''}
  });
  $('closePrefabDialog').addEventListener('click',closePrefabDialog);
  $('prefabDialog').addEventListener('click',e=>{if(e.target===$('prefabDialog'))closePrefabDialog()});
  $('prefabForm').addEventListener('submit',e=>{
    e.preventDefault();
    if(project.prefabs.length>=60){toast('Maximum of 60 custom prefabs per project');return}
    const name=$('prefabName').value.trim().slice(0,50),w=Number($('prefabWidth').value),h=Number($('prefabDepth').value),height=Number($('prefabHeight').value);
    if(!name||![w,h,height].every(Number.isFinite)||w<.5||w>100||h<.5||h>100||height<.5||height>30){toast('Enter a name and valid dimensions');return}
    const prefab={id:id(),name,w,h,height,color:safeColor($('prefabColor').value),category:$('prefabCategory').value,shape:$('prefabShape').value,...(pendingMesh?{mesh:clone(pendingMesh)}:{})};
    const before=state();project.prefabs.push(prefab);changed(before);
    pendingMesh=null;$('prefabForm').reset();closePrefabDialog();setMode('2d');setTool('furniture','prefab:'+prefab.id);
    toast('Tap the drawing to place '+name);
  });
  $('prefabList').addEventListener('click',e=>{
    const b=e.target.closest('[data-remove-prefab]');if(!b)return;
    const p=project.prefabs.find(x=>x.id===b.dataset.removePrefab);if(!p)return;
    if(!confirm('Remove '+p.name+' from this project’s prefab library? Already-placed copies will stay.'))return;
    const before=state();project.prefabs=project.prefabs.filter(x=>x.id!==p.id);
    if(furnitureTool==='prefab:'+p.id)furnitureTool=null;
    changed(before);renderPrefabList();
  });
  function validatedImport(obj){
    if(!obj||!Array.isArray(obj.floors)||!obj.floors.length||obj.floors.length>50||obj.floors.some(f=>typeof f.name!=='string'||!Array.isArray(f.items)||f.items.length>10000))throw Error('Not a valid HousePlan project');
    const floors=obj.floors.map(f=>{
      const items=f.items.map(item=>{
        if(!['room','wall','door','window','furniture','measure','label'].includes(item.type))throw Error('Unsupported drawing item');
        for(const k of ['x','y','w','h','x1','y1','x2','y2','width','height','angle','rotation','ceilingHeight','drop'])if(k in item&&(!Number.isFinite(item[k])||Math.abs(item[k])>100000))throw Error('Invalid measurements');
        if((item.type==='room'||item.type==='furniture')&&(!Number.isFinite(item.x)||!Number.isFinite(item.y)||!Number.isFinite(item.w)||!Number.isFinite(item.h)||item.w<.5||item.h<.5))throw Error('Invalid room or object');
        const clean={...item,id:id()};
        if('name' in clean)clean.name=String(clean.name).slice(0,70);
        if('text' in clean)clean.text=String(clean.text).slice(0,70);
        if('color' in clean)clean.color=safeColor(clean.color);
        if(clean.type==='room'){
          clean.floorMaterial=materialKey(floorMaterials,clean.floorMaterial,'default');clean.wallMaterial=materialKey(wallMaterials,clean.wallMaterial,'sage');
          if('ceilingHeight'in clean)clean.ceilingHeight=architecture.roomHeight(clean);
          if('floorPattern'in clean)clean.floorPattern=finishes.validPattern('floor',clean.floorPattern)?clean.floorPattern:'plain';
          if('wallPattern'in clean)clean.wallPattern=finishes.validPattern('wall',clean.wallPattern)?clean.wallPattern:'paint';
          for(const key of ['floorTint','floorAccent','wallTint','wallAccent'])if(key in clean)clean[key]=finishes.hex(clean[key],key.startsWith('floor')?'#d8c6ad':'#dfe7dc');
          if(clean.wallSides&&typeof clean.wallSides==='object'){
            clean.wallSides=Object.fromEntries(architecture.sides.filter(side=>clean.wallSides[side]&&typeof clean.wallSides[side]==='object').map(side=>{
              const style=clean.wallSides[side];
              return [side,{pattern:finishes.validPattern('wall',style.pattern)?style.pattern:'paint',base:finishes.hex(style.base,'#e5e6df'),accent:finishes.hex(style.accent,'#719483')}];
            }));
          }
        }
        if(clean.type==='furniture'&&ceilingTypes.has(clean.subType))clean.drop=clamp(Number(clean.drop)||.3,.2,5);
        if(clean.type==='furniture'&&clean.subType==='custom'){
          clean.shape=['box','table','shelf','cabinet','cylinder'].includes(clean.shape)?clean.shape:'box';
          if(clean.mesh&&!window.HouseMeshImport.validMesh(clean.mesh))throw Error('Invalid imported 3D mesh');
        }
        return clean;
      });
      return {id:id(),name:f.name.slice(0,70),items};
    });
    if(Array.isArray(obj.prefabs)&&obj.prefabs.length>60)throw Error('Too many custom prefabs');
    const prefabs=Array.isArray(obj.prefabs)?obj.prefabs.filter(p=>p&&typeof p==='object'&&Number.isFinite(p.w)&&Number.isFinite(p.h)).map(p=>{
      if(p.mesh&&!window.HouseMeshImport.validMesh(p.mesh))throw Error('Invalid prefab 3D mesh');
      return {id:id(),name:String(p.name||'Custom object').slice(0,50),w:clamp(p.w,.5,100),h:clamp(p.h,.5,100),height:clamp(Number(p.height)||3,.5,30),color:safeColor(p.color),category:['Furniture','Appliances','Fixtures','Structures','Decor'].includes(p.category)?p.category:'Furniture',shape:['box','table','shelf','cabinet','cylinder'].includes(p.shape)?p.shape:'box',...(p.mesh?{mesh:p.mesh}:{})};
    }):[];
    const originalIndex=obj.floors.findIndex(f=>f.id===obj.activeFloorId);
    return {name:String(obj.name||'Imported project').slice(0,70),floors,activeFloorId:floors[Math.max(0,originalIndex)].id,viewMode:'2d',prefabs};
  }
  $('fileInput').addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;
    try{
      if(file.size>2e7)throw Error('File is too large');
      const obj=JSON.parse(await file.text());
      requireSaved();
      if(obj?.format==='houseplan-studio-library'){
        if(!Array.isArray(obj.projects)||obj.projects.length>100)throw Error('Invalid backup');
        const added=store.importAll({...obj,projects:obj.projects.map(validatedImport)});
        const opened=store.open(added[0].id);
        activateProject(opened);toast(added.length+' projects restored — existing projects kept');
      }else{
        const next=store.add(validatedImport(obj));
        activateProject(next);toast('Project imported as a new saved design');
      }
    }catch(err){toast('Could not open project: '+err.message)}finally{e.target.value=''}
  });
  $('exportBtn').addEventListener('click',e=>{e.stopPropagation();$('projectMenu').classList.add('hidden');$('projectMenuBtn').setAttribute('aria-expanded','false');$('exportMenu').classList.toggle('hidden')});
  document.addEventListener('click',e=>{if(!e.target.closest('#exportMenu,#exportBtn'))$('exportMenu').classList.add('hidden');if(!e.target.closest('#projectMenu,#projectMenuBtn')){$('projectMenu').classList.add('hidden');$('projectMenuBtn').setAttribute('aria-expanded','false')}});
  $('exportMenu').addEventListener('click',async e=>{
    const b=e.target.closest('[data-export]');if(!b)return;
    $('exportMenu').classList.add('hidden');
    try{await exportFile(b.dataset.export)}catch(err){toast('Export failed: '+err.message)}
  });
  function filename(ext){return (project.name||'houseplan').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50)+'.'+ext}
  function download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000)}
  function standaloneSVG(){
    const backup=selected;selected=null;renderPlan();
    const ext=extent(floor().items),pad=3;
    const x=ext.minX-pad,y=ext.minY-pad,w=ext.maxX-ext.minX+pad*2,h=ext.maxY-ext.minY+pad*2;
    const content=drawing.innerHTML;
    selected=backup;renderPlan();
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.max(600,Math.round(w*30))}" height="${Math.max(400,Math.round(h*30))}" viewBox="${x} ${y} ${w} ${h}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff"/>${content}</svg>`;
  }
  async function exportFile(type){
    if(type==='json'){download(new Blob([JSON.stringify({...project,viewMode:'2d'},null,2)],{type:'application/json'}),filename('json'));toast('Editable project downloaded');return}
    if(type==='print'){window.print();return}
    if(type==='svg'){download(new Blob([standaloneSVG()],{type:'image/svg+xml'}),filename('svg'));toast('SVG drawing downloaded');return}
    if(type==='png'){
      if(project.viewMode==='3d'){
        render3D();
        const blob=await new Promise(resolve=>modelCanvas.toBlob(resolve,'image/png'));
        if(!blob)throw Error('Unable to create image');download(blob,filename('png'));toast('3D view downloaded');return;
      }
      const source=standaloneSVG();const blob=new Blob([source],{type:'image/svg+xml'}),url=URL.createObjectURL(blob);
      try{
        const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url});
        const c=document.createElement('canvas');c.width=Math.min(3500,img.width);c.height=Math.round(c.width*img.height/img.width);
        const context=c.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,c.width,c.height);context.drawImage(img,0,0,c.width,c.height);
        const png=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(!png)throw Error('Unable to create image');
        download(png,filename('png'));toast('Floor plan image downloaded');
      }finally{URL.revokeObjectURL(url)}
    }
  }
  const resizeObserver=new ResizeObserver(()=>{updateView();if(project.viewMode==='3d')render3D()});
  resizeObserver.observe($('stage'));
  if('serviceWorker' in navigator&&location.protocol==='https:'){
    addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
  }
  render();if(isMobile())fitDrawing();save();setStatus('Ready to design — edit a floor or explore the whole building in 3D');
})();
