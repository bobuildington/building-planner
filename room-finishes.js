/* Reusable, offline room finishes. All patterns are procedural and store only
 * small style choices, not image files. Used by the editor and 3D renderer. */
((root,factory)=>{
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.HouseRoomFinishes=api;
})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const floorPatterns={plain:'Smooth finish',planks:'Straight wood planks',herringbone:'Herringbone wood',tile:'Ceramic tiles',stone:'Natural stone',carpet:'Soft carpet',terrazzo:'Terrazzo',checker:'Checkerboard'};
  const wallPatterns={paint:'Solid paint',stripes:'Striped wallpaper',diamond:'Geometric diamonds',brick:'Brickwork',panel:'Decorative panels',botanical:'Botanical leaves',dots:'Polka dots'};
  const hex=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(value||'')?value:fallback;
  const validPattern=(type,name)=>Object.hasOwn(type==='wall'?wallPatterns:floorPatterns,name);
  const fract=n=>n-Math.floor(n);
  function prepare(spec){
    const type=spec?.type==='wall'?'wall':'floor';
    const pattern=validPattern(type,spec?.pattern)?spec.pattern:type==='wall'?'paint':'plain';
    const base=hex(spec?.base,type==='wall'?'#dfe7dc':'#d8c6ad');
    const accent=hex(spec?.accent,type==='wall'?'#779886':'#95745e');
    const rgb=s=>[1,3,5].map(k=>parseInt(s.slice(k,k+2),16));
    return {type,pattern,base,accent,rgb:rgb(base),detail:rgb(accent)};
  }
  // Packed RGB avoids allocating an array for every shaded walkthrough pixel.
  function sample(finish,u,v){
    const f=finish.rgb?finish:prepare(finish);
    const U=Math.abs(u),V=Math.abs(v),frac=fract;
    let ink=0,light=1;
    switch(f.pattern){
      case 'planks':{
        const row=Math.floor(V/.78),seam=frac(V/.78),joint=frac(U/4+row*.37);
        ink=seam<.035||joint<.015?.42:0;light=1+((row%3)-1)*.035;
        break;
      }
      case 'herringbone':{
        const a=frac((U+V)*.58),b=frac((U-V)*.58);
        ink=(a<.045||b<.045)?.52:0;light=frac(U*.63+V*.23)>.5?1:.965;
        break;
      }
      case 'tile':{
        const a=frac(U/1.7),b=frac(V/1.7);ink=a<.025||b<.025?.65:0;
        light=(Math.floor(U/1.7)+Math.floor(V/1.7))%2?.98:1.025;break;
      }
      case 'stone':{
        const row=Math.floor(V/2.3),a=frac(U/3.1+row*.5),b=frac(V/2.3);
        ink=a<.018||b<.018?.42:0;light=(row+Math.floor(U/3.1))%3===0?.96:1.015;break;
      }
      case 'carpet':{
        const noise=((Math.floor(U*18)*73)^(Math.floor(V*18)*97))&15;
        light=.95+noise*.006;break;
      }
      case 'terrazzo':{
        const du=frac(U*1.9),dv=frac(V*1.9);
        ink=(du>.12&&du<.36&&dv>.53&&dv<.72)||(du>.7&&du<.87&&dv>.13&&dv<.3)?.55:0;
        light=.995;break;
      }
      case 'checker':ink=(Math.floor(U/1.55)+Math.floor(V/1.55))%2?.52:0;break;
      case 'stripes':{const phase=frac(U/1.15);ink=phase<.24?.45:phase<.265?.65:0;break}
      case 'diamond':{const a=frac((U+V)*.39),b=frac((U-V)*.39);ink=(a<.035||b<.035)?.46:0;break}
      case 'brick':{
        const row=Math.floor(V/.68),a=frac(U/2.1+(row%2)*.5),b=frac(V/.68);
        ink=a<.025||b<.06?.48:0;light=row%3===0?.98:1;break;
      }
      case 'panel':{
        const a=frac(U/3.1);ink=(V<2.9&&V>2.79)||a<.028||a>.972?.48:0;
        if(V<2.8&&a>.06&&a<.94)light=1.035;break;
      }
      case 'botanical':{
        const a=frac(U/1.6)-.5,b=frac(V/1.65)-.5;
        const leaf1=((a+.17)/.25)**2+((b+.06)/.12)**2;
        const leaf2=((a-.18)/.22)**2+((b-.15)/.13)**2;
        ink=leaf1<1||leaf2<1?.46:Math.abs(a)<.015&&b>-.35&&b<.34?.32:0;break;
      }
      case 'dots':{
        const a=frac(U/1.1)-.5,b=frac(V/1.1)-.5;ink=a*a+b*b<.027?.46:0;break;
      }
    }
    const b=f.rgb,a=f.detail,t=Math.max(0,Math.min(1,ink));
    const c=i=>Math.max(0,Math.min(255,Math.round((b[i]*(1-t)+a[i]*t)*light)));
    return (c(0)<<16)|(c(1)<<8)|c(2);
  }
  function svgFloorPattern(id,spec){
    const f=prepare({...spec,type:'floor'}),base=f.base,accent=f.accent;
    const line=`stroke="${accent}" stroke-opacity=".43" stroke-width=".07" fill="none"`;
    let size=2,pattern='';
    switch(f.pattern){
      case 'planks':size=3.2;pattern=`<path d="M0 .8H3.2 M0 1.6H3.2 M0 2.4H3.2 M1.5 0V.8 M2.5 .8V1.6 M.7 1.6V2.4 M2 2.4V3.2" ${line}/>`;break;
      case 'herringbone':size=3;pattern=`<path d="M0 0L3 3 M-1 1L2 4 M1 -1L4 2 M0 3L3 0 M-1 2L2 -1 M1 4L4 1" ${line}/>`;break;
      case 'tile':size=1.7;pattern=`<rect x=".04" y=".04" width="1.62" height="1.62" stroke="${accent}" stroke-opacity=".55" stroke-width=".08" fill="none"/>`;break;
      case 'stone':size=3;pattern=`<path d="M0 0H3 M0 1.6H3 M.9 0V1.6 M2 1.6V3" ${line}/>`;break;
      case 'carpet':size=1;pattern=`<circle cx=".2" cy=".3" r=".04" fill="${accent}" fill-opacity=".22"/><circle cx=".7" cy=".8" r=".05" fill="${accent}" fill-opacity=".2"/>`;break;
      case 'terrazzo':size=2;pattern=`<path d="M.2 .5l.35 .05-.15 .27zM1.4 1.2l.35 .3-.4 .17zM.9 1.65l.27-.04-.1 .2z" fill="${accent}" fill-opacity=".43"/>`;break;
      case 'checker':size=3;pattern=`<rect width="1.5" height="1.5" fill="${accent}" fill-opacity=".48"/><rect x="1.5" y="1.5" width="1.5" height="1.5" fill="${accent}" fill-opacity=".48"/>`;break;
    }
    const cleanId=String(id).replace(/[^a-z0-9_-]/gi,'').slice(0,90);
    return `<pattern id="${cleanId}" patternUnits="userSpaceOnUse" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="${base}"/>${pattern}</pattern>`;
  }
  function previewCss(spec){
    const f=prepare(spec),accent=f.accent;
    const gradients={
      planks:`repeating-linear-gradient(0deg,transparent 0px,transparent 15px,${accent}66 16px,transparent 17px)`,
      herringbone:`repeating-linear-gradient(45deg,transparent 0px,transparent 12px,${accent}66 13px,transparent 15px),repeating-linear-gradient(-45deg,transparent 0px,transparent 12px,${accent}66 13px,transparent 15px)`,
      tile:`repeating-linear-gradient(0deg,transparent 0px,transparent 22px,${accent}66 23px,transparent 24px),repeating-linear-gradient(90deg,transparent 0px,transparent 22px,${accent}66 23px,transparent 24px)`,
      stone:`repeating-linear-gradient(0deg,transparent 0px,transparent 30px,${accent}55 31px,transparent 32px),repeating-linear-gradient(90deg,transparent 0px,transparent 48px,${accent}55 49px,transparent 50px)`,
      carpet:`radial-gradient(${accent}44 1px,transparent 1px)`,
      terrazzo:`radial-gradient(${accent}99 3px,transparent 4px)`,
      checker:`conic-gradient(${accent}88 25%,transparent 0 50%,${accent}88 0 75%,transparent 0)`,
      stripes:`repeating-linear-gradient(90deg,transparent 0px,transparent 12px,${accent}77 13px,${accent}77 22px,transparent 23px)`,
      diamond:`repeating-linear-gradient(45deg,transparent 0px,transparent 20px,${accent}77 21px,transparent 23px),repeating-linear-gradient(-45deg,transparent 0px,transparent 20px,${accent}77 21px,transparent 23px)`,
      brick:`repeating-linear-gradient(0deg,transparent 0px,transparent 19px,${accent}77 20px,transparent 22px),repeating-linear-gradient(90deg,transparent 0px,transparent 37px,${accent}77 38px,transparent 40px)`,
      panel:`repeating-linear-gradient(90deg,transparent 0px,transparent 48px,${accent}88 50px,transparent 52px)`,
      botanical:`radial-gradient(ellipse at 25% 35%,${accent}77 0 7px,transparent 9px),radial-gradient(ellipse at 70% 70%,${accent}77 0 6px,transparent 8px)`,
      dots:`radial-gradient(${accent}88 3px,transparent 4px)`
    };
    const sizes={carpet:'9px 9px',terrazzo:'34px 31px',checker:'36px 36px',botanical:'40px 36px',dots:'25px 25px'};
    return `background-color:${f.base};background-image:${gradients[f.pattern]||'none'};background-size:${sizes[f.pattern]||'auto'};`;
  }
  return {floorPatterns,wallPatterns,hex,validPattern,prepare,sample,svgFloorPattern,previewCss};
});
