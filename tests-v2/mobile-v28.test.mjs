import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,act,assertState,optionsFor,practice,remainingWaits,startRound} from '../dist/v2/game.js';
import {actionChoices} from '../dist/v2/controls.js';
import {moveHandTile} from '../dist/v2/hand-layout.js';

test('new challenge begins before first draw, saves safely and offers only tsumo',()=>{
 const s=newGame({seed:'first-draw'});assert.equal(s.phase,'awaitDraw');assert.equal(s.hand.length,7);assert.equal(s.turn,0);assert.equal(s.drawn,null);assertState(s);
 assert.deepEqual(actionChoices(s,s.hand[0].id,s.floor[0].id).map(x=>[x.action,x.label]),[['draw','쯔모']]);
 assert.deepEqual(optionsFor(s),{tsumo:null,ron:[],calls:[],kans:[],riichi:[]});assert.throws(()=>act(s,'discard',{id:s.hand[0].id}));assert.throws(()=>act(s,'ron',{id:s.floor[0].id}));
 assert.ok(moveHandTile(s,s.hand[0].id,s.hand[1].id));
 const restored=JSON.parse(JSON.stringify(s)),wall=s.wall.length,drawId=s.wall.at(-1).id;
 act(restored,'draw');assert.equal(restored.phase,'action');assert.equal(restored.hand.length,8);assert.equal(restored.turn,1);assert.equal(restored.drawn,drawId);assert.equal(restored.wall.length,wall-1);assertState(restored);assert.throws(()=>act(restored,'draw'));
});

test('remaining waits subtract all known physical tiles and ignore every hidden pool',()=>{
 const t=(id,type,original=type)=>({id,type,original});
 const s={hand:[t('h',3)],floor:[t('f',3)],locked:[{tiles:[t('l',4)]}],discards:[t('d',3),t('modified',33,4)],indicators:[t('i',4)],ura:[t('u',4),t('secret',3)],uraKnown:0,excluded:[t('ex',3)],wall:[t('w',3)]};
 assert.deepEqual(remainingWaits(s,[3,4,3]),[{type:3,remaining:1},{type:4,remaining:1}]);
 s.excluded=[];s.wall=[];s.ura[1].type=20;assert.deepEqual(remainingWaits(s,[3,4]),[{type:3,remaining:1},{type:4,remaining:1}]);
 s.uraKnown=1;assert.deepEqual(remainingWaits(s,[4]),[{type:4,remaining:0}]);
 s.discards.push(s.hand[0]);assert.equal(remainingWaits(s,[3])[0].remaining,1);
});

test('selected riichi discard remains visible in estimate; exhausted waits remain legal',()=>{
 const s=practice('riichi'),east=s.hand.find(t=>t.type===27),option=optionsFor(s).riichi.find(x=>x.id===east.id);
 assert.ok(option.waits.includes(3));const before=remainingWaits(s,option.waits);act(s,'riichi',{id:east.id});assert.deepEqual(remainingWaits(s,option.waits),before);
 const indices=s.wall.filter(t=>t.type===3).map(t=>t.id);s.discards.push(...s.wall.filter(t=>indices.includes(t.id)));s.wall=s.wall.filter(t=>!indices.includes(t.id));
 assert.equal(remainingWaits(s,[3])[0].remaining,0);assertState(s);
});

test('wide shelf plus narrow boss deliberately displays five available of six slots',()=>{
 const s=newGame({seed:'wide-boss'});s.equipment=['wideFloor'];s.round=2;s.bossOrder[0]='narrow';startRound(s);
 assert.equal(s.floorSlots,6);assert.equal(s.floor.length,5);assert.equal(s.blockedFloor.floorSlot,5);assert.ok(s.discards.some(t=>t.id===s.blockedFloor.id));assertState(s);
 s.round=1;startRound(s);assert.equal(s.floorSlots,6);assert.equal(s.floor.length,6);assert.equal(s.blockedFloor,null);assertState(s);
});
