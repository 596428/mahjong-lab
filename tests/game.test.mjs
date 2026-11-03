import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,createScenario,normalizeConfig} from '../dist/game.js';
const ids=ts=>ts.map(t=>t.id);
const pick=(g,types)=>{const available=g.pool.slice();return types.map(type=>{const i=available.findIndex(t=>t.type===type);assert.ok(i>=0);return available.splice(i,1)[0].id;});};

test('seed reproducibility and 136 physical tiles conserved after initial reservations',()=>{
  const a=new Game({seed:'QA'}),b=new Game({seed:'QA'}),c=new Game({seed:'other'});
  assert.deepEqual(a.s.wall,b.s.wall);assert.notDeepEqual(a.s.wall,c.s.wall);
  assert.equal(a.s.wall.length,115);assert.equal(a.s.hand.length,13);assert.equal(a.s.hidden.length,6);assert.ok(a.audit());
  assert.equal(new Game({hidden:0}).s.wall.length,121);
  assert.equal(normalizeConfig({maxReveal:1,baseReveal:8}).maxReveal,8);
});
test('ordinary submission preserves unused tiles; recovery only resets attempt resources',()=>{
  const g=createScenario('win');const selected=[...g.s.hand,g.s.floor[0]];
  g.submit(ids(selected),selected.at(-1).id);assert.equal(g.s.score,400);assert.equal(g.s.phase,'recovery');assert.equal(g.s.floor.length,3);
  const keep=g.s.floor[0];g.nextAttempt([keep.id]);assert.equal(g.s.attempt,2);assert.ok(g.s.hand.some(t=>t.id===keep.id));assert.equal(g.s.hand.length,13);assert.equal(g.s.floor.length,0);assert.equal(g.s.exposed,0);assert.equal(g.s.modifications,5);assert.ok(g.audit());
});
test('zero-yaku submission is rejected without consuming tiles or actions',()=>{
  const g=createScenario('zero'),selected=[...g.s.hand,g.s.floor[0]];
  const before=JSON.stringify(g.s);assert.throws(()=>g.submit(ids(selected)),/역이 없어/);assert.equal(JSON.stringify(g.s),before);
  assert.equal(g.shapeHints().length,0);
  g.s.discard.push(...g.s.wall);g.s.wall=[];g.s.modifications=0;g.resolveStall();assert.equal(g.s.phase,'lost');assert.ok(g.audit());
});
test('invalid submissions and excessive modifications are atomic',()=>{
  const g=new Game();g.openBase();const before=JSON.stringify(g.s);
  assert.throws(()=>g.submit(ids(g.s.hand)),/14/);assert.equal(JSON.stringify(g.s),before);
  assert.throws(()=>g.modify(ids(g.s.hand.slice(0,6))),/1~5/);assert.equal(JSON.stringify(g.s),before);
  assert.throws(()=>g.modify([g.s.hand[0].id],ids(g.s.floor.slice(0,2))),/초과/);assert.equal(JSON.stringify(g.s),before);
});
test('modification uses one round resource, partial floor take and shared take budget',()=>{
  const g=new Game({maxTake:2});g.openBase();const wall=g.s.wall.length;
  const oldFloor=g.s.floor.slice(),taken=g.s.floor[0];g.modify(ids(g.s.hand.slice(0,3)),[taken.id]);
  assert.equal(g.s.modifications,4);assert.equal(g.s.wall.length,wall-6);assert.equal(g.s.floor.length,4);assert.equal(g.s.hand.length,13);assert.equal(g.remainingTake,1);assert.ok(g.s.hand.some(t=>t.id===taken.id));assert.ok(g.audit());
  assert.ok(oldFloor.slice(1).every(t=>g.s.discard.includes(t)));assert.ok(g.s.floor.every(t=>!oldFloor.includes(t)));
  const event=g.s.events.findLast(e=>e.action==='modify');assert.equal(event.swept.length,3);assert.equal(event.refreshed.length,4);assert.equal(event.drawn.length,2);
});

test('exchange before opening supplies the base floor once, without a penalty',()=>{
  const g=new Game({baseReveal:6});const wall=g.s.wall.length;
  g.modify([g.s.hand[0].id]);assert.equal(g.s.phase,'play');assert.equal(g.s.wall.length,wall-7);
  assert.equal(g.s.floor.length,6);assert.equal(g.s.exposed,6);assert.equal(g.factor,1);
  assert.throws(()=>g.openBase(),/기본 공개/);g.reveal();assert.equal(g.factor,.92);assert.ok(g.audit());
});

