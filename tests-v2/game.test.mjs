import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,practice,act,optionsFor,assertState,inventory,scoring,startRound,CATALOG,price} from '../dist/v2/game.js';
import {evaluate,validHand,waits,callOptions,nextDora} from '../dist/v2/rules.js';
const tiles=ts=>ts.map((type,i)=>({id:'x'+i,type}));
test('same seed reproduces tiles and hidden exclusions; all 136 physical tiles conserved',()=>{
 const a=newGame({seed:'repeat'}),b=newGame({seed:'repeat'});assert.deepEqual(a.wall,b.wall);assert.deepEqual(a.excluded,b.excluded);assert.equal(a.excluded.length,6);assert.equal(a.indicators.length,1);assertState(a);
});
test('chapters have 8/11/14 tiles on draw and one fewer after discard',()=>{
 for(let c=1;c<=3;c++){const s=newGame({seed:'chapter'+c});s.chapter=c;startRound(s);assert.equal(s.hand.length,3*(c+1)+2);act(s,'discard',{id:s.hand[0].id});assert.equal(s.hand.length,3*(c+1)+1);assert.equal(s.floor.length,5);assertState(s);act(s,'draw');assert.equal(s.hand.length,3*(c+1)+2);assertState(s);}
});
test('ron consumes hand, floor and melds; new hand keeps wall and indicators',()=>{
 const s=practice('ron'),indicator=s.indicators[0].id,ura=s.ura[0].id,remaining=s.wall.length;const ron=optionsFor(s).ron[0];assert.ok(ron);act(s,'ron',{id:ron.tile.id});assert.equal(s.phase,'result');assert.equal(s.hand.length,0);assert.equal(s.floor.length,0);assert.equal(s.locked.length,0);assertState(s);act(s,'continue');assert.equal(s.indicators[0].id,indicator);assert.equal(s.ura[0].id,ura);assert.equal(s.wall.length,remaining-13);assert.equal(s.riichi,false);assertState(s);
});
test('chi locks one group, breaks menzen; discard after chi proceeds straight to own draw',()=>{
 const s=practice('ron'),op=optionsFor(s).calls.find(x=>x.kind==='chi');assert.ok(op);act(s,'call',op);assert.equal(s.phase,'callDiscard');assert.equal(s.locked.length,1);assert.equal(s.locked[0].open,true);assert.equal(s.hand.length,5);assertState(s);const oldTurn=s.turn,w=s.wall.length;act(s,'discard',{id:s.hand[0].id});assert.equal(s.phase,'action');assert.equal(s.turn,oldTurn+1);assert.equal(s.wall.length,w-1);assert.equal(s.floor.length,4);assertState(s);
});
test('pon then discard still gets next draw',()=>{const s=practice('kan');const op=optionsFor(s).calls.find(x=>x.kind==='pon');act(s,'call',op);assertState(s);act(s,'discard',{id:s.hand[0].id});assert.equal(s.phase,'action');assert.equal(s.locked[0].kind,'triplet');assertState(s);});
for(const name of ['kan','ankan','kakan'])test(`${name}: physical fourth tile, two extra indicators, replacement draw`,()=>{
 const s=practice(name),w=s.wall.length;if(name==='kan')act(s,'call',optionsFor(s).calls.find(x=>x.kind==='daiminkan'));else act(s,'kan',optionsFor(s).kans.find(x=>x.kind===name));
 assert.equal(s.phase,'action');assert.equal(s.locked[0].kind,'kan');assert.equal(s.locked[0].tiles.length,4);assert.equal(s.indicators.length,2);assert.equal(s.ura.length,2);assert.equal(s.wall.length,w-3);assert.equal(s.hand.length,5);assert.equal(s.locked[0].open,name!=='ankan');assertState(s);
});
test('riichi locks discards, scores first draw ippatsu, reveals ura and persists after agari',()=>{
 const s=practice('riichi');const east=s.hand.find(x=>x.type===27);assert.ok(optionsFor(s).riichi.some(x=>x.id===east.id));act(s,'riichi',{id:east.id});assert.equal(s.phase,'floor');assert.equal(s.riichi,true);assert.equal(optionsFor(s).calls.length,0);act(s,'draw');assert.equal(s.riichiDraws,1);assert.ok(optionsFor(s).tsumo.valid);assert.throws(()=>act(s,'discard',{id:s.hand.find(x=>x.id!==s.drawn).id}),/새로/);act(s,'tsumo');assert.ok(s.lastResult.yaku.some(x=>x.name.startsWith('일발')));assert.equal(s.uraKnown,s.ura.length);assert.equal(s.riichi,false);const known=s.uraKnown;act(s,'continue');assert.equal(s.uraKnown,known);assertState(s);
});
test('unrevealed ura does not leak into preview; actual riichi score includes it',()=>{
 const s=practice('overlap');s.riichi=true;s.ura=[{id:'fixture',type:0}];s.uraKnown=0;const preview=scoring(s,'tsumo',null,true),actual=scoring(s);assert.equal(preview.ura,0);assert.equal(actual.ura,2);assert.ok(actual.score>preview.score);s.uraKnown=1;assert.equal(scoring(s,'tsumo',null,true).ura,2);s.riichi=false;assert.equal(scoring(s).ura,0);
});
test('four-draw ippatsu boundary and interrupted flag',()=>{
 const h=tiles([1,2,3,4,4]);const a=evaluate(h,1,[],{riichi:true,ippatsu:true,source:'tsumo'});assert.ok(a.yaku.some(x=>x.name.startsWith('일발')));
 const s=practice('overlap');s.riichi=true;s.riichiDraws=4;assert.ok(scoring(s).yaku.some(x=>x.name.startsWith('일발')));s.riichiDraws=5;assert.ok(!scoring(s).yaku.some(x=>x.name.startsWith('일발')));s.riichiDraws=1;s.ippatsuBroken=true;assert.ok(!scoring(s).yaku.some(x=>x.name.startsWith('일발')));
});
test('multiple interpretation scoring unions chiitoitsu and normal form, once per name',()=>{
 const s=practice('overlap'),r=scoring(s);assert.equal(r.valid,true);assert.ok(r.yaku.some(y=>y.name==='치또이츠'));assert.ok(r.yaku.some(y=>y.name==='량페코'));assert.equal(new Set(r.yaku.map(x=>x.name)).size,r.yaku.length);assert.equal(r.shapes.length,2);
});
test('wind and dual suit effects complete otherwise invalid shapes, then add multiplier',()=>{
 const wind=tiles([1,2,3,27,28]);assert.equal(validHand(wind,1),false);wind[3].special='wind';assert.equal(validHand(wind,1),true);assert.equal(evaluate(wind,1).rig,1);
 const dual=tiles([0,1,20,4,4]);assert.equal(validHand(dual,1),false);dual[2].special='dual';assert.equal(validHand(dual,1),true);assert.ok(evaluate(dual,1).yaku.some(x=>x.name==='청일색'));
});
test('one physical multi-attribute tile cannot fill two positions in one shape',()=>{
 const h=tiles([1,2,3,27]);h[3].special='wind';assert.equal(validHand(h,1),false);
});
test('known waits do not reveal availability, and fixed group counts toward chapter',()=>{
 assert.ok(waits(tiles([1,2,4,4]),1).includes(3));const locked=[{kind:'sequence',t:1,types:[1,2,3],tiles:tiles([1,2,3]),open:true}];assert.equal(validHand(tiles([4,4]),1,locked),true);assert.equal(evaluate(tiles([4,4]),1,locked,{source:'tsumo'}).yaku.some(x=>x.name==='멘젠쯔모'),false);
});
test('no furiten: a previously discarded winning type does not forbid ron',()=>{const s=practice('ron');const id=s.wall.findIndex(x=>x.type===3);s.discards.push(...s.wall.splice(id,1));assert.ok(optionsFor(s).ron.some(x=>x.tile.type===3));assertState(s);});
test('red dora is opt-in with exactly one red five per suit',()=>{const a=newGame({seed:'red',red:true});assert.equal(inventory(a).filter(x=>x.red).length,3);const b=newGame({seed:'red',red:false});assert.equal(inventory(b).filter(x=>x.red).length,0);assert.equal(nextDora(8),0);assert.equal(nextDora(30),27);assert.equal(nextDora(33),31);});
test('consumables disappear on use and do not recharge next round',()=>{
 const s=practice('ron'),x=s.hand[0];act(s,'tool',{tool:'shift',id:x.id});assert.equal(s.tools.shift,undefined);assert.equal(x.special,'shift');assert.throws(()=>act(s,'tool',{tool:'shift',id:x.id}),/소모품/);startRound(s);assert.equal(s.tools.shift,undefined);assert.equal(s.tools.wind.left,1);assertState(s);
});
test('shop purchase, reroll cost, round progression and final victory',()=>{
 const s=practice('ron');s.target=1;act(s,'ron',{id:optionsFor(s).ron[0].tile.id});act(s,'continue');assert.equal(s.phase,'shop');s.coins=100;s.tools={};s.offers=['closed','dual'];act(s,'buy',{id:'closed'});assert.ok(s.equipment.includes('closed'));act(s,'buy',{id:'dual'});assert.ok(s.tools.dual);const before=s.coins;act(s,'reroll');assert.equal(s.coins,before-2);act(s,'nextRound');assert.equal(s.round,2);assert.equal(s.isBoss,true);assert.equal(s.tools.dual.left,1);assertState(s);
 const f=practice('overlap');f.chapter=3;f.round=2;f.isBoss=true;f.target=1;act(f,'tsumo');act(f,'continue');assert.equal(f.phase,'won');assertState(f);
});
test('ordinary, call and kan transitions preserve every physical tile across random play',()=>{
 for(let seed=0;seed<12;seed++){
  const s=newGame({seed:'smoke'+seed});s.chapter=seed%3+1;startRound(s);
  for(let steps=0;steps<400&&!['failed','won','shop'].includes(s.phase);steps++){
   assertState(s);const o=optionsFor(s);
   if(s.phase==='result'){act(s,'continue');continue;}
   if(s.phase==='action'){if(o.tsumo?.valid)act(s,'tsumo');else if(o.kans.length)act(s,'kan',o.kans[0]);else act(s,'discard',{id:s.hand[(steps*7)%s.hand.length].id});}
   else if(s.phase==='callDiscard')act(s,'discard',{id:s.hand[0].id});
   else if(s.phase==='floor'){if(o.ron.length)act(s,'ron',{id:o.ron[0].tile.id});else if(o.calls.length&&steps%3!==0)act(s,'call',o.calls[0]);else act(s,'draw');}
  }assertState(s);assert.ok(['failed','shop'].includes(s.phase));
 }
});

