import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,practice,act,optionsFor,scoring,startRound,assertState,inventory,migrateGame} from '../dist/v2/game.js';
import {SHOP_CATALOG,itemById} from '../dist/v2/catalog.js';
import {domains,validHand,riichiOptions,evaluate} from '../dist/v2/rules.js';
import {actionChoices} from '../dist/v2/controls.js';
import {handView,syncHandOrder} from '../dist/v2/hand-layout.js';
const tiles=ts=>ts.map((type,i)=>({id:'fixture-'+i,type}));

test('only six current recipes and six gear appear in shops and packs',()=>{
 assert.equal(SHOP_CATALOG.filter(x=>x.kind==='recipe').length,6);
 assert.equal(SHOP_CATALOG.filter(x=>x.kind==='gear').length,6);
 for(let seed=0;seed<12;seed++){
  const s=practice('shop');s.rng+=seed;s.coins=1000;
  for(let i=0;i<8;i++){act(s,'reroll');assert.ok([...s.offers,...s.recipeOffers].every(id=>!itemById(id).retired));}
  act(s,'openPack',{id:'gearPack'});assert.ok(s.pendingPack.choices.every(id=>!itemById(id).retired));
 }
});
test('new domains retain rank or suit, adjacent does not wrap, one tile is one position',()=>{
 assert.deepEqual(domains({type:13,special:'triad'}),[4,13,22]);
 assert.deepEqual(domains({type:0,special:'adjacent'}),[0,1]);
 assert.deepEqual(domains({type:26,special:'adjacent'}),[25,26]);
 assert.deepEqual(domains({type:13,special:'adjacent'}),[12,13,14]);
 const hand=tiles([0,1,11,4,4]);assert.equal(validHand(hand,1),false);hand[2].special='triad';assert.equal(validHand(hand,1),true);assert.equal(validHand(hand.slice(1),1),false);
});
test('recipes combine a type property with utilities; duplicates spread without repeated actions',()=>{
 const s=newGame({seed:'recipe-spread'});s.recipes={patternTriad:10,patternAdjacent:10,patternDragon:10,patternSleeve:10,patternHidden:10,patternRefill:10};
 startRound(s);assert.equal(s.recipeTriggers.length,60);
 for(const t of s.floor){
  assert.ok(t.floorEffects.includes('patternSleeve'));assert.ok(t.floorEffects.includes('patternHidden'));assert.ok(t.floorEffects.includes('patternRefill'));
  if(t.floorEffects.includes('patternDragon'))assert.ok(t.type>=31);
  assert.ok(!(t.floorEffects.includes('patternTriad')&&t.floorEffects.includes('patternAdjacent')));
 }
 assertState(s);
 const plain=newGame({seed:'recipe-spread'});startRound(plain);assert.deepEqual(s.wall,plain.wall);
});
test('sleeve preserves physical inventory, manual position and menzen; restrictions enforced',()=>{
 const s=practice('effects27'),f=s.floor[1],old=s.hand[2],wall=s.wall.length,idx=2;
 syncHandOrder(s);const oldPosition=s.handOrder.indexOf(old.id);
 assert.equal(actionChoices(s,old.id,null)[0].action,'draw');
 assert.ok(actionChoices(s,old.id,f.id).some(x=>x.action==='sleeve'));
 act(s,'sleeve',{take:f.id,id:old.id});assert.equal(s.hand[idx].id,f.id);assert.equal(s.hand.length,7);assert.equal(s.floor.length,4);assert.equal(s.wall.length,wall);assert.equal(s.locked.length,0);assert.ok(s.discards.some(t=>t.id===old.id));assert.equal(s.phase,'floor');assertState(s);
 assert.equal(handView(s).body[oldPosition].id,f.id);
 assert.throws(()=>act(s,'sleeve',{take:s.floor[0].id,id:s.hand[0].id}));
 const riichi=practice('effects27');riichi.riichi=true;assert.throws(()=>act(riichi,'sleeve',{take:riichi.floor[1].id,id:riichi.hand[0].id}));
 act(s,'draw');assert.equal(s.hand.length,8);assertState(s);
});
test('hidden chi keeps menzen and riichi eligibility; normal additional call breaks it',()=>{
 const s=practice('effects27'),op=optionsFor(s).calls.find(x=>x.kind==='chi'&&x.take===s.floor[0].id);
 act(s,'call',op);assert.equal(s.locked[0].stealth,true);assert.equal(s.locked[0].open,true);
 assert.ok(riichiOptions(s.hand,2,s.locked).length>0);
 s.locked[0].stealth=false;assert.equal(riichiOptions(s.hand,2,s.locked).length,0);assertState(s);
});
test('hidden pon does not count as concealed triplet; added kan breaks stealth',()=>{
 const locked=[{kind:'triplet',t:27,types:[27,27,27],tiles:tiles([27,27,27]),open:true,stealth:true}];
 const hand=tiles([0,0,0,9,9,9,31,31]);const r=evaluate(hand,3,locked,{source:'tsumo'});
 assert.ok(r.yaku.some(y=>y.name==='멘젠쯔모'));assert.ok(!r.yaku.some(y=>y.name==='삼암각'));
 const s=practice('kakan');s.locked[0].stealth=true;act(s,'kan',optionsFor(s).kans.find(x=>x.kind==='kakan'));assert.equal(s.locked[0].stealth,false);assertState(s);
});
test('refill after chi uses exactly one real plain tile even with duplicate copies',()=>{
 const s=practice('effects27'),f=s.floor[0],w=s.wall.length,slot=f.floorSlot;f.floorEffects.push('patternRefill','patternRefill');
 act(s,'call',optionsFor(s).calls.find(x=>x.kind==='chi'&&x.take===f.id));
 assert.equal(s.floor.length,5);assert.equal(s.wall.length,w-1);const next=s.floor.find(t=>t.floorSlot===slot);assert.ok(next);assert.equal(next.floorEffects,undefined);assert.equal(next.special,undefined);assertState(s);
});
test('refill respects kan reserve and exhaustion including toll boss',()=>{
 for(const count of [3,4,5,6]){
  const s=practice('kan');s.boss={id:'toll'};s.floor[0].floorEffects=['patternRefill','patternHidden'];s.discards.push(...s.wall.splice(0,s.wall.length-count));
  act(s,'call',optionsFor(s).calls.find(x=>x.kind==='daiminkan'));
  assert.equal(s.indicators.length,2);assert.equal(s.ura.length,2);assert.equal(s.locked[0].stealth,false);assert.equal(s.floor.length,count===6?5:4);assertState(s);
 }
 const empty=practice('effects27');empty.discards.push(...empty.wall.splice(0));act(empty,'call',optionsFor(empty).calls.find(x=>x.kind==='chi'));assert.equal(empty.floor.length,4);assertState(empty);
});
test('gear distinguishes physical recipe tiles, public melds, menzen and actual yaku',()=>{
 const s=practice('ron'),f=s.floor[0],base=scoring(s,'ron',f.id);
 f.floorEffects=['patternSleeve','patternHidden'];s.equipment=['rig'];assert.equal(scoring(s,'ron',f.id).base,base.base+20);
 f.floorEffects=[];f.special='shift';assert.equal(scoring(s,'ron',f.id).base,base.base);
 const h=tiles([0,1,2,4,4]),g=[{kind:'sequence',t:9,types:[9,10,11],tiles:tiles([9,10,11]),open:true,stealth:true}];
 const a=evaluate(h,2,g,{source:'tsumo'}),b=evaluate(h,2,g,{source:'tsumo',equipment:['open','closed']});assert.equal(b.mult,(a.mult+1)*1.5);
 const multi=practice('overlap'),plain=scoring(multi);multi.equipment=['complex'];assert.equal(scoring(multi).mult,plain.mult*1.5);
 const noYaku=practice('ron');noYaku.equipment=['complex'];assert.equal(scoring(noYaku,'ron',noYaku.floor[0].id).mult,1);
});
test('focus choice is mandatory, previews do not grow, wins grow once and sale resets',()=>{
 const s=practice('shop');s.coins=100;s.offers=['focus'];act(s,'buy',{id:'focus'});assert.throws(()=>act(s,'nextRound'),/목표/);
 act(s,'chooseFocus',{target:'탕야오'});assert.throws(()=>act(s,'chooseFocus',{target:'리치'}));assert.equal(s.focus.bonus,20);
 const win=practice('overlap');win.equipment=['focus'];win.focus={target:'청일색',bonus:20};const base=scoring({...win,equipment:[]});
 assert.equal(scoring(win).base,base.base+20);scoring(win);assert.equal(win.focus.bonus,20);act(win,'tsumo');assert.equal(win.focus.bonus,30);assert.equal(win.lastResult.base,base.base+20);assert.throws(()=>act(win,'tsumo'));assert.equal(win.focus.bonus,30);
 assert.equal(JSON.parse(JSON.stringify(win)).focus.bonus,30);act(win,'continue');assert.equal(win.focus.bonus,30);
 act(s,'sell',{id:'focus'});assert.equal(s.focus,null);s.offers=['focus'];act(s,'buy',{id:'focus'});assert.deepEqual(s.focus,{target:null,bonus:20});
 const pack=practice('shop');pack.pendingPack={id:'gearPack',choices:['focus']};act(pack,'pickPack',{id:'focus'});assert.throws(()=>act(pack,'nextRound'),/목표/);
});
test('v26 save migration preserves holdings, paid pack, coins and every tile, but refreshes old shelf',()=>{
 const s=practice('shop');s.version=26;s.recipes={patternWind:4,patternMirror:3};s.equipment=['bookFlush'];s.pendingPack={id:'gearPack',choices:['collector']};s.offers=['collector','shift'];s.recipeOffers=['patternWind','patternMirror','patternDragon'];
 const before=structuredClone(s),ids=inventory(s).map(t=>t.id);migrateGame(s);
 assert.equal(s.version,27);assert.equal(s.coins,before.coins);assert.deepEqual(s.recipes,before.recipes);assert.deepEqual(s.equipment,before.equipment);assert.deepEqual(s.pendingPack,before.pendingPack);assert.deepEqual(inventory(s).map(t=>t.id),ids);assert.deepEqual(s.offers,['shift']);assert.ok(s.recipeOffers.every(id=>!itemById(id).retired));
 const once=structuredClone(s);migrateGame(s);assert.deepEqual(s,once);assertState(s);
});
