import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,practice,act,optionsFor,scoring,startRound,assertState,eligible,price,consumableCount,consumableCapacity,migrateGame} from '../dist/v2/game.js';
import {itemById} from '../dist/v2/catalog.js';
import {evaluate,domains,validHand} from '../dist/v2/rules.js';

test('empty recipes at start; a persistent five-tile stock consumes only the next own draw',()=>{
 const s=newGame({seed:'stock'});assert.deepEqual(s.recipes,{});assert.deepEqual(s.equipment,[]);assert.equal(s.floor.length,5);assert.ok(s.floor.every(t=>!t.special&&!t.floorEffects));
 const stock=structuredClone(s.floor),wall=s.wall.length;for(let i=0;i<3;i++){act(s,'discard',{id:s.drawn});assert.deepEqual(s.floor,stock);act(s,'draw');assert.deepEqual(s.floor,stock);assertState(s);}assert.equal(s.wall.length,wall-3);
});
test('hundreds of purchases keep restocking at one coin with no cap, including duplicates',()=>{
 const s=practice('shop');s.coins=301;const seen={};for(let i=0;i<300;i++){const id=s.recipeOffers[i%3];assert.equal(price(s,itemById(id)),1);act(s,'buy',{id});seen[id]=(seen[id]||0)+1;assert.equal(s.recipeOffers.length,3);assert.equal(new Set(s.recipeOffers).size,3);}
 assert.deepEqual(s.recipes,seen);assert.equal(Object.values(s.recipes).reduce((a,b)=>a+b,0),300);assert.equal(s.coins,1);assert.equal(s.equipment.length,0);
 const restored=JSON.parse(JSON.stringify(s));assert.deepEqual(restored.recipes,s.recipes);act(restored,'nextRound');assert.equal(restored.recipeTriggers.length,300);assert.equal(restored.recipeTriggers.filter(t=>t.applied).length,restored.floor.flatMap(t=>t.floorEffects||[]).length);assertState(restored);
});
test('each purchased copy applies, property copies spread and refill reapplies after agari',()=>{
 const s=practice('ron');s.recipes={patternWind:12,patternDragon:14,patternMirror:8};const old=s.floor.map(t=>t.id);act(s,'ron',{id:optionsFor(s).ron[0].tile.id});act(s,'continue');assert.ok(s.floor.every(t=>!old.includes(t.id)));assert.equal(s.floor.length,5);assert.equal(s.recipeTriggers.length,34);assert.equal(s.floor.flatMap(t=>t.floorEffects||[]).length,s.recipeTriggers.filter(x=>x.applied).length);assert.ok(s.floor.some(t=>t.floorEffects.length>1));assert.equal(s.riichi,false);assertState(s);
 const f=structuredClone(s.floor),w=s.wall.length;act(s,'discard',{id:s.drawn});act(s,'draw');assert.deepEqual(s.floor,f);assert.equal(s.wall.length,w-1);
});
test('claiming one stock tile leaves its slot empty until win',()=>{
 const s=practice('ron'),op=optionsFor(s).calls.find(x=>x.kind==='chi'),taken=s.floor.find(t=>t.id===op.take);taken.floorEffects=['patternMirror','patternMirror'];const slot=taken.floorSlot;
 act(s,'call',op);assert.equal(s.floor.length,4);assert.ok(!s.floor.some(t=>t.floorSlot===slot));assert.deepEqual(s.locked[0].tiles.find(t=>t.id===taken.id).floorEffects,['patternMirror','patternMirror']);act(s,'discard',{id:s.hand[0].id});assert.equal(s.floor.length,4);assertState(s);
});
test('property recipes never award flat base or multiplier bonuses, including duplicates',()=>{
 const s=practice('ron'),id=s.floor[0].id,plain=scoring(s,'ron',id);s.floor[0].special='mirror';s.floor[0].floorEffects=Array(20).fill('patternMirror');const r=scoring(s,'ron',id);assert.equal(r.base,plain.base);assert.equal(r.mult,plain.mult);assert.equal(r.manual,0);assert.equal(r.rig,1);assert.equal(r.score,70);
 s.equipment=['rig'];assert.equal(scoring(s,'ron',id).base,90); // Only the separately equipped score gear grants points.
 const t={id:'t',type:27,special:'wind',floorEffects:Array(10).fill('patternWind')};const hand=[{type:0},{type:1},{type:2},{type:27},t];const wild=evaluate(hand,1,[],{source:'ron'}),normal=evaluate(hand.map(x=>x===t?{type:27}:x),1,[],{source:'ron'});assert.equal(wild.score,normal.score);
});