// v2.1 changes: actual progression, contextual actions, automatic riichi and shop partitions.
import {riichiAction,riichiDelay,rerollCost,eligible,meldCount} from '../dist/v2/game.js';
import {actionChoices} from '../dist/v2/controls.js';
import {BOSSES,bossFor,ROUND_TARGETS,roundTarget} from '../dist/v2/game.js';

test('three reproducible shuffled bosses, fixed two rounds, and independent wall randomness',()=>{
 const orders=new Set();for(let i=0;i<30;i++){const a=newGame({seed:'boss'+i,roundsPerChapter:4}),b=newGame({seed:'boss'+i});assert.equal(a.config.roundsPerChapter,2);assert.deepEqual(a.bossOrder,b.bossOrder);assert.equal(new Set(a.bossOrder).size,3);assert.deepEqual(a.wall,b.wall);orders.add(a.bossOrder.join(','));for(let c=1;c<=3;c++){a.chapter=c;a.round=2;startRound(a);assert.equal(a.boss.id,a.bossOrder[c-1]);assertState(a);}}
 assert.ok(orders.size>=4);
 const legacy=newGame({seed:'legacy'}),expected=legacy.bossOrder;delete legacy.bossOrder;assert.deepEqual([1,2,3].map(c=>bossFor(legacy,c).id),expected);
});
test('target curve grows across stages even with heavy boss compensation',()=>{
 assert.deepEqual(ROUND_TARGETS,[[280,380],[500,620],[750,900]]);
 for(let c=1;c<=3;c++){assert.equal(roundTarget(c,1),ROUND_TARGETS[c-1][0]);for(const b of BOSSES){const goal=roundTarget(c,2,b);assert.ok(goal>roundTarget(c,1));if(c<3)assert.ok(goal<roundTarget(c+1,1));if(b.id==='heavy')assert.equal(goal,Math.round(ROUND_TARGETS[c-1][1]*.9));}}
});
test('narrow boss removes one real stock tile per hand, not per draw',()=>{
 const s=newGame({seed:'blocked-floor'});s.round=2;s.bossOrder[0]='narrow';startRound(s);assert.equal(s.floor.length,4);assert.ok(s.blockedFloor);assert.ok(s.discards.some(t=>t.id===s.blockedFloor.id));const wall=s.wall.length,floor=s.floor.map(t=>t.id),blocked=s.blockedFloor.id;act(s,'discard',{id:s.drawn});assert.equal(s.wall.length,wall);act(s,'draw');assert.equal(s.wall.length,wall-1);assert.deepEqual(s.floor.map(t=>t.id),floor);assert.equal(s.blockedFloor.id,blocked);assertState(s);
});
test('all practice scenarios preserve physical tile inventory',()=>{
 for(const name of ['boss-narrow','boss-toll','boss-heavy','recipes','shop','riichi','chase','ron','kan','ankan','kakan','overlap'])assertState(practice(name));
});
test('single action control retains win, riichi and plain discard alternatives',()=>{
 const s=practice('riichi'),east=s.hand.find(t=>t.type===27).id;
 const choices=actionChoices(s,east,null);assert.equal(choices[0].action,'riichi');assert.ok(choices.some(x=>x.action==='discard'));
 act(s,'riichi',{id:east});assert.deepEqual(actionChoices(s,east,null),[]);
 const r=practice('ron'),f=optionsFor(r).ron[0].tile.id;assert.equal(actionChoices(r,r.hand[0].id,f)[0].action,'ron');assert.ok(actionChoices(r,r.hand[0].id,f).some(x=>x.action==='call'));assert.ok(actionChoices(r,r.hand[0].id,f).some(x=>x.action==='draw'));
});
test('automatic riichi reaches agari with accelerated misses and a physical consumption trail',()=>{
 const s=practice('chase'),w=s.wall.length;act(s,'riichi',{id:s.hand.find(x=>x.type===27).id});const initialDelay=riichiDelay(s);let steps=0;
 while(s.riichi&&steps++<100){const next=riichiAction(s);assert.ok(next);act(s,next.action,next.payload);assertState(s);}
 assert.equal(s.phase,'result');assert.ok(steps<100);assert.equal(riichiAction(s),null);assert.equal(s.lastResult.chase.consumed,w-s.wall.length);assert.equal(s.lastResult.chase.misses,6);assert.equal(s.lastResult.chase.events.reduce((n,e)=>n+e.tiles.length,0),s.lastResult.chase.consumed);assert.ok(riichiDelay(s)<initialDelay);assert.ok(riichiDelay(s)>=180);
 const kinds=s.lastResult.chase.events.map(x=>x.kind);assert.ok(!kinds.includes('floor'));assert.ok(kinds.includes('tsumogiri'));
 assert.equal(s.lastResult.chase.events.filter(x=>x.kind==='tsumogiri').length,6);
 assert.ok(!s.lastResult.yaku.some(x=>x.name.startsWith('일발')));
});
test('riichi cannot ron from known stock and stops cleanly at exhaustion',()=>{
 const s=practice('ron');s.riichi=true;s.riichiDraws=0;s.riichiRun={startWall:s.wall.length,misses:0,events:[]};assert.equal(riichiAction(s).action,'draw');assert.equal(optionsFor(s).ron.length,0);assert.throws(()=>act(s,'ron',{id:s.floor[0].id}),/완성형/);
 const e=practice('riichi');act(e,'riichi',{id:e.hand.find(x=>x.type===27).id});e.discards.push(...e.wall);e.wall=[];const a=riichiAction(e);assert.equal(a.action,'draw');act(e,a.action,a.payload);assert.equal(e.phase,'failed');assert.equal(riichiAction(e),null);assertState(e);
});
function testShop(){const s=practice('ron');s.practice=null;s.target=1;act(s,'ron',{id:optionsFor(s).ron[0].tile.id});act(s,'continue');s.coins=100;return s;}
test('shop has three refillable recipes, equipment/consumables and fixed packs',()=>{
 const s=testShop();assert.equal(s.offers.length,3);assert.equal(s.packOffers.length,2);assert.equal(s.recipeOffers.length,3);const recipes=s.recipeOffers.slice(),packs=s.packOffers.slice(),cost=rerollCost(s);act(s,'reroll');assert.equal(s.coins,100-cost);assert.equal(rerollCost(s),cost+1);assert.deepEqual(s.recipeOffers,recipes);assert.deepEqual(s.packOffers,packs);
 act(s,'nextRound');assert.equal(s.chapter,1);assert.equal(meldCount(s),2);s.phase='result';s.score=s.target;act(s,'continue');assert.equal(s.rerolls,0);
});
test('packs charge once, block next round, grant one chosen item and support skip',()=>{
 const s=testShop();s.tools={};s.packOffers=['toolPack','gearPack'];const before=s.coins;act(s,'openPack',{id:'toolPack'});assert.equal(s.coins,before-3);assert.equal(s.pendingPack.choices.length,3);assert.throws(()=>act(s,'nextRound'),/정비/);assert.throws(()=>act(s,'buy',{id:s.offers[0]}),/품목/);
 const id=s.pendingPack.choices[0];act(s,'pickPack',{id});assert.equal(s.tools[id].left,1);assert.equal(Object.keys(s.tools).length,1);assert.equal(s.coins,before-3);assert.equal(s.pendingPack,null);assert.ok(!s.packOffers.includes('toolPack'));
 act(s,'openPack',{id:'gearPack'});const money=s.coins;act(s,'skipPack');assert.equal(s.pendingPack,null);assert.equal(s.coins,money);assert.equal(s.equipment.length,0);
});
test('book equipment applies only on matching yaku; collector, dora lens and patience affect score',()=>{
 const s=practice('overlap'),base=scoring(s);s.equipment=['bookFlush','bookPairs'];const trained=scoring(s);assert.equal(trained.base,base.base+20);assert.equal(trained.mult,base.mult+2);
 s.equipment=['bookRiichi'];assert.equal(scoring(s).base,base.base);s.equipment=['collector'];assert.equal(scoring(s).mult,base.mult+Math.min(6,base.yaku.length));
 s.equipment=['patience'];s.riichi=true;s.riichiDraws=6;s.riichiRun={misses:6};const boosted=scoring(s);s.equipment=[];assert.equal(boosted.mult,scoring(s).mult*2);
 s.equipment=['doraLens'];s.indicators=[{type:0}];const d=scoring(s);s.equipment=[];assert.equal(d.base,scoring(s).base+30);
});
test('rule and score gear share five slots; equipment removal restores space',()=>{
 const s=testShop();s.offers=['bookSimple','discount','rerollPass','closed','wideFloor'];for(const id of s.offers.slice())act(s,'buy',{id});assert.equal(s.equipment.length,5);assert.equal(price(s,CATALOG.find(x=>x.id==='gearPack')),5);assert.equal(rerollCost(s),1);assert.equal(eligible(s,CATALOG.find(x=>x.id==='gearPack')),false);assert.equal(eligible(s,CATALOG.find(x=>x.id==='pocket')),false);assert.equal(eligible(s,CATALOG.find(x=>x.id==='patternMirror')),true);s.offers=['pocket'];assert.throws(()=>act(s,'buy',{id:'pocket'}),/한도/);act(s,'sell',{id:'closed'});act(s,'buy',{id:'pocket'});assert.equal(s.equipment.length,5);
 const p=practice('ron');p.equipment=['purse'];const money=p.coins;act(p,'ron',{id:optionsFor(p).ron[0].tile.id});assert.equal(p.coins,money+2);
});

