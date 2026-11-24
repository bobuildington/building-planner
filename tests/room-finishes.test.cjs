const test=require('node:test');
const assert=require('node:assert/strict');
const finishes=require('../dist/room-finishes.js');

test('floor and wallpaper galleries expose selectable patterns',()=>{
  assert.ok(Object.keys(finishes.floorPatterns).length>=7);
  assert.ok(Object.keys(finishes.wallPatterns).length>=6);
  assert.equal(finishes.validPattern('floor','herringbone'),true);
  assert.equal(finishes.validPattern('wall','botanical'),true);
  assert.equal(finishes.validPattern('wall','herringbone'),false);
});

test('finish values are validated and unsafe pattern IDs cannot reach SVG markup',()=>{
  const f=finishes.prepare({type:'floor',pattern:'<script>',base:'red',accent:'#102030'});
  assert.equal(f.pattern,'plain');
  assert.equal(f.base,'#d8c6ad');
  assert.equal(f.accent,'#102030');
  const svg=finishes.svgFloorPattern('test"><script',f);
  assert.match(svg,/id="testscript"/);
  assert.doesNotMatch(svg,/<script|test">/);
});

test('pattern colors visibly vary across coordinates and preserve chosen palette',()=>{
  const tile=finishes.prepare({type:'floor',pattern:'tile',base:'#f9e4d7',accent:'#236689'});
  const seam=finishes.sample(tile,0.01,0.01),middle=finishes.sample(tile,.8,.8);
  assert.notEqual(seam,middle);
  const stripes=finishes.prepare({type:'wall',pattern:'stripes',base:'#d1e8fa',accent:'#533399'});
  assert.notEqual(finishes.sample(stripes,.01,2),finishes.sample(stripes,.5,2));
  assert.match(finishes.previewCss(stripes),/background-color:#d1e8fa/);
  assert.match(finishes.svgFloorPattern('floor-123',tile),/fill="#f9e4d7"/);
});

test('a plain painted finish stays uniformly colored',()=>{
  const wall=finishes.prepare({type:'wall',pattern:'paint',base:'#336699',accent:'#ffffff'});
  for(const coords of [[0,0],[6.4,8.3],[-12,2]])assert.equal(finishes.sample(wall,...coords),0x336699);
});
