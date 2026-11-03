import {countsOf,waits,findShapes,emergencyHands,evaluate,multiplier,validShape} from './rules.js';

export const DEFAULTS={seed:'FIRST-LIGHT',baseReveal:4,maxReveal:12,modifications:5,maxModify:5,maxTake:4,hidden:6,seatWind:27,roundWind:27};
export const LIMITS={baseReveal:[1,8],maxReveal:[1,16],modifications:[0,15],maxModify:[1,13],maxTake:[0,13],hidden:[0,24],seatWind:[27,30],roundWind:[27,30]};
export function normalizeConfig(input={}) {
  const c={...DEFAULTS};for(const key of Object.keys(DEFAULTS))if(input[key]!==undefined)c[key]=input[key];
  c.seed=String(c.seed||DEFAULTS.seed).slice(0,80);
  for(const [k,[min,max]] of Object.entries(LIMITS)){const n=Number(c[k]);c[k]=Number.isFinite(n)?Math.min(max,Math.max(min,Math.round(n))):DEFAULTS[k];}
  c.maxReveal=Math.max(c.baseReveal,c.maxReveal); return c;
}
function rng(seed) {
  let h=2166136261;for(const char of seed)h=Math.imul(h^char.charCodeAt(0),16777619);
  return ()=>{let t=h+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};
}
export function shuffled(seed) {
  const a=Array.from({length:136},(_,id)=>({id,type:Math.floor(id/4)})),r=rng(seed);
  for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;
}
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
export class Game {
  constructor(config={}) {
    this.config=normalizeConfig(config);
    const wall=shuffled(this.config.seed), dora=wall.pop(),ura=wall.pop(),hidden=wall.splice(-this.config.hidden||wall.length,this.config.hidden);
    this.state={wall,dora,ura,hidden,hand:[],floor:[],discard:[],score:0,phase:'opening',attempt:1,
      modifications:this.config.modifications,poolRiichiOpen:false,exposed:0,taken:0,emergencyUsed:false,uraRevealed:false,
      riichi:null,result:null,events:[],message:'바닥패를 열고 첫 화료를 준비하세요.',actions:0,endedReason:'',scenario:null};
    this._shapeKey='';this._shapeCache=[];this.fillHand();this.log('start',{config:this.config});this.audit();
  }
  get s(){return this.state;}
  log(action,data={}){this.s.events.push({step:this.s.events.length,action,attempt:this.s.attempt,wallLeft:this.s.wall.length,...data});}
  fillHand(){while(this.s.hand.length<13&&this.s.wall.length)this.s.hand.push(this.s.wall.pop());}
  get remainingTake(){return Math.max(0,this.config.maxTake-this.s.taken);}
  get factor(){return multiplier(this.s.exposed,this.config.baseReveal);}
  get active(){return ['opening','play'].includes(this.s.phase);}
  get pool(){return [...this.s.hand,...this.s.floor];}
  get canReveal(){return this.active&&this.s.wall.length>0&&this.s.exposed<this.config.maxReveal;}
  get canModify(){return this.active&&this.s.modifications>0&&this.s.hand.length>0&&(this.s.wall.length>0||(this.s.floor.length>0&&this.remainingTake>0));}
  get handWaits(){return waits(this.s.hand.map(x=>x.type));}
  get canRiichi(){return this.active&&this.s.wall.length>0&&(this.handWaits.length>0||this.riichiCandidates(1).length>0);}
  riichiWaits(ids){
    if(ids.length!==13||new Set(ids).size!==13)return [];
    const tiles=ids.map(id=>this.pool.find(t=>t.id===id));
    return tiles.every(Boolean)?waits(tiles.map(t=>t.type)):[];
  }
  canRiichiSelection(ids){return this.active&&this.s.wall.length>0&&this.riichiWaits(ids).length>0&&(this.s.poolRiichiOpen||ids.every(id=>this.s.hand.some(t=>t.id===id)));}
  riichiCandidates(limit=12){
    if(!this.s.poolRiichiOpen)return this.handWaits.length?[this.s.hand.slice()]:[];
    const key=countsOf(this.pool).join(',')+':'+limit;
    if(key!==this._riichiKey){this._riichiKey=key;this._riichiCache=emergencyHands(this.pool,limit);}
    return this._riichiCache.map(candidate=>{const available=this.pool.slice();return candidate.types.map(type=>available.splice(available.findIndex(t=>t.type===type),1)[0]);});
  }
  shapeHints(limit=1){
    const key=countsOf(this.pool).join(',')+':'+limit+':'+this.config.seatWind+':'+this.config.roundWind;
    if(key!==this._shapeKey){this._shapeKey=key;this._shapeCache=findShapes(this.pool,limit,types=>[...new Set(types)].some(t=>evaluate(types,t,this.context()).yaku.length>0));}return this._shapeCache;
  }
  context(extra={}){return {seatWind:this.config.seatWind,roundWind:this.config.roundWind,dora:this.s.dora.type,multiplier:this.factor,...extra};}
  preview(ids,winId=ids.at(-1)){
    const chosen=ids.map(id=>this.pool.find(x=>x.id===id));
    if(new Set(ids).size!==14||chosen.some(x=>!x)||!chosen.some(x=>x.id===winId))return evaluate([],0);
    return evaluate(chosen,chosen.find(x=>x.id===winId).type,this.context());
  }
  openBase(){
    assert(this.s.phase==='opening','지금은 기본 공개 단계가 아닙니다.');
    const n=Math.min(this.config.baseReveal,this.s.wall.length);
    const tiles=[];for(let i=0;i<n;i++){const t=this.s.wall.pop();this.s.floor.push(t);tiles.push(t);}
    this.s.poolRiichiOpen=false;this.s.exposed+=n;this.s.phase='play';this.s.actions++;this.s.message=`바닥패 ${n}장을 공개했습니다.`;
    this.log('open-base',{tiles});this.resolveStall();this.audit();
  }
  reveal(){
    assert(this.s.phase==='play'&&this.canReveal,'더 공개할 수 없습니다.');
    this.s.poolRiichiOpen=false;const tile=this.s.wall.pop();this.s.floor.push(tile);this.s.exposed++;this.s.actions++;
    this.s.message='새 바닥패를 공개했습니다. 현재 배율은 이 시도 동안 유지됩니다.';
    this.log('reveal',{tile});this.resolveStall();this.audit();
  }
  modify(discardIds,takeIds=[]){
    assert(this.canModify,'패 교환 기회를 사용할 수 없습니다.');
    assert(new Set(discardIds).size===discardIds.length&&new Set(takeIds).size===takeIds.length,'중복 선택입니다.');
    assert(discardIds.length>=1&&discardIds.length<=this.config.maxModify,`손패 1~${this.config.maxModify}장을 선택하세요.`);
    assert(discardIds.every(id=>this.s.hand.some(t=>t.id===id)),'버릴 패는 손패에서 선택하세요.');
    assert(takeIds.every(id=>this.s.floor.some(t=>t.id===id)),'가져올 패는 바닥에서 선택하세요.');
    assert(takeIds.length<=discardIds.length&&takeIds.length<=this.remainingTake,'교환 가능한 장수를 초과했습니다.');
    assert(takeIds.length+this.s.wall.length>0,'보충할 패가 없습니다.');
    // Every selected discard must be replaceable. No paid no-op on an exhausted wall.
    assert(discardIds.length<=takeIds.length+this.s.wall.length,'선택한 장수를 보충할 패가 부족합니다.');
    const gone=this.s.hand.filter(x=>discardIds.includes(x.id)),take=this.s.floor.filter(x=>takeIds.includes(x.id));
    this.s.hand=this.s.hand.filter(x=>!discardIds.includes(x.id));this.s.discard.push(...gone);
    this.s.floor=this.s.floor.filter(x=>!takeIds.includes(x.id));this.s.hand.push(...take);
    const drawn=[];for(let i=0;i<discardIds.length-takeIds.length;i++){const t=this.s.wall.pop();this.s.hand.push(t);drawn.push(t);}
    const swept=this.s.floor.slice();this.s.discard.push(...swept);this.s.floor=[];
    const refreshed=[];while(refreshed.length<this.config.baseReveal&&this.s.wall.length){const t=this.s.wall.pop();this.s.floor.push(t);refreshed.push(t);}
    // Exchange refreshes are paid with an exchange and wall tiles, not exposure penalties.
    // An exchange before the first reveal also opens the base floor exactly once.
    if(this.s.phase==='opening')this.s.exposed=refreshed.length;
    this.s.poolRiichiOpen=refreshed.length>0;this.s.phase='play';
    this.s.taken+=take.length;this.s.modifications--;this.s.actions++;
    this.s.message=`손패 ${gone.length}장 교환 · 남은 바닥패 ${swept.length}장 버림 · 새 바닥패 ${refreshed.length}장 공개 · 배율 유지`;
    this.log('modify',{discard:gone,take,drawn,swept,refreshed});this.resolveStall();this.audit();
  }
  submit(ids,winId=ids.at(-1)){
    assert(this.active,'지금은 패를 제출할 수 없습니다.');
    assert(ids.length===14&&new Set(ids).size===14,'정확히 14장을 내려놓으세요.');
    const selected=ids.map(id=>this.pool.find(t=>t.id===id));assert(selected.every(Boolean),'선택한 패가 현재 작탁에 없습니다.');
    assert(selected.some(t=>t.id===winId),'화료패를 지정하세요.');
    const result=this.preview(ids,winId);assert(result.valid,'아직 완성형이 아닙니다. 패를 바꾸려면 패 교환을 사용하세요.');
    assert(result.yaku.length>0,'역이 없어 화료할 수 없습니다. 도라는 역으로 세지 않습니다.');
    this.s.hand=this.s.hand.filter(t=>!ids.includes(t.id));this.s.floor=this.s.floor.filter(t=>!ids.includes(t.id));
    this.s.discard.push(...selected);this.s.actions++;
    this.finishWin(selected,winId,result,'normal');this.audit();
  }
  finishWin(tiles,winId,result,mode){
    this.s.score+=result.score;this.s.result={...result,tiles,winId,mode,attempt:this.s.attempt,draws:this.s.riichi?.draws??0};
    this.s.phase='recovery';
    this.s.message=`화료! ${result.score.toLocaleString()}점 획득. 남길 패를 고르고 다음 손으로 이어가세요.`;
    this.log('win',{mode,tiles,winId,result,total:this.s.score});
  }
  nextAttempt(takeIds=[]){
    assert(this.s.phase==='recovery','화료 후에 다음 시도를 시작할 수 있습니다.');
    assert(new Set(takeIds).size===takeIds.length&&takeIds.every(id=>this.s.floor.some(t=>t.id===id)),'회수할 바닥패를 확인하세요.');
    assert(takeIds.length<=Math.min(this.remainingTake,13-this.s.hand.length),'회수 한도를 초과했습니다.');
    const take=this.s.floor.filter(t=>takeIds.includes(t.id));this.s.hand.push(...take);
    this.s.discard.push(...this.s.floor.filter(t=>!takeIds.includes(t.id)));this.s.floor=[];
    this.log('recover',{take});this.s.poolRiichiOpen=false;this.s.attempt++;this.s.exposed=0;this.s.taken=0;this.s.riichi=null;this.s.result=null;
    this.fillHand();this.s.phase='opening';this.s.message='남긴 패를 이어받았습니다. 리치 또는 기본 공개를 선택하세요.';
    this.log('next-attempt',{hand:this.s.hand.slice()});this.resolveStall();this.audit();
  }
  declareRiichi(ids=this.s.hand.map(t=>t.id)){
    assert(this.active&&this.s.wall.length>0,'현재 리치를 선언할 수 없습니다.');
    assert(this.riichiWaits(ids).length>0,'손패와 바닥패에서 텐파이 13장을 선택하세요.');
    assert(this.canRiichiSelection(ids),'바닥패를 사용하는 리치는 패 교환 직후에만 가능합니다.');
    const doubleRiichi=this.s.attempt===1&&this.s.phase==='opening'&&this.s.actions===0;
    const chosen=ids.map(id=>this.pool.find(t=>t.id===id));
    const discardedHand=this.s.hand.filter(t=>!ids.includes(t.id)),discardedFloor=this.s.floor.filter(t=>!ids.includes(t.id));
    this.s.discard.push(...discardedHand,...discardedFloor);this.s.hand=chosen;this.s.floor=[];
    this.startRiichi(false,doubleRiichi,discardedFloor,discardedHand);this.audit();
  }
  startRiichi(emergency,doubleRiichi=false,discardedFloor=this.s.floor.slice(),discardedHand=[]){
    this.s.discard.push(...this.s.floor);this.s.floor=[];
    this.s.riichi={emergency,doubleRiichi,draws:0,waits:this.handWaits,multiplier:this.factor,last:null,
      discardedFloor:discardedFloor.slice(),discardedHand:discardedHand.slice(),tsumogiri:[],wallStart:this.s.wall.length};
    this.s.poolRiichiOpen=false;this.s.phase='riichi';this.s.actions++;this.s.message=emergency?'비상 리치 · 마지막 기회를 잡으세요.':'리치 · 손패를 고정하고 쯔모합니다.';
    this.log('riichi',{emergency,doubleRiichi,hand:this.s.hand.slice(),waits:this.s.riichi.waits,multiplier:this.factor,discardedFloor:this.s.riichi.discardedFloor,discardedHand:this.s.riichi.discardedHand});
  }
  drawRiichi(){
    assert(this.s.phase==='riichi','리치 진행 중이 아닙니다.');
    if(!this.s.wall.length){this.lose('리치 실패 · 패산 소진');return;}
    const tile=this.s.wall.pop(),r=this.s.riichi;r.draws++;r.last=tile;
    const tiles=[...this.s.hand,tile];
    const result=evaluate(tiles,tile.type,this.context({riichi:true,doubleRiichi:r.doubleRiichi,ippatsu:r.draws<=4,tsumo:true,lastTile:this.s.wall.length===0,ura:this.s.ura.type,multiplier:r.multiplier}));
    if(result.valid){this.s.discard.push(...tiles);this.s.hand=[];this.s.uraRevealed=true;this.finishWin(tiles,tile.id,result,r.emergency?'emergency':'riichi');}
    else{this.s.discard.push(tile);r.tsumogiri.push(tile);this.s.message=`${r.draws}번째 쯔모 · ${r.draws<4?'일발 기회가 남았습니다.':r.draws===4?'다음 쯔모부터 일발이 적용되지 않습니다.':'화료패를 기다립니다.'}`;this.log('tsumogiri',{tile,draw:r.draws});if(!this.s.wall.length)this.lose('리치 실패 · 패산 소진');}
    this.audit();
  }
  emergencyCandidates(){return emergencyHands(this.pool,12).map(candidate=>candidate.types);}
  chooseEmergency(types){
    assert(this.s.poolRiichiOpen&&this.s.phase==='emergency'&&!this.s.emergencyUsed&&this.s.wall.length>0,'비상 리치를 사용할 수 없습니다.');
    assert(types.length===13&&waits(types).length>0,'리치 가능한 13장이 아닙니다.');
    const available=this.pool.slice(),chosen=[];
    for(const type of types){const i=available.findIndex(x=>x.type===type);assert(i>=0,'작탁에 없는 패입니다.');chosen.push(...available.splice(i,1));}
    const discardedFloor=this.s.floor.filter(t=>available.includes(t));
    this.s.discard.push(...available);this.s.hand=chosen;this.s.floor=[];this.s.emergencyUsed=true;
    this.startRiichi(true,false,discardedFloor);this.audit();
  }
  resolveStall(){
    if(!this.active)return;
    if(this.canReveal||this.canModify||this.canRiichi||this.shapeHints().length)return;
    this.lose(this.s.wall.length?'진행 가능한 행동이 없어 도전 종료':'패산을 모두 사용했습니다');
  }
  lose(reason){this.s.phase='lost';this.s.endedReason=reason;this.s.message=reason;this.log('end',{reason});}
  audit(){
    const zones=[...this.s.wall,...this.s.hand,...this.s.floor,...this.s.discard,...this.s.hidden,this.s.dora,this.s.ura];
    assert(zones.length===136&&new Set(zones.map(t=>t.id)).size===136,'패 보존 오류');
    assert(zones.every(t=>t.id>=0&&t.id<136&&t.type===Math.floor(t.id/4)),'패 식별 오류');
    assert(this.s.hand.length<=13,'손패 상한 오류');
    assert(this.s.modifications>=0&&this.s.exposed<=this.config.maxReveal&&this.s.taken<=this.config.maxTake,'행동 자원 오류');
    return true;
  }
  exportLog(){
    const ended=this.s.phase==='lost';
    return {version:'0.5.0',config:this.config,scenario:this.s.scenario,phase:this.s.phase,score:this.s.score,events:this.s.events,
      ...(ended?{sealedTiles:this.s.hidden,indicators:[this.s.dora,this.s.ura],remainingWall:this.s.wall}:{} )};
  }
}

