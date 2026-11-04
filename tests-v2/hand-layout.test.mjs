import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,practice,act,optionsFor,assertState} from '../dist/v2/game.js';
import {activeDraw,handView,moveHandTile,syncHandOrder,sortHand,setHandAutoSort} from '../dist/v2/hand-layout.js';
import {winningLayout,evaluate,domains} from '../dist/v2/rules.js';
const tiles=ts=>ts.map((type,i)=>({type,id:'t'+i}));
test('auto sort follows manipulation and discarded draws; OFF keeps the chosen order',()=>{
 const s=practice('ron');setHandAutoSort(s,true);const id=s.hand.find(t=>t.type===1).id;
 act(s,'tool',{tool:'wind',id});assert.equal(handView(s).body.at(-1).id,id);assert.equal(moveHandTile(s,id,handView(s).body[0].id),false);
 act(s,'draw');assert.equal(handView(s).draw.id,s.drawn);const drawn=s.drawn;act(s,'discard',{id:s.hand.find(t=>t.id!==drawn).id});
 const types=handView(s).body.map(t=>t.special==='wind'?27:t.type);assert.deepEqual(types,types.slice().sort((a,b)=>a-b));
 setHandAutoSort(s,false);const order=handView(s).body;moveHandTile(s,order.at(-1).id,order[0].id);const manual=handView(s).body.map(t=>t.id);
 const saved=JSON.parse(JSON.stringify(s));assert.equal(saved.autoSortHand,false);assert.deepEqual(handView(saved).body.map(t=>t.id),manual);act(saved,'draw');act(saved,'discard',{id:saved.drawn});assert.deepEqual(handView(saved).body.map(t=>t.id),manual);assertState(saved);
});
test('discarding an old tile integrates the retained draw, including legacy floor saves',()=>{
 const s=newGame({seed:'draw-fix'});act(s,'draw');const drawId=s.drawn;assert.equal(handView(s).draw.id,drawId);act(s,'discard',{id:s.hand.find(t=>t.id!==drawId).id});assert.equal(s.drawn,null);assert.equal(handView(s).draw,null);assert.ok(handView(s).body.some(t=>t.id===drawId));s.drawn=drawId;assert.equal(activeDraw(s),null);assert.equal(handView(s).draw,null);assertState(s);
});
test('reordering preserves scoring and survives save, discard and a new draw',()=>{
 const s=practice('ron'),initial=s.hand.map(t=>t.id),score=optionsFor(s).ron[0].score.score;const a=syncHandOrder(s),last=a.at(-1),first=a[0];assert.ok(moveHandTile(s,last,first));assert.equal(handView(s).body[0].id,last);assert.deepEqual(s.hand.map(t=>t.id),initial);assert.equal(optionsFor(s).ron[0].score.score,score);
 const saved=JSON.parse(JSON.stringify(s));assert.equal(handView(saved).body[0].id,last);act(saved,'draw');assert.equal(handView(saved).body[0].id,last);const keepOrder=handView(saved).body.map(t=>t.id);act(saved,'discard',{id:saved.drawn});assert.deepEqual(handView(saved).body.map(t=>t.id),keepOrder);assertState(saved);
});
test('fresh draw can be dragged into the rack; riichi blocks reorder and sort restores draw slot',()=>{
 const s=newGame({seed:'draw-drag'});act(s,'draw');const id=s.drawn;const first=handView(s).body[0].id;assert.ok(moveHandTile(s,id,first));assert.equal(handView(s).draw,null);assert.equal(handView(s).body[0].id,id);sortHand(s);assert.equal(handView(s).draw.id,id);s.riichi=true;assert.equal(moveHandTile(s,id,first),false);
});
function verify(layout,physical){assert.ok(layout);const displayed=layout.groups.flatMap(g=>g.tiles);assert.equal(displayed.length,physical.length);assert.equal(new Set(displayed.map(t=>t.id)).size,physical.length);assert.deepEqual(displayed.map(t=>t.id).sort(),physical.map(t=>t.id).sort());for(const t of displayed)assert.ok(domains(t).includes(t.resolvedAs));}
test('normal wins display all chapter melds first and the pair last, using each tile once',()=>{
 for(let m=2;m<=4;m++){const hand=tiles([...Array.from({length:m},(_,i)=>[i*3,i*3+1,i*3+2]).flat(),27,27]).reverse();const layout=winningLayout(hand,m);verify(layout,hand);assert.deepEqual(layout.groups.map(g=>g.tiles.length),[...Array(m).fill(3),2]);assert.equal(layout.groups.at(-1).kind,'pair');}
 const s=practice('ron');act(s,'ron',{id:optionsFor(s).ron[0].tile.id});verify(s.lastResult.layout,s.lastResult.hand);assert.deepEqual(s.lastResult.layout.groups.map(g=>g.tiles.length),[3,3,2]);
});
test('display layout supports special forms, overlapping forms, manipulation and locked kans',()=>{
 const pairs=tiles([0,0,2,2,4,4,9,9,12,12,18,18,27,27]);assert.equal(winningLayout(pairs,4).kind,'pairs');verify(winningLayout(pairs,4),pairs);
 const both=tiles([0,0,1,1,2,2,3,3,4,4,5,5,6,6]);assert.equal(winningLayout(both,4).kind,'normal');verify(winningLayout(both,4),both);
 const rig=tiles([0,1,2,27,27,28,31,31]);rig[5].special='wind';const score=evaluate(rig,2);verify(winningLayout(rig,2),rig);assert.deepEqual(evaluate(rig,2),score);
 const loose=tiles([0,1,2,27,27]),locked=[{kind:'kan',t:31,types:[31,31,31,31],open:true,tiles:Array.from({length:4},(_,i)=>({id:'k'+i,type:31,lockedAs:31}))}];const l=winningLayout(loose,2,locked);verify(l,[...loose,...locked[0].tiles]);assert.deepEqual(l.groups.map(g=>g.tiles.length),[3,4,2]);
});