import {sellValue} from '../dist/v2/game.js';
test('unselected floor always offers only skip, even when ron and chi are available',()=>{
 const s=practice('ron');assert.ok(optionsFor(s).ron.length);assert.ok(optionsFor(s).calls.length);
 const actions=actionChoices(s,s.hand[0].id,null);assert.deepEqual(actions.map(x=>x.action),['draw']);
 const picked=actionChoices(s,s.hand[0].id,s.floor[0].id);assert.equal(picked[0].action,'ron');
});
test('correct open form without any yaku scores the basic points',()=>{
 const s=practice('ron'),r=scoring(s,'ron',s.floor[0].id);assert.equal(r.valid,true);assert.equal(r.yaku.length,0);assert.equal(r.dora+r.ura+r.red+r.rig,0);assert.equal(r.base,70);assert.equal(r.mult,1);assert.equal(r.score,70);
});
test('default rewards are fixed and final boss has no additional spendable reward',()=>{
 const actual=[];for(let c=1;c<=3;c++)for(let r=1;r<=2;r++){const s=practice('ron');s.chapter=c;s.round=r;s.isBoss=r===2;s.phase='result';s.score=s.target;const before=s.coins;act(s,'continue');actual.push(s.coins-before);if(c===3&&r===2)assert.equal(s.phase,'won');}assert.deepEqual(actual,[8,10,10,12,12,0]);
});
test('1-coin mode prices every product and reroll at one, and cannot profit from resale',()=>{
 const s=testShop();s.config.priceMode='feel';for(const item of CATALOG)assert.equal(price(s,item),1);s.rerolls=10;assert.equal(rerollCost(s),1);assert.equal(sellValue(s),0);
 s.offers=['closed'];const before=s.coins;act(s,'buy',{id:'closed'});act(s,'sell',{id:'closed'});assert.equal(s.coins,before-1);
 assert.deepEqual(s.moneyHistory.slice(-2).map(x=>x.delta),[-1,0]);assert.equal(s.moneyHistory.at(-1).balance,s.coins);
 s.packOffers=['gearPack'];act(s,'openPack',{id:'gearPack'});assert.equal(s.coins,before-2);
});
test('late-form products are absent until the shop before the final chapter',()=>{
 const s=testShop();for(const id of ['overlap','bookPairs']){const item=CATALOG.find(x=>x.id===id);assert.equal(eligible(s,item),false);s.chapter=2;s.isBoss=false;assert.equal(eligible(s,item),false);s.isBoss=true;assert.equal(eligible(s,item),true);s.chapter=1;s.isBoss=false;}
});