test('exchange replenishes the hand first, then as many floor tiles as remain',()=>{
  for(const remaining of [0,1,3]){
    const g=new Game();g.openBase();g.s.discard.push(...g.s.wall.splice(0,g.s.wall.length-remaining));
    const take=remaining===0?[g.s.floor[0].id]:[];
    g.modify([g.s.hand[0].id],take);assert.equal(g.s.hand.length,13);assert.equal(g.s.wall.length,0);
    assert.equal(g.s.floor.length,Math.max(0,remaining-1));assert.equal(g.factor,1);assert.ok(g.audit());
  }
});

test('submission order does not change scoring when the winning tile is retained',()=>{
  const g=createScenario('win'),chosen=ids([...g.s.hand,g.s.floor[0]]),win=chosen.at(-1);
  assert.deepEqual(g.preview(chosen,win),g.preview(chosen.slice().reverse(),win));
  const alternative=g.s.hand.find(t=>t.type===6).id;
  assert.notEqual(g.preview(chosen,win).score,g.preview(chosen,alternative).score);
});
test('exchange cannot reset cumulative exposure or its penalty',()=>{
  const g=new Game({maxReveal:5});g.openBase();g.reveal();g.modify([g.s.hand[0].id],[g.s.floor[0].id]);assert.equal(g.s.exposed,5);assert.equal(g.canReveal,false);assert.equal(g.factor,.92);
});
test('riichi wins on fourth draw with ippatsu, reveals ura, and continues',()=>{
  const g=createScenario('riichi');g.declareRiichi();assert.equal(g.s.riichi.doubleRiichi,false);
  for(let i=0;i<3;i++){g.drawRiichi();assert.equal(g.s.phase,'riichi');assert.equal(g.s.uraRevealed,false);}
  g.drawRiichi();assert.equal(g.s.phase,'recovery');assert.equal(g.s.result.draws,4);assert.ok(g.s.result.yaku.some(y=>y.name==='일발'));assert.equal(g.s.uraRevealed,true);assert.ok(g.audit());
  g.nextAttempt();assert.equal(g.s.hand.length,13);assert.equal(g.s.uraRevealed,true);
});
test('fifth draw removes ippatsu; riichi preserves exposure factor and disallows edits',()=>{
  const g=createScenario('riichi');const extraIndex=g.s.wall.findIndex(t=>t.type===30),[extra]=g.s.wall.splice(extraIndex,1);g.s.wall.push(extra);
  g.s.exposed=5;g.declareRiichi();assert.equal(g.s.riichi.multiplier,.92);assert.throws(()=>g.modify([g.s.hand[0].id]),/교환/);assert.throws(()=>g.reveal(),/공개/);
  while(g.s.phase==='riichi')g.drawRiichi();assert.equal(g.s.result.draws,5);assert.ok(!g.s.result.yaku.some(y=>y.name==='일발'));assert.equal(g.s.result.multiplier,.92);assert.ok(g.audit());
});

test('riichi history retains swept floor and chronological misses, excluding the winning draw',()=>{
  const g=createScenario('riichi');g.s.floor=g.s.wall.splice(0,3);g.s.exposed=3;
  const floor=ids(g.s.floor),wallStart=g.s.wall.length;
  g.declareRiichi();assert.deepEqual(ids(g.s.riichi.discardedFloor),floor);assert.equal(g.s.riichi.wallStart,wallStart);
  assert.equal(g.s.floor.length,0);assert.equal(g.s.wall.length,wallStart);
  for(let i=0;i<4;i++)g.drawRiichi();
  assert.equal(g.s.phase,'recovery');assert.deepEqual(g.s.riichi.tsumogiri.map(t=>t.type),[30,31,32]);
  assert.equal(g.s.riichi.draws,4);assert.equal(g.s.wall.length,wallStart-4);
  assert.ok(!ids(g.s.riichi.tsumogiri).includes(g.s.result.winId));assert.deepEqual(ids(g.s.riichi.discardedFloor),floor);assert.ok(g.audit());
  g.nextAttempt();assert.equal(g.s.riichi,null);
});

