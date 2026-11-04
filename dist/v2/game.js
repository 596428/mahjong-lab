import {domains,evaluate,waits,riichiOptions,callOptions,ownKanOptions,tileName,winningLayout} from './rules.js';
export const DEFAULTS={excluded:6,red:false,roundsPerChapter:2,priceMode:'balanced'};
export const BOSSES=[{id:'narrow',name:'좁은 창',text:'매 손의 바닥패 1장을 강화 적용 전에 버립니다. 남은 바닥패는 화료까지 유지됩니다.'},{id:'toll',name:'울기의 대가',text:'치·퐁·대명깡을 할 때 패산 2장을 추가로 버립니다.'},{id:'heavy',name:'무거운 작탁',text:'획득 기본점이 20% 감소합니다. 목표 점수는 10% 낮춰 적용합니다.'}];
import {CATALOG,SHOP_CATALOG,FOCUS_YAKU,itemById} from './catalog.js';
export {CATALOG};
export const CHAPTERS=3;
export const meldCount=s=>s.chapter+1;
export const ROUND_TARGETS=[[280,380],[500,620],[750,900]];
export const bossFor=(s,chapter=s.chapter)=>BOSSES.find(b=>b.id===(s.bossOrder||bossOrder(s.seed))[chapter-1]);
export const roundTarget=(chapter,round,boss=null)=>Math.round(ROUND_TARGETS[chapter-1][round-1]*(boss?.id==='heavy'?.9:1));
const hash=s=>{let n=2166136261;for(const ch of s)n=Math.imul(n^ch.charCodeAt(0),16777619);return n>>>0;};
export function random(s){s.rng=(s.rng+0x6D2B79F5)>>>0;let t=s.rng;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}
function shuffle(a,s){for(let i=a.length-1;i>0;i--){const j=Math.floor(random(s)*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const bossOrder=seed=>shuffle(BOSSES.map(b=>b.id),{rng:hash(seed+'|boss-order-v23')});
const note=(s,message)=>{s.message=message;s.log.push({chapter:s.chapter,round:s.round,turn:s.turn,phase:s.phase,message});if(s.log.length>1500)s.log.shift();};
const removeIds=(a,ids)=>{const set=new Set(ids),take=a.filter(x=>set.has(x.id));a.splice(0,a.length,...a.filter(x=>!set.has(x.id)));return take;};
function riichiEvent(s,kind,tiles){if(s.riichiRun&&tiles.length)s.riichiRun.events.push({kind,tiles:structuredClone(tiles),turn:s.riichiDraws,remaining:s.wall.length});}
export const floorCapacity=s=>s.equipment.includes('wideFloor')?6:5;
export const consumableCapacity=s=>s.equipment.includes('pocket')?3:2;
export const consumableCount=s=>Object.values(s.tools).reduce((n,t)=>n+t.left,0);
function stockFloor(s){
 s.floor=s.wall.splice(Math.max(0,s.wall.length-floorCapacity(s)),floorCapacity(s));
 s.floor.forEach((t,i)=>t.floorSlot=i);s.floorSlots=floorCapacity(s);s.blockedFloor=null;s.recipeTriggers=[];
 if(s.boss?.id==='narrow'&&s.floor.length){s.blockedFloor={...s.floor.pop()};s.discards.push({...s.blockedFloor});}
 const rng={rng:hash(s.seed+'|recipes|'+s.chapter+'|'+s.round+'|'+s.handNo)};
 const copies=Object.keys(s.recipes).sort().flatMap(id=>Array(s.recipes[id]).fill(id));
 for(const id of shuffle(copies,rng)){
  const recipe=itemById(id);if(recipe?.kind!=='recipe')continue;
  const candidates=s.floor.filter(t=>(recipe.utility||!t.special||t.special===recipe.special)&&(!recipe.numeric||t.type<27)&&(!recipe.dragonsOnly||t.type>=31)&&(id!=='patternMirror'||t.type%9!==4));
  if(!candidates.length){s.recipeTriggers.push({id,applied:false});continue;}
  const fresh=candidates.filter(t=>!(t.floorEffects||[]).includes(id)),pool=fresh.length?fresh:candidates;
  const tile=pool[Math.floor(random(rng)*pool.length)];
  (tile.floorEffects??=[]).push(id);if(recipe.special)tile.special=recipe.special;
  s.recipeTriggers.push({id,tile:tile.id,applied:true});
 }
}

const fail=(s,why)=>{s.phase='failed';s.reason=why;note(s,why);};
export function newGame(options={}){
 const config={...DEFAULTS,...options};config.excluded=Math.max(0,Math.min(18,Math.floor(Number(config.excluded)||0)));config.roundsPerChapter=2;
 config.priceMode=config.priceMode==='feel'?'feel':'balanced';
 const seed=String(options.seed||Date.now().toString(36));
 const s={version:27,seed,rng:hash(seed),config,chapter:1,round:1,coins:12,tools:{},recipes:{},recipeOffers:[],equipment:[],moneyHistory:[],packOffers:[],pendingPack:null,rerolls:0,stats:{wins:0,best:0,rounds:0},records:[],log:[],offers:[],phase:'action'};
 s.bossOrder=bossOrder(seed);
 startRound(s);return s;
}
export function startRound(s){
 s.config.roundsPerChapter=2;s.isBoss=s.round===2;s.boss=s.isBoss?bossFor(s):null;
 s.target=roundTarget(s.chapter,s.round,s.boss);
 s.score=0;s.purseEarned=0;s.turn=0;s.handNo=0;s.hand=[];s.floor=[];s.locked=[];s.discards=[];s.indicators=[];s.ura=[];s.uraRevealed=false;s.uraKnown=0;s.lastResult=null;
 s.wall=[];for(let type=0;type<34;type++)for(let copy=0;copy<4;copy++)s.wall.push({id:`${s.chapter}-${s.round}-${type}-${copy}`,type,original:type,red:!!s.config.red&&[4,13,22].includes(type)&&copy===0});
 shuffle(s.wall,s);s.excluded=s.wall.splice(0,s.config.excluded);s.indicators.push(s.wall.pop());s.ura.push(s.wall.pop());

 newHand(s);note(s,`${s.chapter}챕터 ${s.round}라운드 · 목표 ${s.target}점. 비공개 ${s.excluded.length}장 제외.`);
}
function newHand(s){
 s.riichiRun=null;s.hand=[];s.locked=[];s.floor=[];s.blockedFloor=null;s.riichi=false;s.riichiDraws=0;s.ippatsuBroken=false;s.rinshan=false;s.handNo++;
 const n=meldCount(s)*3+1;
 if(s.wall.length<n+1+floorCapacity(s)){fail(s,'새 손과 바닥패를 배치할 패가 부족합니다.');return;}
 s.hand=s.wall.splice(s.wall.length-n,n);stockFloor(s);draw(s,false);
}
function draw(s,replacement=false){
 if(!s.wall.length){fail(s,'패산 소진 · 목표 점수에 도달하지 못했습니다.');return;}
 const t=s.wall.pop();s.hand.push(t);s.drawn=t.id;s.drawIntegrated=false;s.rinshan=replacement;s.phase='action';
 if(!replacement){s.turn++;if(s.riichi)s.riichiDraws++;}
 note(s,`${replacement?'보충패':'쯔모'} · ${tileName(t.type)}${s.riichi?` · 리치 후 ${s.riichiDraws}장`:''}`);
}
function revealFloor(s){
 s.phase='floor';s.rinshan=false;
 note(s,s.riichi?'리치 · 바닥패는 잠깁니다. 다음 쯔모로 진행합니다.':'바닥패를 선택해 론·울기, 또는 그대로 두고 다음 쯔모.');
}
export function scoring(s,source='tsumo',floorId=null,preview=false){
 if(source==='ron'&&s.riichi)return null;
 let hand=s.hand;if(source==='ron'){const x=s.floor.find(t=>t.id===floorId);if(!x)return null;hand=[...hand,x];}
 const winTile=source==='ron'?s.floor.find(x=>x.id===floorId):s.hand.find(x=>x.id===s.drawn)||s.hand.at(-1);
 return evaluate(hand,meldCount(s),s.locked,{source,winType:winTile?.type,winId:winTile?.id,riichi:s.riichi,ippatsu:s.riichi&&!s.ippatsuBroken&&s.riichiDraws<=4,rinshan:s.rinshan,indicators:s.indicators,ura:preview?s.ura.slice(0,s.uraKnown||0):s.ura,riichiMisses:s.riichiRun?.misses||0,equipment:s.equipment,focus:s.focus,floor:s.floor.filter(t=>t.id!==floorId),boss:s.boss?.id});
}
export function optionsFor(s){
 const result={tsumo:null,ron:[],calls:[],kans:[],riichi:[]};
 if(s.phase==='action'){result.tsumo=scoring(s,'tsumo',null,true);if(!s.riichi){result.riichi=riichiOptions(s.hand,meldCount(s),s.locked);if(canKan(s))result.kans=ownKanOptions(s.hand,s.locked,meldCount(s));}}
 if(s.phase==='floor'&&!s.riichi)for(const tile of s.floor){const score=scoring(s,'ron',tile.id,true);if(score?.valid)result.ron.push({tile,score});if(!s.riichi)result.calls.push(...callOptions(s.hand,tile,meldCount(s),s.locked).filter(x=>x.kind!=='daiminkan'||canKan(s)));}
 return result;
}
export const canKan=s=>s.indicators.length<5&&s.wall.length>=3&&!s.riichi;
function fixedTiles(tiles,types){
 const used=new Set(),assigned=[];
 function match(i){if(i===tiles.length)return true;for(let j=0;j<types.length;j++)if(!used.has(j)&&domains(tiles[i]).includes(types[j])){used.add(j);assigned[i]=types[j];if(match(i+1))return true;used.delete(j);}return false;}
 if(!match(0))throw Error('고정 몸통의 속성 배치가 일치하지 않습니다.');return tiles.map((t,i)=>({...t,lockedAs:assigned[i]}));
}
function kanExtra(s){s.indicators.push(s.wall.pop());s.ura.push(s.wall.pop());s.ippatsuBroken=true;draw(s,true);note(s,`깡 · 도라 표시패 ${s.indicators.length}개. 보충패를 받고 진행합니다.`);}
function money(s,delta,reason,item=null){s.coins+=delta;(s.moneyHistory??=[]).push({chapter:s.chapter,round:s.round,hand:s.handNo,turn:s.turn,delta,balance:s.coins,reason,item});}
function win(s,source,floorId){
 if(source==='tsumo'&&s.phase!=='action'||source==='ron'&&s.phase!=='floor')throw Error('지금은 화료할 수 없습니다.');
 const result=scoring(s,source,floorId);if(!result?.valid)throw Error('올바른 완성형이 아닙니다.');
 const physical=[...s.hand,...s.locked.flatMap(g=>g.tiles),...(source==='ron'?[s.floor.find(x=>x.id===floorId)]:[])];
 if(s.riichi)riichiEvent(s,source==='ron'?'winningFloor':'winningDraw',source==='ron'?s.floor:[s.hand.find(x=>x.id===s.drawn)]);
 const chase=s.riichiRun?{...structuredClone(s.riichiRun),consumed:s.riichiRun.startWall-s.wall.length,draws:s.riichiDraws}:null;
 const loose=source==='ron'?[...s.hand,s.floor.find(t=>t.id===floorId)]:s.hand;
 s.lastResult={...result,source,chase,hand:structuredClone(physical),layout:winningLayout(loose,meldCount(s),s.locked),floorBefore:structuredClone(s.floor),recipeTriggers:structuredClone(s.recipeTriggers),menzen:!s.locked.some(g=>g.open&&!g.stealth),riichi:s.riichi};
 if(s.equipment.includes('purse')&&(s.purseEarned||0)<6){money(s,2,'화료 수입','purse');s.purseEarned=(s.purseEarned||0)+2;}
 if(s.equipment.includes('focus')&&s.focus?.target&&result.yaku.some(y=>y.name===s.focus.target)){s.focus.bonus+=10;s.lastResult.effects.push(`한 우물 성장 · 다음 +${s.focus.bonus}기본점`);}
 s.score+=result.score;s.stats.wins++;s.stats.best=Math.max(s.stats.best,result.score);
 if(s.riichi){s.uraRevealed=true;s.uraKnown=s.ura.length;}
 s.records.push({chapter:s.chapter,round:s.round,boss:s.boss?.id||null,target:s.target,hand:s.handNo,turn:s.turn,source,score:result.score,base:result.base,mult:result.mult,effects:result.effects.slice(),equipment:s.equipment.slice(),recipes:{...s.recipes},recipeTriggers:structuredClone(s.recipeTriggers),yaku:result.yaku.map(y=>y.name),remaining:s.wall.length,rig:result.rig});
 s.discards.push(...s.hand,...s.locked.flatMap(g=>g.tiles),...s.floor);s.hand=[];s.locked=[];s.floor=[];
 s.riichi=false;s.riichiDraws=0;s.ippatsuBroken=false;s.rinshan=false;s.drawn=null;s.phase='result';
 note(s,`${source==='ron'?'론':'쯔모'} · ${result.score}점 · 라운드 ${s.score}/${s.target}`);
}
export function price(s,item){if(item.kind==='recipe'||s.config.priceMode==='feel')return 1;return Math.max(1,item.price-(s.equipment.includes('discount')?1:0));}
export function eligible(s,item){
 if(!item)return false;
 if(item.finalStage&&s.chapter<CHAPTERS&&!(s.chapter===CHAPTERS-1&&s.isBoss))return false;
 if(item.kind==='recipe')return true;
 if(item.kind==='consumable')return consumableCount(s)<consumableCapacity(s);
 if(item.kind==='gear')return !s.equipment.includes(item.id)&&s.equipment.length<5;
 if(item.kind==='pack')return SHOP_CATALOG.some(x=>x.kind===item.pool&&eligible(s,x));
 return false;
}
export const sellValue=s=>s.config.priceMode==='feel'?0:3;
export const rerollCost=s=>s.config.priceMode==='feel'?1:(s.equipment.includes('rerollPass')?1:2)+s.rerolls;
function recipeStock(s,skip=null){return shuffle(SHOP_CATALOG.filter(x=>x.kind==='recipe'&&x.id!==skip&&!s.recipeOffers.includes(x.id)).map(x=>x.id),s)[0];}
function offers(s,fresh=false){
 const gears=shuffle(SHOP_CATALOG.filter(x=>x.kind==='gear'&&eligible(s,x)).map(x=>x.id),s).slice(0,2);
 const tools=shuffle(SHOP_CATALOG.filter(x=>x.kind==='consumable').map(x=>x.id),s).slice(0,1);
 s.offers=[...gears,...tools];
 if(fresh){s.rerolls=0;s.pendingPack=null;s.recipeOffers=[];for(let i=0;i<3;i++)s.recipeOffers.push(recipeStock(s));s.packOffers=['gearPack','toolPack'];}
}
function acquire(s,item){
 if(!eligible(s,item))throw Error('보유 한도입니다. 장비는 5개, 소모품은 기본 2개입니다.');
 if(item.kind==='recipe')s.recipes[item.id]=(s.recipes[item.id]||0)+1;
 else if(item.kind==='consumable'){if(s.tools[item.id])s.tools[item.id].left++;else s.tools[item.id]={left:1};}
 else if(item.kind==='gear'){s.equipment.push(item.id);if(item.id==='focus')s.focus={target:null,bonus:20};}
}
export function riichiAction(s){
 if(!s.riichi)return null;
 const o=optionsFor(s);
 if(s.phase==='action')return o.tsumo?.valid?{action:'tsumo'}:{action:'discard',payload:{id:s.drawn}};
 if(s.phase==='floor'){const ron=o.ron.slice().sort((a,b)=>b.score.score-a.score.score)[0];return ron?{action:'ron',payload:{id:ron.tile.id}}:{action:'draw'};}
 return null;
}
export const riichiDelay=s=>Math.max(180,Math.round(1050*Math.pow(.82,s.riichiRun?.misses||0)));
export function act(s,action,payload={}){
 if(action==='discard'||action==='riichi'){
  if(!['action','callDiscard'].includes(s.phase))throw Error('버릴 패를 선택할 차례가 아닙니다.');
  const tile=s.hand.find(x=>x.id===payload.id);if(!tile)throw Error('손패를 선택하세요.');
  if(s.riichi&&tile.id!==s.drawn)throw Error('리치 후에는 새로 뽑은 패만 버릴 수 있습니다.');
  if(action==='riichi'){if(s.phase!=='action'||s.riichi||!riichiOptions(s.hand,meldCount(s),s.locked).some(o=>o.id===tile.id))throw Error('이 패를 버리면 멘젠 텐파이가 되지 않습니다.');s.riichi=true;s.riichiDraws=0;s.ippatsuBroken=false;s.riichiRun={startWall:s.wall.length,misses:0,events:[]};}
  if(s.riichi&&action==='discard'){s.riichiRun.misses++;riichiEvent(s,'tsumogiri',[tile]);}
  const afterCall=s.phase==='callDiscard';s.discards.push(...removeIds(s.hand,[tile.id]));s.drawn=null;s.drawIntegrated=false;
  if(afterCall)draw(s);else revealFloor(s);
  if(action==='riichi')note(s,'리치 선언 · 손패 고정. 일반 쯔모 4장 이내 일발 기회.');
 }else if(action==='draw'){
  if(s.phase!=='floor')throw Error('바닥패 확인 후 다음 쯔모를 받을 수 있습니다.');draw(s);
 }else if(action==='call'){
  if(s.phase!=='floor'||s.riichi)throw Error('지금은 울 수 없습니다.');
  const legal=optionsFor(s).calls.find(o=>o.take===payload.take&&o.kind===payload.kind&&o.ids.join(',')===payload.ids.join(',')&&o.t===payload.t);if(!legal)throw Error('울기 조건이 충족되지 않습니다.');
  const claimed=s.floor.find(t=>t.id===legal.take),stealth=legal.kind!=='daiminkan'&&claimed.floorEffects?.includes('patternHidden');
  const refill=claimed.floorEffects?.includes('patternRefill'),slot=claimed.floorSlot;
  const parts=[...removeIds(s.hand,legal.ids),...removeIds(s.floor,[legal.take])];
  s.locked.push({kind:legal.kind==='chi'?'sequence':legal.kind==='pon'?'triplet':'kan',t:legal.t,types:legal.types,tiles:fixedTiles(parts,legal.types),open:true,stealth:!!stealth});
  s.ippatsuBroken=true;
  if(s.boss?.id==='toll'){const available=Math.max(0,s.wall.length-(legal.kind==='daiminkan'?3:0));s.discards.push(...s.wall.splice(Math.max(0,s.wall.length-Math.min(2,available)),Math.min(2,available)));}
  if(refill&&s.wall.length>(legal.kind==='daiminkan'?3:0)){const next=s.wall.pop();next.floorSlot=slot;s.floor.push(next);}
  if(legal.kind==='daiminkan')kanExtra(s);else{s.phase='callDiscard';note(s,`${legal.kind==='chi'?'치':'퐁'} · 몸통 고정. 1장을 버리면 다음 쯔모를 받습니다.`);}
 }else if(action==='sleeve'){
  if(s.phase!=='floor'||s.riichi)throw Error('소매 교환은 리치 전 바닥패 단계에서만 가능합니다.');
  const tile=s.floor.find(t=>t.id===payload.take),index=s.hand.findIndex(t=>t.id===payload.id);
  if(!tile?.floorEffects?.includes('patternSleeve')||index<0)throw Error('소매 바닥패와 교환할 손패를 선택하세요.');
  const previous=s.hand[index].id;s.discards.push(s.hand[index]);s.hand[index]=removeIds(s.floor,[tile.id])[0];
  if(s.handOrder)s.handOrder=s.handOrder.map(id=>id===previous?tile.id:id);
  s.drawn=null;s.drawIntegrated=false;note(s,'소매 교환 · 손패 1장 버림, 멘젠 유지. 다음 쯔모 또는 남은 바닥패를 선택하세요.');
 }else if(action==='kan'){
  if(s.phase!=='action'||!canKan(s))throw Error('지금은 깡을 할 수 없습니다.');
  const legal=ownKanOptions(s.hand,s.locked,meldCount(s)).find(o=>o.kind===payload.kind&&o.ids.join(',')===payload.ids.join(',')&&o.t===payload.t);if(!legal)throw Error('깡 조건이 충족되지 않습니다.');
  const parts=removeIds(s.hand,legal.ids);
  if(legal.kind==='ankan')s.locked.push({kind:'kan',t:legal.t,types:legal.types,tiles:fixedTiles(parts,legal.types),open:false});
  else{const g=s.locked[legal.index];g.stealth=false;g.kind='kan';g.types.push(g.t);g.tiles.push({...parts[0],lockedAs:g.t});}
  kanExtra(s);
 }else if(action==='tsumo')win(s,'tsumo');
 else if(action==='ron')win(s,'ron',payload.id);
 else if(action==='tool'){
  if(!['action','floor'].includes(s.phase)||s.riichi)throw Error('현재는 조작할 수 없습니다. 리치 후와 울기 직후에는 잠깁니다.');
  const tool=s.tools[payload.tool],area=payload.area==='floor'?s.floor:s.hand,tile=area.find(x=>x.id===payload.id);
  if(!tool||tool.left<1||!tile)throw Error('소모품과 손패 또는 바닥패를 선택하세요.');
  if(payload.tool==='wind'){if(tile.special==='wind')throw Error('이미 사풍패입니다.');tile.special='wind';}
  else if(payload.tool==='dual'){if(tile.type>=27||tile.special==='dual')throw Error('겹무늬가 없는 숫자패를 선택하세요.');tile.special='dual';}
  else if(payload.tool==='shift'){if(tile.type>=27)throw Error('숫자패를 선택하세요.');tile.type=Math.floor(tile.type/9)*9+(tile.type%9+1)%9;if(!tile.special)tile.special='shift';}
  else if(payload.tool==='exchange'){
   if(!s.wall.length)throw Error('교체할 패산이 없습니다.');const index=area.indexOf(tile);s.discards.push(tile);const next=s.wall.pop();next.special='exchange';
   if(payload.area==='floor')next.floorSlot=tile.floorSlot;area[index]=next;if(s.drawn===tile.id)s.drawn=next.id;
  }else throw Error('지원하지 않는 소모품입니다.');
  if(['wind','dual'].includes(payload.tool))delete tile.floorEffects;
  tool.left--;if(!tool.left)delete s.tools[payload.tool];note(s,`${itemById(payload.tool).name} 사용 · 소모품 1개 소비.`);
 }else if(action==='continue'){
  if(s.phase!=='result')throw Error('먼저 화료 결과를 확인하세요.');
  if(s.score>=s.target){s.stats.rounds++;if(s.chapter===CHAPTERS&&s.isBoss){s.phase='won';note(s,'3챕터 보스 격파 · 도전 성공!');}else{s.phase='shop';s.reward=6+s.chapter*2+(s.isBoss?2:0);money(s,s.reward,'라운드 보상');offers(s,true);note(s,`라운드 통과 · ${s.reward}냥 보상. 다음 라운드를 준비하세요.`);}}
  else newHand(s);
 }else if(action==='chooseFocus'){
  if(s.phase!=='shop'||!s.equipment.includes('focus')||s.focus?.target||!FOCUS_YAKU.includes(payload.target))throw Error('지금은 한 우물 목표를 선택할 수 없습니다.');
  s.focus={target:payload.target,bonus:20};note(s,`한 우물 목표 · ${payload.target}`);
 }else if(action==='buy'){
  if(s.phase!=='shop'||s.pendingPack||!s.offers.includes(payload.id)&&!s.recipeOffers.includes(payload.id))throw Error('지금 살 수 없는 품목입니다.');
  const item=itemById(payload.id);if(!eligible(s,item))throw Error('보유 한도 또는 강화 한도입니다.');const cost=price(s,item);if(s.coins<cost)throw Error('자금이 부족합니다.');
  acquire(s,item);money(s,-cost,'상품 구매',item.id);s.offers=s.offers.filter(id=>id!==item.id);if(item.kind==='recipe'){const index=s.recipeOffers.indexOf(item.id);s.recipeOffers.splice(index,1);s.recipeOffers.splice(index,0,recipeStock(s,item.id));}note(s,`${item.name} 구매.`);
 }else if(action==='openPack'){
  if(s.phase!=='shop'||s.pendingPack||!s.packOffers.includes(payload.id))throw Error('지금 열 수 없는 팩입니다.');
  const pack=itemById(payload.id);if(!eligible(s,pack))throw Error('팩에서 얻을 품목의 보유칸 또는 강화 여유가 없습니다.');const cost=price(s,pack);if(s.coins<cost)throw Error('자금이 부족합니다.');
  money(s,-cost,'팩 구매',pack.id);s.packOffers=s.packOffers.filter(x=>x!==pack.id);s.pendingPack={id:pack.id,choices:shuffle(SHOP_CATALOG.filter(x=>x.kind===pack.pool&&eligible(s,x)).map(x=>x.id),s).slice(0,3)};note(s,`${pack.name} 개봉 · 1개를 선택하세요.`);
 }else if(action==='pickPack'){
  if(s.phase!=='shop'||!s.pendingPack?.choices.includes(payload.id))throw Error('팩에서 공개된 품목을 선택하세요.');
  const item=itemById(payload.id);acquire(s,item);s.pendingPack=null;note(s,`${item.name} 획득 · 추가 비용 없음.`);
 }else if(action==='skipPack'){
  if(s.phase!=='shop'||!s.pendingPack)throw Error('열린 팩이 없습니다.');s.pendingPack=null;note(s,'팩 선택 포기 · 구매 비용은 반환하지 않습니다.');
 }else if(action==='sell'){
  if(s.phase!=='shop'||s.pendingPack)throw Error('상점에서만 정리할 수 있습니다.');if(payload.id==='pocket'&&consumableCount(s)>2)throw Error('소모품을 2개 이하로 줄인 뒤 넓은 소매를 정리하세요.');if(s.equipment.includes(payload.id))s.equipment=s.equipment.filter(x=>x!==payload.id);else throw Error('장비만 판매할 수 있습니다.');if(payload.id==='focus')s.focus=null;money(s,sellValue(s),'판매',payload.id);note(s,`보유 항목 정리 · ${sellValue(s)}냥 회수.`);
 }else if(action==='reroll'){
  if(s.phase!=='shop'||s.pendingPack||s.coins<rerollCost(s))throw Error('재진열 자금이 부족하거나 팩 선택 중입니다.');money(s,-rerollCost(s),'재진열');s.rerolls++;offers(s);note(s,'상점 재진열.');
 }else if(action==='nextRound'){
  if(s.equipment.includes('focus')&&!s.focus?.target)throw Error('한 우물의 목표 역을 먼저 선택하세요.');
  if(s.phase!=='shop'||s.pendingPack)throw Error('정비가 끝난 뒤 진행하세요.');s.round++;if(s.round>s.config.roundsPerChapter){s.chapter++;s.round=1;}startRound(s);
 }else throw Error('알 수 없는 행동입니다.');
 return s;
}
export function inventory(s){return [...s.wall,...s.excluded,...s.indicators,...s.ura,...s.hand,...s.floor,...s.locked.flatMap(g=>g.tiles),...s.discards];}
export function assertState(s){const all=inventory(s);if(all.length!==136||new Set(all.map(x=>x.id)).size!==136)throw Error(`패 보존 오류: ${all.length}장`);if(s.locked.length>meldCount(s))throw Error('몸통 수 초과');if(['action','floor','callDiscard'].includes(s.phase)){const expected=3*(meldCount(s)-s.locked.length)+(s.phase==='floor'?1:2);if(s.hand.length!==expected)throw Error(`손패 장수 오류 ${s.hand.length}/${expected} ${s.phase}`);}return true;}
// Deterministic practice hands use real tiles from the same round pool.
export function practice(name,config={}){
 const s=newGame({...config,seed:`practice-${name}`});s.practice=name;s.tools={wind:{left:1},shift:{left:1}};
 const patterns={ron:{hand:[1,2,4,4],floor:[3,8,18],phase:'floor'},riichi:{hand:[1,2,4,4,27],floor:[],phase:'action'},kan:{hand:[4,4,4,7],floor:[4,8,18],phase:'floor'},ankan:{hand:[4,4,4,4,7],floor:[],phase:'action'},kakan:{hand:[4,7],floor:[],phase:'action',locked:[4,4,4]},overlap:{hand:[0,0,1,1,2,2,3,3,4,4,5,5,6,6],floor:[],phase:'action',chapter:3}};
 const p=patterns[name==='chase'?'riichi':name]||patterns.ron;s.chapter=p.chapter||1;
 const pool=inventory(s);s.wall=[];s.excluded=[];s.indicators=[];s.ura=[];s.hand=[];s.floor=[];s.locked=[];s.discards=[];
 const take=t=>{const i=pool.findIndex(x=>x.type===t);if(i<0)throw Error('연습 패 부족');return pool.splice(i,1)[0];};
 s.hand=(p.chapter===3?p.hand:[9,10,11,...p.hand]).map(take);s.floor=p.floor.map(take);while(s.floor.length<5)s.floor.push(take([8,17,26,30,31][s.floor.length]));s.floor.forEach((t,i)=>t.floorSlot=i);s.floorSlots=5;
 if(p.locked){const tiles=p.locked.map(take);s.locked=[{kind:'triplet',t:4,types:p.locked,tiles,open:true}];}
 s.indicators=[take(31)];s.ura=[take(32)];s.wall=pool;s.phase=p.phase;s.drawn=s.hand.at(-1)?.id;s.target=99999;
 if(name==='riichi'||name==='chase'){const winning=take(3);if(name==='chase'){const scripted=[20,21,22,23,24,25];s.wall.push(winning,...scripted.map(take).reverse());}else s.wall.push(winning);}
 s.excluded=pool.splice(0,6);
 if(name.startsWith('boss-')){s.round=2;s.isBoss=true;s.boss=BOSSES.find(b=>b.id===name.slice(5));if(!s.boss)throw Error('알 수 없는 보스 연습');if(s.boss.id==='narrow'){s.blockedFloor={...s.floor.pop()};s.discards.push(s.blockedFloor);}}
 if(name==='recipes'){
  s.recipes={patternWind:1,patternDual:1,patternDragon:1,patternMirror:1,patternNeighbor:1};
  const ids=['patternMirror','patternDual','patternNeighbor','patternWind','patternDragon'];
  s.floor.forEach((t,i)=>{t.special=itemById(ids[i]).special;t.floorEffects=[ids[i]];});
  // 7-man can become the missing 3-man; the player must use the mirror interpretation.
  const swap=s.hand.find(t=>t.type===2),incoming=take(3);s.hand[s.hand.indexOf(swap)]=incoming;s.wall.push(swap);
  const floor=s.floor[0],replacement=take(6);s.wall.push(floor);replacement.floorSlot=0;replacement.special='mirror';replacement.floorEffects=['patternMirror'];s.floor[0]=replacement;
  s.recipeTriggers=s.floor.flatMap(t=>(t.floorEffects||[]).map(id=>({id,tile:t.id,applied:true})));
 }
 if(name==='effects27'){
  s.recipes={patternTriad:1,patternAdjacent:1,patternDragon:1,patternSleeve:1,patternHidden:1,patternRefill:1};
  s.floor[0].floorEffects=['patternHidden','patternRefill'];
  s.floor[1].floorEffects=['patternSleeve','patternTriad'];s.floor[1].special='triad';
  s.floor[2].floorEffects=['patternAdjacent'];s.floor[2].special='adjacent';
  const old=s.floor[4],dragon=take(33);s.wall.push(old);dragon.floorSlot=4;dragon.special='dragon';dragon.floorEffects=['patternDragon'];s.floor[4]=dragon;
  s.recipeTriggers=s.floor.flatMap(t=>(t.floorEffects||[]).map(id=>({id,tile:t.id,applied:true})));
 }
 if(name==='shop'){s.target=1;s.coins=30;act(s,'ron',{id:optionsFor(s).ron[0].tile.id});act(s,'continue');}
 note(s,'규칙 연습 · 목표 점수 없이 동작을 확인하세요. 도전 진행에는 영향을 주지 않습니다.');assertState(s);return s;
}


// Retain the active run and its physical tiles. Obsolete score recipes refund once.
export function migrateGame(s){
 if(s.version===27)return s;
 if(s.version===25)migrateV25(s);else if(s.version!==26)throw Error('지원하지 않는 저장 버전');
 const active=new Set(SHOP_CATALOG.map(x=>x.id));s.offers=(s.offers||[]).filter(id=>active.has(id));s.recipeOffers=(s.recipeOffers||[]).filter(id=>active.has(id));
 const recipes=SHOP_CATALOG.filter(x=>x.kind==='recipe').map(x=>x.id);while(s.recipeOffers.length<3)s.recipeOffers.push(recipes.find(id=>!s.recipeOffers.includes(id)));
 // Already-paid packs keep their choices and old holdings remain usable.
 s.version=27;return s;
}
function migrateV25(s){
 const old=new Set(['patternGold','patternEcho','patternSeal','patternRisk']);let refund=0;
 for(const id of old){refund+=s.recipes[id]||0;delete s.recipes[id];}
 for(const t of inventory(s))if(t.floorEffects)t.floorEffects=t.floorEffects.filter(id=>!old.has(id));
 s.recipeTriggers=(s.recipeTriggers||[]).filter(x=>!old.has(x.id));
 const ids=SHOP_CATALOG.filter(x=>x.kind==='recipe').map(x=>x.id);s.recipeOffers=(s.recipeOffers||[]).filter(id=>ids.includes(id));
 while(s.recipeOffers.length<3)s.recipeOffers.push(ids.find(id=>!s.recipeOffers.includes(id)));
 if(!s.practice&&['action','floor','callDiscard','result'].includes(s.phase))s.target=roundTarget(s.chapter,s.round,s.boss);
 s.version=26;if(refund){money(s,refund,'제거된 점수 도안 환급');note(s,`점수 도안 제거 · ${refund}냥 환급. 속성 도안으로 교체되었습니다.`);}return s;
}
