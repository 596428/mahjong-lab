import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,createScenario,DEFAULTS} from '../dist/game.js';
import {readRecord,saveRecord,recordKey} from '../dist/records.js';
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};
test('best scores compare the same rules across seeds, with legacy targets ignored',()=>{
  assert.equal(recordKey({...DEFAULTS,seed:'A',target:100}),recordKey({...DEFAULTS,seed:'B',target:9000}));
  assert.notEqual(recordKey(DEFAULTS),recordKey({...DEFAULTS,modifications:7}));
});
test('only completed non-practice runs update the persistent high score',()=>{
  const storage=memory(),g=new Game();g.s.score=400;
  assert.equal(saveRecord(storage,g).saved,false);g.lose('test');assert.equal(saveRecord(storage,g).saved,true);
  assert.equal(readRecord(storage,DEFAULTS).score,400);
  const next=new Game({seed:'another'});next.s.score=200;next.lose('test');assert.equal(saveRecord(storage,next).saved,false);
  const practice=createScenario('win');practice.s.score=999999;practice.lose('test');assert.equal(saveRecord(storage,practice).saved,false);
  assert.equal(readRecord(storage,DEFAULTS).score,400);
});
test('record persistence tolerates unavailable or malformed browser storage',()=>{
  const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}},g=new Game();g.lose('test');
  assert.equal(readRecord(blocked,DEFAULTS),null);assert.equal(saveRecord(blocked,g).saved,false);
  const storage=memory();storage.setItem('midnight-table-records-v2','null');assert.equal(readRecord(storage,DEFAULTS),null);
});
