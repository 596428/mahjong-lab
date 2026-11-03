import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluate,validShape,waits,findShapes,emergencyHands,nextDora,ORPHANS,multiplier,basePoints} from '../dist/rules.js';
const parse=s=>[...s.matchAll(/([1-9]+)([mpsz])/g)].flatMap(([,ns,suit])=>[...ns].map(n=>Number(n)-1+{m:0,p:9,s:18,z:27}[suit]));
const calc=(s,win,ctx={})=>evaluate(parse(s),parse(win)[0],ctx);
const has=(r,name)=>r.yaku.some(y=>y.name===name);

test('valid complete shapes, special hands and impossible fifth copies',()=>{
  assert.ok(validShape(parse('123456789m123p11z')));
  assert.ok(validShape(parse('112233m4455p6677s')));
  assert.ok(validShape([...ORPHANS,0]));
  assert.ok(!validShape(parse('111122m3344p5566s')));
  assert.ok(!validShape(parse('11111234567899m')));
  assert.ok(!validShape(parse('123456789m123p1z')));
});
test('kokushi thirteen-way waiting does not inspect wall availability',()=>{
  assert.deepEqual(waits(ORPHANS),ORPHANS);
  assert.deepEqual(waits(parse('234m234p234s45m55p')),[2,5]);
});
test('winning tile affects pinfu; a pair finish cannot award it',()=>{
  assert.ok(has(calc('234567m234p234s55p','7m'),'핑후'));
  assert.ok(!has(calc('234567m234p234s55p','5p'),'핑후'));
  assert.ok(!has(calc('123456m234p567s55p','3m'),'핑후'));
  assert.ok(!has(calc('789456m234p567s55p','7m'),'핑후'));
});
test('a completed shape with only dora is still zero points',()=>{
  const r=calc('111234m234p123s55m','5m',{dora:3,ura:3});
  assert.equal(r.valid,true);assert.equal(r.yaku.length,0);assert.equal(r.dora,2);assert.equal(r.han,0);assert.equal(r.score,0);assert.equal(r.ura,0);
});
test('triplet finished by normal submission is not concealed; riichi tsumo is',()=>{
  const hand='222555m333p777s11z';
  const normal=calc(hand,'2m'),tsumo=calc(hand,'2m',{riichi:true,tsumo:true});
  assert.ok(has(normal,'삼암각'));assert.ok(has(normal,'또이또이'));assert.equal(normal.yakuman,0);
  assert.ok(has(tsumo,'사암각'));assert.equal(tsumo.yakuman,1);
  assert.ok(has(calc(hand,'1z'),'사암각'));
});
test('best decomposition selects ryanpeikou rather than chiitoitsu',()=>{
  const r=calc('112233m445566p77s','7s');
  assert.ok(has(r,'량페코'));assert.ok(!has(r,'칠대자'));assert.ok(!has(r,'이페코'));
});
test('yakuhai, seat and round wind stack independently',()=>{
  const r=calc('111z555z123m456p22s','2s',{seatWind:27,roundWind:27});
  assert.ok(has(r,'자풍패'));assert.ok(has(r,'장풍패'));assert.ok(has(r,'역패 · 백'));assert.equal(r.han,3);
});
test('shape yaku fixtures',()=>{
  const fixtures=[
    ['234m234p234s567m55p','5p','탕야오'],
    ['234m234p234s567m55p','5p','삼색동순'],
    ['222m222p222s456m55p','5p','삼색동각'],
    ['123456789m456p22s','2s','일기통관'],
    ['123789m123p111z99s','9s','찬타'],
    ['123789m123p111s99s','9s','준찬타'],
    ['111999m111p999s11z','9s','혼노두'],
    ['555666z77z123456m','7z','소삼원'],
    ['123456789m111z22m','2m','혼일색'],
    ['123456789m22255m','5m','청일색'],
    ['11m99m11p99p11s99s11z','1z','칠대자'],
    ['112233m456p789s55p','5p','이페코']
  ];
  for(const [hand,win,yaku]of fixtures){const r=calc(hand,win);assert.ok(r.valid,hand);assert.ok(has(r,yaku),`${yaku}: ${JSON.stringify(r.yaku)}`);}
});
test('yakuman fixtures and stacking; no ordinary han on yakuman',()=>{
  const fixtures=[
    ['19m19p19s1234567z1m','1m','국사무쌍'],
    ['555666777z123m22p','2p','대삼원'],
    ['111222333z44z123m','3m','소사희'],
    ['111222333444z55m','4z','대사희'],
    ['111222333z555z66z','5z','자일색'],
    ['111999m111p999s11s','9s','청노두'],
    ['222333444s666s88s','6s','녹일색'],
    ['11123456789999m','9m','구련보등']
  ];
  for(const [hand,win,yaku]of fixtures){const r=calc(hand,win,{riichi:true,dora:0});assert.ok(has(r,yaku),`${yaku}: ${JSON.stringify(r)}`);assert.equal(r.han,0);assert.equal(r.dora,0);assert.ok(r.score>=6400);}
});
test('riichi contextual yaku and real indicator cycles',()=>{
  const r=calc('234m234p234s456m55p','6m',{riichi:true,doubleRiichi:true,ippatsu:true,tsumo:true,lastTile:true,dora:3,ura:12});
  for(const name of ['더블리치','일발','멘젠쯔모','해저모월'])assert.ok(has(r,name));
  assert.ok(!has(r,'리치'));assert.equal(r.dora,1);assert.equal(r.ura,2);
  for(const [from,to]of [[8,0],[17,9],[26,18],[30,27],[33,31],[31,32]])assert.equal(nextDora(from),to);
});
test('subset search agrees with brute-force omission on 15-tile pools',()=>{
  let n=78321;const random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/2**32;};
  for(let k=0;k<300;k++){
    let pool=k<100?parse('123456789m123p11z'):[];
    while(pool.length<15){const t=Math.floor(random()*34);if(pool.filter(v=>v===t).length<4)pool.push(t);}
    const expected=pool.some((_,i)=>validShape(pool.filter((_,j)=>i!==j)));
    const found=findShapes(pool,1);assert.equal(found.length>0,expected);if(found.length)assert.ok(validShape(found[0]));
  }
});
test('emergency candidates are thirteen available tiles with a valid wait',()=>{
  const pool=parse('234m234p234s45m5p7z5p123z');
  const candidates=emergencyHands(pool);assert.ok(candidates.length);
  for(const candidate of candidates){assert.equal(candidate.types.length,13);assert.ok(candidate.waits.length);const rest=pool.slice();for(const t of candidate.types){const i=rest.indexOf(t);assert.ok(i>=0);rest.splice(i,1);}}
});

test('filtered subset search continues past a no-yaku shape to find a scoring shape',()=>{
  const pool=parse('234m234p123s999s55m555z');
  const first=findShapes(pool,1)[0];assert.ok(![...new Set(first)].some(t=>evaluate(first,t).yaku.length));
  const scoring=findShapes(pool,1,types=>[...new Set(types)].some(t=>evaluate(types,t).yaku.length));
  assert.equal(scoring.length,1);assert.ok(scoring[0].includes(31));
});
test('provisional score curve and reveal penalty floor',()=>{
  assert.equal(basePoints(0),0);assert.equal(basePoints(5),1600);assert.equal(basePoints(13),6400);assert.equal(basePoints(0,2),12800);
  assert.equal(multiplier(4,4),1);assert.equal(multiplier(5,4),.92);assert.equal(multiplier(16,4),.4);
  for(let exposed=4;exposed<=16;exposed++){
    const r=calc('234567m234p234s55p','5p',{multiplier:multiplier(exposed,4)});
    assert.equal(r.score,4*Math.max(40,100-(exposed-4)*8));
  }
});