test('new domains complete genuinely new hands, without using a physical tile twice',()=>{
 assert.deepEqual(domains({type:6,special:'mirror'}),[6,2]);assert.deepEqual(domains({type:8,special:'neighbor'}),[8,0]);assert.deepEqual(domains({type:0,special:'dragon'}),[31,32,33]);
 for(const [type,special,others] of [[6,'mirror',[0,1,4,4]],[2,'neighbor',[1,2,4,4]],[0,'dragon',[0,1,2,31]]]){const plain=[...others.map(type=>({type})),{type}];assert.equal(validHand(plain,1),false);plain.at(-1).special=special;assert.equal(validHand(plain,1),true);assert.equal(validHand(plain.slice(1),1),false);}
 const s=practice('recipes'),r=optionsFor(s).ron.find(x=>x.tile.id===s.floor[0].id);assert.ok(r);const plain=structuredClone(s);delete plain.floor[0].special;assert.equal(scoring(plain,'ron',plain.floor[0].id).valid,false);act(s,'ron',{id:r.tile.id});assert.equal(s.lastResult.score,70);assert.ok(s.lastResult.layout.groups.flatMap(g=>g.tiles).some(t=>t.special==='mirror'&&t.resolvedAs===2));assertState(s);
});

test('ambiguous chi assignments resolve before locking and remain fixed',()=>{
 const s=practice('ron');const a=s.hand.find(t=>t.type===1),b=s.hand.find(t=>t.type===2);a.special='neighbor';a.floorEffects=['patternNeighbor'];b.type=1;
 const op=optionsFor(s).calls.find(x=>x.kind==='chi'&&x.take===s.floor[0].id&&x.ids.includes(a.id)&&x.ids.includes(b.id));assert.ok(op);act(s,'call',op);assert.equal(s.locked[0].tiles.find(t=>t.id===a.id).lockedAs,2);assert.deepEqual(domains(s.locked[0].tiles.find(t=>t.id===a.id)),[2]);assertState(s);
});

test('v25 migration refunds removed recipes exactly once, keeps run and fixes shelves',()=>{
 const s=practice('shop');s.version=25;s.recipes={patternWind:2,patternGold:3,patternEcho:4,patternRisk:1,patternSeal:2};s.recipeOffers=['patternGold','patternWind','patternSeal'];const before=s.coins,record=structuredClone(s.records),wall=s.wall.map(t=>t.id);migrateGame(s);assert.equal(s.version,27);assert.equal(s.coins,before+10);assert.deepEqual(s.recipes,{patternWind:2});assert.ok(s.recipeOffers.every(id=>itemById(id)?.kind==='recipe'));assert.equal(s.recipeOffers.length,3);assert.deepEqual(s.wall.map(t=>t.id),wall);assert.deepEqual(s.records,record);migrateGame(s);assert.equal(s.coins,before+10);assertState(s);
});

test('consumables target hand or stock and capacity follows shared equipment',()=>{
 const s=practice('ron'),floor=s.floor[1],id=floor.id,slot=floor.floorSlot;act(s,'tool',{tool:'shift',id,area:'floor'});assert.equal(floor.special,'shift');assert.equal(s.tools.shift,undefined);assertState(s);
 s.tools={exchange:{left:1}};floor.floorEffects=['patternMirror'];const w=s.wall.length;act(s,'tool',{tool:'exchange',id,area:'floor'});assert.ok(!s.floor.some(t=>t.id===id));assert.equal(s.floor.find(t=>t.floorSlot===slot).floorEffects,undefined);assert.equal(s.wall.length,w-1);assert.equal(consumableCount(s),0);assertState(s);
 s.tools={wind:{left:2}};assert.equal(eligible(s,itemById('dual')),false);s.equipment=['pocket'];assert.equal(consumableCapacity(s),3);assert.equal(eligible(s,itemById('dual')),true);
});
test('wide shelf uses real extra tile and no recipe random roll changes wall order',()=>{
 const a=newGame({seed:'samewall'}),b=newGame({seed:'samewall'});a.recipes={patternDragon:20,patternWind:8,patternDual:8};startRound(a);startRound(b);assert.deepEqual(a.wall,b.wall);assert.equal(a.recipeTriggers.length,36);assertState(a);
 const wide=newGame({seed:'wide'});wide.equipment=['wideFloor'];startRound(wide);assert.equal(wide.floor.length,6);assert.equal(wide.floorSlots,6);assertState(wide);
});
test('insufficient wall for a full new stock ends without dropping physical tiles',()=>{
 const s=practice('ron');act(s,'ron',{id:s.floor[0].id});s.discards.push(...s.wall.splice(0,s.wall.length-12));act(s,'continue');assert.equal(s.phase,'failed');assertState(s);
});