test('pool riichi history includes only abandoned floor tiles, not those used in the locked hand',()=>{
  const g=createScenario('emergency'),floor=g.s.floor.slice();g.declareRiichi(ids(g.riichiCandidates()[0]));
  const locked=ids(g.s.hand);
  assert.deepEqual(ids(g.s.riichi.discardedFloor),floor.filter(t=>!locked.includes(t.id)).map(t=>t.id));
  assert.equal(g.s.riichi.discardedFloor.length,3);assert.ok(g.audit());
});
test('structural tenpai can declare even with all winning tiles unavailable',()=>{
  const g=createScenario('riichi'),winning=g.handWaits;const removed=g.s.wall.filter(t=>winning.includes(t.type));g.s.wall=g.s.wall.filter(t=>!winning.includes(t.type));g.s.discard.push(...removed);
  assert.ok(g.canRiichi);g.declareRiichi();while(g.s.phase==='riichi')g.drawRiichi();assert.equal(g.s.phase,'lost');assert.equal(g.s.score,0);assert.ok(g.audit());
  assert.equal(g.s.riichi.tsumogiri.length,g.s.riichi.wallStart);assert.equal(g.s.riichi.draws,g.s.riichi.tsumogiri.length);
});
test('post-exchange pool riichi needs no additional exchanges or recovery allowance',()=>{
  const g=createScenario('emergency',{maxTake:0});assert.equal(g.s.phase,'play');assert.equal(g.s.modifications,0);assert.equal(g.handWaits.length,0);assert.equal(g.canRiichi,true);
  const selected=g.riichiCandidates()[0],hand=g.s.hand.slice(),floor=g.s.floor.slice();
  g.declareRiichi(ids(selected));assert.equal(g.s.emergencyUsed,false);assert.equal(g.s.phase,'riichi');assert.equal(g.s.floor.length,0);
  assert.equal(g.s.modifications,0);assert.equal(g.s.taken,0);assert.deepEqual(g.s.hand,selected);
  assert.deepEqual(g.s.riichi.discardedHand,hand.filter(t=>!selected.includes(t)));assert.deepEqual(g.s.riichi.discardedFloor,floor.filter(t=>!selected.includes(t)));
  assert.equal(g.s.riichi.doubleRiichi,false);while(g.s.phase==='riichi')g.drawRiichi();assert.equal(g.s.result.mode,'riichi');assert.ok(g.audit());
});

test('invalid pool riichi selection is rejected atomically',()=>{
  const g=createScenario('emergency'),before=JSON.stringify(g.s);
  for(const selection of [ids(g.s.hand),ids(g.pool.slice(0,14)),Array(13).fill(g.s.hand[0].id),[...ids(g.s.hand.slice(0,12)),999]]){
    assert.throws(()=>g.declareRiichi(selection),/텐파이 13장/);assert.equal(JSON.stringify(g.s),before);
  }
});

test('pool riichi preserves penalties and requires a remaining draw',()=>{
  const g=createScenario('emergency');g.s.exposed=5;const wall=g.s.wall.length;
  g.declareRiichi(ids(g.riichiCandidates()[0]));assert.equal(g.s.riichi.multiplier,.92);assert.equal(g.s.wall.length,wall);assert.equal(g.s.riichi.wallStart,wall);assert.ok(g.audit());
  const empty=createScenario('emergency');empty.s.discard.push(...empty.s.wall);empty.s.wall=[];
  assert.equal(empty.canRiichi,false);const before=JSON.stringify(empty.s);assert.throws(()=>empty.declareRiichi(ids(empty.riichiCandidates()[0])),/선언할 수/);assert.equal(JSON.stringify(empty.s),before);
});