// Explicit, labelled tester fixtures. Never used in normal seeded games.
export function createScenario(name,config={}) {
  const g=new Game({...config,baseReveal:4,maxReveal:12,hidden:6}),s=g.s;
  const inventory=Array.from({length:136},(_,id)=>({id,type:Math.floor(id/4)}));
  const take=t=>{const i=inventory.findIndex(x=>x.type===t);assert(i>=0,'잘못된 테스트 배치');return inventory.splice(i,1)[0];};
  const takeAll=ts=>ts.map(take);
  s.dora=take(7);s.ura=take(14);
  const ready=[1,2,3,10,11,12,19,20,21,3,4,13,13];
  let hand,floor,front=[];
  if(name==='win'){hand=[1,2,3,10,11,12,19,20,21,4,5,6,13];floor=[13,27,28,29];}
  else if(name==='zero'){hand=[0,0,0,1,2,3,10,11,12,18,19,20,4];floor=[4,27,28,29];}
  else if(name==='riichi'){hand=ready;floor=[];front=[30,31,32,5];}
  else if(name==='emergency'){hand=ready.slice();hand[12]=33;floor=[13,27,28,29];front=[30,31,32,5];s.modifications=0;s.poolRiichiOpen=true;}
  else throw new Error('알 수 없는 테스트 배치');
  s.hand=takeAll(hand);s.floor=takeAll(floor);const next=takeAll(front);
  s.hidden=inventory.splice(0,6);s.wall=[...inventory,...next.reverse()];s.discard=[];
  s.phase=name==='riichi'?'opening':'play';s.exposed=floor.length;s.actions=name==='riichi'?1:0;s.scenario=name;
  s.events=[];s.message=name==='emergency'?'패 교환 직후를 재현한 연습 배치입니다. 추가 공개하면 바닥패 리치 기회가 닫힙니다.':'연습 배치입니다. 최고 기록에는 반영되지 않습니다.';g.log('test-scenario',{name,config:g.config});g.resolveStall();g.audit();return g;
}
