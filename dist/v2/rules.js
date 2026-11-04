import {CATALOG} from './catalog.js';
export const HONORS=['동','남','서','북','백','발','중'];
export const tileName=t=>t<27?`${t%9+1}${['만','통','삭'][Math.floor(t/9)]}`:HONORS[t-27];
export const nextDora=t=>t<27?Math.floor(t/9)*9+(t%9+1)%9:t<31?27+(t-27+1)%4:31+(t-31+1)%3;
export function domains(x){
 if(x.lockedAs!==undefined)return [x.lockedAs];
 if(x.special==='wind')return [27,28,29,30];
 if(x.special==='dragon')return [31,32,33];
 if(x.type<27){const base=Math.floor(x.type/9)*9,n=x.type%9;
  if(x.special==='triad')return [n,9+n,18+n];
  if(x.special==='adjacent')return [n-1,n,n+1].filter(v=>v>=0&&v<=8).map(v=>base+v);
  if(x.special==='dual')return [n,18+n];
  if(x.special==='mirror')return [...new Set([x.type,base+8-n])];
  if(x.special==='neighbor')return [x.type,base+(n+1)%9];
 }return [x.type];
}

const outside=t=>t>=27||t%9===0||t%9===8;
const terminal=t=>t<27&&(t%9===0||t%9===8);
const counts=ts=>{const c=Array(34).fill(0);for(const t of ts)c[t]++;return c;};
const ORPHANS=[0,8,9,17,18,26,27,28,29,30,31,32,33];
export function decompose(types,n){
  if(types.length!==n*3+2)return [];
  const c=counts(types),out=[];
  function walk(a,gs,p){const t=a.findIndex(x=>x);if(t<0){if(gs.length===n)out.push({pair:p,groups:gs.slice()});return;}if(gs.length>=n)return;
    if(a[t]>=3){a[t]-=3;walk(a,[...gs,{kind:'triplet',t,open:false}],p);a[t]+=3;}
    if(t<27&&t%9<=6&&a[t+1]&&a[t+2]){a[t]--;a[t+1]--;a[t+2]--;walk(a,[...gs,{kind:'sequence',t,open:false}],p);a[t]++;a[t+1]++;a[t+2]++;}
  }
  for(let p=0;p<34;p++)if(c[p]>=2){const a=c.slice();a[p]-=2;walk(a,[],p);}return out;
}
function assignments(tiles,fn){const a=[];function step(i){if(i===tiles.length){return fn(a.slice());}for(const t of domains(tiles[i])){a.push(t);if(step(i+1)===true)return true;a.pop();}return false;}return step(0);}
function structures(types,chapter,locked){
  const c=counts(types),out=decompose(types,chapter-locked.length);
  if(chapter===4&&!locked.length&&types.length===14){if(c.filter(n=>n===2).length===7)out.push({special:'pairs',groups:[]});if(ORPHANS.every(t=>c[t])&&c.every((n,t)=>!n||ORPHANS.includes(t)))out.push({special:'orphans',groups:[]});}return out;
}
export function validHand(hand,chapter,locked=[]){let yes=false;if(locked.length>chapter)return false;assignments(hand,ts=>{if(structures(ts,chapter,locked).length){yes=true;return true;}return false;});return yes;}
export function winningLayout(hand,chapter,locked=[]){
 const tiles=hand.slice().sort((a,b)=>a.type-b.type||String(a.id).localeCompare(String(b.id)));let layout=null;
 assignments(tiles,ts=>{
  const forms=structures(ts,chapter,locked);if(!forms.length)return false;
  const form=forms.find(f=>!f.special)||forms[0];if(form.special&&layout)return false;
  const pool=tiles.map((t,i)=>({...t,resolvedAs:ts[i]}));
  const take=types=>types.map(type=>{const i=pool.findIndex(t=>t.resolvedAs===type);if(i<0)throw Error('화료 표시 배치 오류');return pool.splice(i,1)[0];});
  let groups;
  if(!form.special){groups=form.groups.map(g=>({kind:g.kind,open:false,tiles:take(g.kind==='sequence'?[g.t,g.t+1,g.t+2]:[g.t,g.t,g.t])}));groups.push(...locked.map(g=>({kind:g.kind,open:g.open,tiles:g.tiles.map(t=>({...t,resolvedAs:t.lockedAs??t.type}))})));groups.sort((a,b)=>a.tiles[0].resolvedAs-b.tiles[0].resolvedAs);groups.push({kind:'pair',tiles:take([form.pair,form.pair])});}
  else if(form.special==='pairs')groups=[...new Set(ts)].sort((a,b)=>a-b).map(t=>({kind:'pair',tiles:take([t,t])}));
  else groups=[{kind:'orphans',tiles:pool.splice(0).sort((a,b)=>a.resolvedAs-b.resolvedAs)}];
  layout={kind:form.special||'normal',groups};return !form.special;
 });return layout;
}
export function waits(hand,chapter,locked=[]){if(hand.length!==3*(chapter-locked.length)+1)return [];return Array.from({length:34},(_,type)=>type).filter(type=>validHand([...hand,{type}],chapter,locked));}
export function riichiOptions(hand,chapter,locked=[]){if(locked.some(g=>g.open&&!g.stealth))return [];return hand.map((x,i)=>({id:x.id,waits:waits(hand.filter((_,j)=>j!==i),chapter,locked)})).filter(x=>x.waits.length);}
export function callOptions(hand,tile,chapter,locked=[]){
  if(locked.length>=chapter)return [];
  const out=[],seen=new Set();
  const put=(kind,indices,types,t)=>{const key=kind+':'+indices.join(',')+':'+types.join(',');if(seen.has(key))return;seen.add(key);out.push({kind,ids:indices.map(i=>hand[i].id),take:tile.id,types,t});};
  for(const t of domains(tile)){
    const matches=hand.map((x,i)=>domains(x).includes(t)?i:-1).filter(i=>i>=0);
    for(let a=0;a<matches.length;a++)for(let b=a+1;b<matches.length;b++){put('pon',[matches[a],matches[b]],[t,t,t],t);for(let c=b+1;c<matches.length;c++)put('daiminkan',[matches[a],matches[b],matches[c]],[t,t,t,t],t);}
    if(t<27)for(let start=Math.max(Math.floor(t/9)*9,t-2);start<=t&&start%9<=6;start++){const need=[start,start+1,start+2].filter(x=>x!==t);for(let i=0;i<hand.length;i++)if(domains(hand[i]).includes(need[0]))for(let j=0;j<hand.length;j++)if(i!==j&&domains(hand[j]).includes(need[1]))put('chi',[i,j],[start,start+1,start+2],start);}
  }return out;
}
export function ownKanOptions(hand,locked,chapter){
  const out=[];
  if(locked.length<chapter)for(let t=0;t<34;t++){const m=hand.filter(x=>domains(x).includes(t));if(m.length>=4)out.push({kind:'ankan',ids:m.slice(0,4).map(x=>x.id),types:[t,t,t,t],t});}
  locked.forEach((g,index)=>{if(g.kind==='triplet'&&g.open)for(const x of hand)if(domains(x).includes(g.t))out.push({kind:'kakan',ids:[x.id],index,t:g.t});});return out;
}
export const YAKU_HELP=[
 ['완성 기본점','몸통은 챕터 수만큼 + 같은 패 머리. 역이 없어도 득점.'],['멘젠쯔모','울지 않은 상태에서 쯔모로 완성. 암깡은 멘젠 유지.'],['리치 / 일발','멘젠 텐파이에서 선언. 선언 후 일반 쯔모 4장 이내 화료는 일발. 리치 후 바닥패 사용 불가.'],
 ['탕야오','1·9·글자패 없이 완성.'],['혼일색 / 청일색','숫자패 한 종류와 글자패 / 숫자패 한 종류만. 작은 손에도 적용.'],['역패','백·발·중 각자. 동풍은 자풍·장풍으로 각각 가산.'],
 ['또이또이','몸통 2개 이상이며 모든 몸통이 각자·깡. 축약 규칙.'],['이페코 / 량페코','멘젠에서 동일 순자 두 개 / 동일 순자 두 쌍. 서로 다른 이름이므로 둘 다 가산.'],['일기통관 / 삼색동순','같은 종류 123·456·789 / 세 종류의 같은 순자.'],
 ['치또이츠 / 국사무쌍','3챕터에서만. 공개·고정 몸통 없이 성립해야 함.'],['조작패 판정','역마다 가능한 해석을 독립 검사. 한 해석 안에서는 물리적 패 중복 사용 불가. 고정 몸통은 재분해·조작 불가.'],['도라','표시패 다음 패. 각 표시패마다 물리적 패 한 장당 최대 1개. 뒷도라는 공개 후에도 리치 화료에만 적용.']
];
export function evaluate(hand,chapter,locked=[],ctx={}){
 const blank={valid:false,base:0,mult:0,score:0,yaku:[],dora:0,ura:0,red:0,rig:0,effects:[],shapes:[]};
 if(locked.length>chapter)return blank;
 const found=new Map(),shapes=[],open=locked.some(x=>x.open&&!x.stealth);let valid=false;
 const add=(name,weight)=>{if(!found.has(name)||found.get(name).weight<weight)found.set(name,{name,weight});};
 assignments(hand,ts=>{
  const forms=structures(ts,chapter,locked);if(!forms.length)return false;valid=true;
  const full=[...ts,...locked.flatMap(g=>g.types)],c=counts(full),used=c.map((n,t)=>n?t:-1).filter(t=>t>=0),suits=new Set(used.filter(t=>t<27).map(t=>Math.floor(t/9))),honor=used.some(t=>t>=27);
  if(used.every(t=>t<27&&!terminal(t)))add('탕야오',1);
  if(suits.size===1)add(honor?'혼일색':'청일색',honor?(open?2:3):(open?5:6));
  if(used.every(outside))add('혼노두',2);
  if(used.every(t=>t>=27))add('자일색',8);
  if(used.every(terminal))add('청노두',8);
  if(used.every(t=>[19,20,21,23,25,32].includes(t)))add('녹일색',8);
  for(const form of forms){
   if(form.special==='pairs'){add('치또이츠',2);if(!shapes.includes('일곱 쌍'))shapes.push('일곱 쌍');continue;}
   if(form.special==='orphans'){add('국사무쌍',8);if(!shapes.includes('국사무쌍'))shapes.push('국사무쌍');continue;}
   if(!shapes.includes('몸통 + 머리'))shapes.push('몸통 + 머리');
   const groups=[...form.groups,...locked],seq=groups.filter(g=>g.kind==='sequence'),trip=groups.filter(g=>g.kind!=='sequence'),tripTypes=trip.map(g=>g.t),rep=new Map();seq.forEach(g=>rep.set(g.t,(rep.get(g.t)||0)+1));
   for(const t of [31,32,33])if(tripTypes.includes(t))add(`역패 · ${tileName(t)}`,1);
   if(tripTypes.includes(27)){add('자풍 · 동',1);add('장풍 · 동',1);}
   if(chapter>=2&&trip.length===chapter)add('또이또이',2);
   const repeat=[...rep.values()].reduce((n,x)=>n+Math.floor(x/2),0);
   if(!open&&repeat>=1)add('이페코',1);if(!open&&repeat>=2)add('량페코',3);
   if([0,9,18].some(o=>[o,o+3,o+6].every(t=>rep.has(t))))add('일기통관',open?1:2);
   if(Array.from({length:7},(_,i)=>i).some(r=>[r,r+9,r+18].every(t=>rep.has(t))))add('삼색동순',open?1:2);
   if(Array.from({length:9},(_,i)=>i).some(r=>[r,r+9,r+18].every(t=>tripTypes.includes(t))))add('삼색동각',2);
   const dragons=tripTypes.filter(t=>t>=31).length,winds=tripTypes.filter(t=>t>=27&&t<31).length;
   if(dragons===3)add('대삼원',8);if(dragons===2&&form.pair>=31)add('소삼원',2);
   if(winds===4)add('대사희',8);if(winds===3&&form.pair>=27&&form.pair<31)add('소사희',8);
   const win=ctx.winId?ts[hand.findIndex(t=>t.id===ctx.winId)]??ctx.winType:ctx.winType;const canNonTrip=domains({type:win}).some(t=>form.pair===t||seq.some(g=>t>=g.t&&t<=g.t+2));
   const hidden=trip.filter(g=>!g.open).length-(ctx.source==='ron'&&!canNonTrip&&trip.some(g=>!g.open&&g.t===win)?1:0);
   if(hidden>=3)add('삼암각',2);if(hidden===4)add('사암각',8);
   if(seq.length&&outside(form.pair)&&groups.every(g=>g.kind==='sequence'?(g.t%9===0||g.t%9===6):outside(g.t)))add(honor?'찬타':'준찬타',honor?(open?1:2):(open?2:3));
   const kans=groups.filter(g=>g.kind==='kan').length;if(kans>=3)add('삼깡자',2);if(kans===4)add('사깡자',8);
  }
  return false;
 });
 if(!valid)return blank;
 if(!open&&ctx.source==='tsumo')add('멘젠쯔모',1);
 if(ctx.riichi){add('리치',1);if(ctx.ippatsu)add('일발 · 4장',1);}
 if(ctx.rinshan&&ctx.source==='tsumo')add('영상개화',1);
 const physical=[...hand,...locked.flatMap(g=>g.tiles)];
 const doraCount=ind=>ind.reduce((sum,x)=>sum+physical.filter(t=>domains(t).includes(nextDora(x.type))).length,0);
 const dora=doraCount(ctx.indicators||[]),ura=ctx.riichi?doraCount(ctx.ura||[]):0,red=physical.filter(x=>x.red&&domains(x).some(t=>t<27&&t%9===4)).length;
 const rig=physical.filter(t=>t.special||t.floorEffects?.length).length;
  const manual=physical.filter(t=>t.special&&!t.floorEffects?.length).length;
 let base=30+20*chapter,mult=1+[...found.values()].reduce((n,y)=>n+y.weight,0)+dora+ura+red+manual;
 const effects=[];const equipment=ctx.equipment||[];
 const publicCount=locked.filter(g=>g.open).length,recipeCount=physical.filter(t=>t.floorEffects?.length).length;
 if(equipment.includes('open')&&publicCount){mult+=publicCount;effects.push(`공개 수집가 +${publicCount}배율`);}
 if(equipment.includes('rig')&&recipeCount){base+=20*recipeCount;effects.push(`위조 감정사 +${20*recipeCount}기본점`);}
 if(equipment.includes('focus')&&ctx.focus?.target&&found.has(ctx.focus.target)){base+=ctx.focus.bonus;effects.push(`한 우물 · ${ctx.focus.target} +${ctx.focus.bonus}기본점`);}
 for(const book of CATALOG.filter(x=>x.match)){if(equipment.includes(book.id)&&book.match.some(name=>found.has(name))){base+=10;mult+=1;effects.push(`${book.name} · +10기본점 +1배율`);}}
 if(equipment.includes('doraLens')&&dora+ura+red>0){base+=30;effects.push('도라 돋보기 +30기본점');}
 if(equipment.includes('collector')){const bonus=Math.min(6,found.size);mult+=bonus;effects.push(`역 수집가 +${bonus}배율`);}
 if(equipment.includes('purse'))effects.push('복주머니 · 라운드당 최대 6냥');
 if(equipment.includes('overlap')&&shapes.includes('일곱 쌍')&&shapes.includes('몸통 + 머리')){mult*=2;effects.push('겹침의 인장 ×2');}
 if(equipment.includes('patience')&&ctx.riichi){const factor=1+Math.min(4,ctx.riichiMisses||0)*.25;mult*=factor;effects.push(`기다림의 태엽 ×${factor}`);}
 if(equipment.includes('closed')&&!open){mult*=1.5;effects.push('정숙의 부적 ×1.5');}
 if(equipment.includes('complex')&&found.size>=3){mult*=1.5;effects.push('복합 예술 ×1.5');}
 if(ctx.boss==='heavy'){base=Math.floor(base*.8);effects.push('보스: 기본점 ×0.8');}
 return {valid:true,base,mult,score:Math.floor(base*mult),yaku:[...found.values()],dora,ura,red,rig,manual,effects,shapes};
}