test('wall exhaustion still allows an existing complete hand to submit',()=>{
  const g=createScenario('win');g.s.discard.push(...g.s.wall);g.s.wall=[];g.resolveStall();assert.equal(g.s.phase,'play');g.submit(ids([...g.s.hand,g.s.floor[0]]));assert.equal(g.s.phase,'recovery');g.nextAttempt();assert.equal(g.s.phase,'lost');assert.ok(g.audit());
});
test('score has no clearance threshold; sealed information is exported only after the run ends',()=>{
  const g=createScenario('win',{target:100});assert.equal(g.config.target,undefined);g.s.score=100000;
  assert.equal(g.exportLog().sealedTiles,undefined);
  g.submit(ids([...g.s.hand,g.s.floor[0]]));assert.equal(g.s.score,100400);assert.equal(g.s.phase,'recovery');assert.equal(g.exportLog().sealedTiles,undefined);
  g.s.discard.push(...g.s.wall);g.s.wall=[];g.nextAttempt();assert.equal(g.s.phase,'lost');assert.equal(g.exportLog().sealedTiles.length,6);assert.ok(g.audit());
});
test('120 seeded full rounds terminate and preserve every physical tile',()=>{
  for(let n=0;n<120;n++){
    const g=new Game({seed:`simulation-${n}`,target:100000,maxReveal:n%2?12:16,maxTake:n%5,modifications:n%7});
    let moves=0;
    while(!['won','lost'].includes(g.s.phase)&&moves++<500){
      if(g.s.phase==='riichi'){g.drawRiichi();continue;}
      if(g.s.phase==='emergency'){g.chooseEmergency(g.emergencyCandidates()[0]);continue;}
      if(g.s.phase==='recovery'){g.nextAttempt(ids(g.s.floor.slice(0,Math.min(g.remainingTake,13-g.s.hand.length))));continue;}
      const shape=g.shapeHints()[0];
      if(shape){const selected=pick(g,shape),win=selected.find(id=>g.preview(selected,id).yaku.length>0);g.submit(selected,win);continue;}
      if(g.canRiichi){g.declareRiichi(ids(g.handWaits.length?g.s.hand:g.riichiCandidates(1)[0]));continue;}
      if(g.s.phase==='opening'&&g.canReveal){g.openBase();continue;}
      if(g.canReveal){g.reveal();continue;}
      if(g.canModify){g.modify([g.s.hand[0].id],g.s.floor.length&&g.remainingTake?[g.s.floor[0].id]:[]);continue;}
      g.resolveStall();
    }
    assert.ok(moves<500,`seed ${n} stuck`);assert.ok(g.audit());
  }
});


test('initial base opening cannot enable floor riichi',()=>{
  const g=createScenario('emergency'),selected=ids(g.riichiCandidates()[0]);
  const floor=g.s.floor.slice();g.s.floor=[];g.s.wall.push(...floor.reverse());g.s.phase='opening';g.s.exposed=0;g.s.poolRiichiOpen=false;
  assert.equal(g.canRiichi,false);g.openBase();assert.equal(g.s.poolRiichiOpen,false);assert.equal(g.canRiichi,false);
  assert.ok(g.riichiWaits(selected).length);const before=JSON.stringify(g.s);
  assert.throws(()=>g.declareRiichi(selected),/교환 직후/);assert.equal(JSON.stringify(g.s),before);assert.ok(g.audit());
});

test('exchange opens the floor riichi window; a reveal closes it and another exchange reopens it',()=>{
  const g=new Game();assert.equal(g.s.poolRiichiOpen,false);g.openBase();g.modify([g.s.hand[0].id]);assert.equal(g.s.poolRiichiOpen,true);
  g.reveal();assert.equal(g.s.poolRiichiOpen,false);g.modify([g.s.hand[0].id]);assert.equal(g.s.poolRiichiOpen,true);assert.ok(g.audit());
  const ready=createScenario('emergency'),selected=ids(ready.riichiCandidates()[0]);ready.reveal();
  assert.equal(ready.s.poolRiichiOpen,false);assert.equal(ready.canRiichi,false);assert.equal(ready.canRiichiSelection(selected),false);
  const before=JSON.stringify(ready.s);assert.throws(()=>ready.declareRiichi(selected),/교환 직후/);assert.equal(JSON.stringify(ready.s),before);
  ready.s.exposed=ready.config.maxReveal;ready.resolveStall();assert.equal(ready.s.phase,'lost');assert.ok(ready.audit());
});

test('hand-only riichi survives a closed window; a new hand resets the window',()=>{
  const g=createScenario('riichi');g.openBase();g.reveal();assert.equal(g.s.poolRiichiOpen,false);assert.equal(g.canRiichi,true);g.declareRiichi();assert.equal(g.s.phase,'riichi');assert.ok(g.audit());
  const next=createScenario('win');next.s.poolRiichiOpen=true;next.submit(ids([...next.s.hand,next.s.floor[0]]));next.nextAttempt();assert.equal(next.s.poolRiichiOpen,false);assert.ok(next.audit());
});
