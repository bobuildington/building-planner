/* Pure floor-plan geometry shared by the editor and its regression tests. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HouseGeometry = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const precision = v => Math.round(v * 1000) / 1000;
  const close = (a,b) => Math.abs(a-b) < .001;

  function collectWallSegments(items) {
    const grouped = new Map(), diagonal = new Map();
    function edge(x1,y1,x2,y2,source,id) {
      if (![x1,y1,x2,y2].every(Number.isFinite)) return;
      if (Math.hypot(x2-x1,y2-y1)<.001) return;
      const a={x:precision(x1),y:precision(y1)},b={x:precision(x2),y:precision(y2)};
      const horizontal=close(a.y,b.y),vertical=close(a.x,b.x);
      const record={source,id};
      if (!horizontal && !vertical) {
        const endpoints=[a,b].sort((p,q)=>p.x-q.x||p.y-q.y);
        const key=endpoints.map(p=>p.x+','+p.y).join('|');
        if(!diagonal.has(key))diagonal.set(key,{x1:endpoints[0].x,y1:endpoints[0].y,x2:endpoints[1].x,y2:endpoints[1].y,sources:[]});
        diagonal.get(key).sources.push(record);
        return;
      }
      const axis=horizontal?'h':'v',constant=horizontal?a.y:a.x;
      const start=horizontal?Math.min(a.x,b.x):Math.min(a.y,b.y);
      const end=horizontal?Math.max(a.x,b.x):Math.max(a.y,b.y);
      const key=axis+':'+constant;
      if(!grouped.has(key))grouped.set(key,{axis,constant,edges:[]});
      grouped.get(key).edges.push({start,end,source,id});
    }
    for(const e of items) {
      if(e.type==='room') {
        const {x,y,w,h}=e;
        if(![x,y,w,h].every(Number.isFinite)||w<=0||h<=0)continue;
        edge(x,y,x+w,y,'room',e.id);
        edge(x+w,y,x+w,y+h,'room',e.id);
        edge(x+w,y+h,x,y+h,'room',e.id);
        edge(x,y+h,x,y,'room',e.id);
      }else if(e.type==='wall')edge(e.x1,e.y1,e.x2,e.y2,'wall',e.id);
    }
    const result=[];
    function addSegment(x1,y1,x2,y2,sources) {
      result.push({x1,y1,x2,y2,roomIds:[...new Set(sources.filter(s=>s.source==='room').map(s=>s.id))],wallIds:[...new Set(sources.filter(s=>s.source==='wall').map(s=>s.id))]});
    }
    for(const {axis,constant,edges} of grouped.values()){
      const cuts=[...new Set(edges.flatMap(e=>[e.start,e.end]))].sort((a,b)=>a-b);
      for(let i=0;i<cuts.length-1;i++){
        const start=cuts[i],end=cuts[i+1],mid=(start+end)/2;
        const covering=edges.filter(e=>e.start<mid&&e.end>mid);
        if(!covering.length||end-start<.001)continue;
        if(axis==='h')addSegment(start,constant,end,constant,covering);
        else addSegment(constant,start,constant,end,covering);
      }
    }
    for(const d of diagonal.values())addSegment(d.x1,d.y1,d.x2,d.y2,d.sources);
    return result;
  }

  function alignmentGuides(items, excludeId=null) {
    const x=new Set(),y=new Set();
    for(const e of items) {
      if(e.id===excludeId)continue;
      if(e.type==='room'){
        x.add(e.x);x.add(e.x+e.w);y.add(e.y);y.add(e.y+e.h);
      }else if(e.type==='wall'){
        x.add(e.x1);x.add(e.x2);y.add(e.y1);y.add(e.y2);
      }
    }
    return {x:[...x].filter(Number.isFinite),y:[...y].filter(Number.isFinite)};
  }
  function closest(values,candidates,tolerance) {
    let best=null;
    for(const value of values)for(const candidate of candidates){
      const distance=Math.abs(candidate-value);
      if(distance<=tolerance&&(!best||distance<best.distance))
        best={delta:candidate-value,guide:candidate,distance};
    }
    return best;
  }
  const grid=(v,step)=>step>0?Math.round(v/step)*step:precision(v);
  function magnetPoint(point,items,tolerance,gridStep=.5,excludeId=null) {
    const guides=alignmentGuides(items,excludeId);
    const bx=closest([point.x],guides.x,tolerance),by=closest([point.y],guides.y,tolerance);
    return {x:precision(bx?point.x+bx.delta:grid(point.x,gridStep)),
      y:precision(by?point.y+by.delta:grid(point.y,gridStep)),
      guideX:bx?.guide??null,guideY:by?.guide??null};
  }
  function magnetBox(box,items,tolerance,gridStep=.5,excludeId=null) {
    const guides=alignmentGuides(items,excludeId);
    const bx=closest([box.x,box.x+box.w],guides.x,tolerance);
    const by=closest([box.y,box.y+box.h],guides.y,tolerance);
    return {x:precision(bx?box.x+bx.delta:grid(box.x,gridStep)),
      y:precision(by?box.y+by.delta:grid(box.y,gridStep)),
      guideX:bx?.guide??null,guideY:by?.guide??null};
  }
  return {collectWallSegments,alignmentGuides,magnetPoint,magnetBox};
});
