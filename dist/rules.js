// Original browser-local evaluator. No networking, four-copy standard tile set.
export const HONORS = ['동','남','서','북','백','발','중'];
export const ORPHANS = [0,8,9,17,18,26,27,28,29,30,31,32,33];
export const tileName = t => t < 27 ? `${t % 9 + 1}${['만','통','삭'][Math.floor(t/9)]}` : HONORS[t-27];
export const countsOf = tiles => { const c=Array(34).fill(0); for (const x of tiles) c[typeof x==='number'?x:x.type]++; return c; };
const terminal = t => t<27 && (t%9===0 || t%9===8);
const outside = t => t>=27 || terminal(t);
export const nextDora = t => t<27 ? Math.floor(t/9)*9+(t%9+1)%9 : t<31 ? 27+(t-27+1)%4 : 31+(t-31+1)%3;
export function isKokushi(c) { return ORPHANS.every(t=>c[t]>=1) && c.every((n,t)=>!n||ORPHANS.includes(t)); }
export function isChiitoi(c) { return c.filter(n=>n===2).length===7 && c.every(n=>n===0||n===2); }
export function decompositions(c) {
  const found=[];
  function melds(left, groups, pair) {
    let i=left.findIndex(n=>n>0);
    if(i<0) { if(groups.length===4) found.push({pair,groups:groups.map(g=>({...g}))}); return; }
    if(groups.length>=4) return;
    if(left[i]>=3) { left[i]-=3; groups.push({kind:'triplet',t:i}); melds(left,groups,pair); groups.pop(); left[i]+=3; }
    if(i<27 && i%9<=6 && left[i+1] && left[i+2]) {
      left[i]--;left[i+1]--;left[i+2]--; groups.push({kind:'sequence',t:i});
      melds(left,groups,pair); groups.pop(); left[i]++;left[i+1]++;left[i+2]++;
    }
  }
  for(let p=0;p<34;p++) if(c[p]>=2) { const a=c.slice();a[p]-=2;melds(a,[],p); }
  return found;
}
export function validShape(types) {
  if(types.length!==14) return false;
  const c=countsOf(types); if(c.some(n=>n>4)) return false;
  return isKokushi(c)||isChiitoi(c)||decompositions(c).length>0;
}
export function waits(types) {
  if(types.length!==13) return [];
  const c=countsOf(types), out=[];
  for(let t=0;t<34;t++) if(c[t]<4 && validShape([...types,t])) out.push(t);
  return out;
}

// Finds a complete fourteen-tile subset without enumerating physical 14-combinations.
export function findShapes(tiles, limit=1, accept=()=>true) {
  if(tiles.length<14) return [];
  const counts=countsOf(tiles), out=[], seen=new Set();
  const put = types => { const key=types.slice().sort((a,b)=>a-b).join(','); if(!seen.has(key)){seen.add(key);if(accept(types))out.push(types);} };
  const pairs=counts.map((n,t)=>n>=2?t:-1).filter(t=>t>=0);
  if(pairs.length>=7) {
    function pick(start,chosen) {
      if(out.length>=limit) return;
      if(chosen.length===7) {put(chosen.flatMap(t=>[t,t]));return;}
      for(let i=start;i<=pairs.length-(7-chosen.length);i++) pick(i+1,[...chosen,pairs[i]]);
    }
    pick(0,[]); if(out.length>=limit) return out;
  }
  if(ORPHANS.every(t=>counts[t]>0)) for(const t of ORPHANS) if(counts[t]>=2) {put([...ORPHANS,t]);if(out.length>=limit)return out;}
  const groups=[];
  for(let t=0;t<34;t++) {
    if(counts[t]>=3) groups.push([t,t,t]);
    if(t<27&&t%9<=6&&counts[t]&&counts[t+1]&&counts[t+2]) groups.push([t,t+1,t+2]);
  }
  for(const p of pairs) {
    const rem=counts.slice();rem[p]-=2;
    function dfs(start,types,depth) {
      if(out.length>=limit)return;
      if(depth===4){put([p,p,...types]);return;}
      for(let j=start;j<groups.length;j++) {
        const g=groups[j];
        if(g[0]===g[1] ? rem[g[0]]<3 : g.some(t=>!rem[t])) continue;
        for(const t of g)rem[t]--;dfs(j,[...types,...g],depth+1);for(const t of g)rem[t]++;
        if(out.length>=limit)return;
      }
    }
    dfs(0,[],0);if(out.length>=limit)return out;
  }
  return out;
}
export function emergencyHands(tiles, limit=12) {
  const pool=tiles.map(x=>typeof x==='number'?x:x.type), counts=countsOf(pool), out=[], seen=new Set();
  if(pool.length<13)return out;
  for(let t=0;t<34;t++) {
    for(const full of findShapes([...pool,t],3,types=>types.includes(t)&&countsOf(types).every(n=>n<=4))) {
      const i=full.indexOf(t);if(i<0)continue;
      const hand=full.slice();hand.splice(i,1);hand.sort((a,b)=>a-b);
      const hc=countsOf(hand);if(hc.some((n,j)=>n>counts[j]))continue;
      const key=hand.join(',');if(seen.has(key))continue;seen.add(key);
      out.push({types:hand,waits:waits(hand)}); if(out.length>=limit)return out;
    }
  }
  return out;
}
export function multiplier(exposed, base) { return Math.max(40,100-Math.max(0,exposed-base)*8)/100; }
export function basePoints(han, yakuman=0) {
  if(yakuman)return yakuman*6400;
  if(han<=0)return 0;
  if(han>=13)return 6400;if(han>=11)return 4800;if(han>=8)return 3200;if(han>=6)return 2400;
  return 100*2**(han-1);
}
export function evaluate(tiles, winType, ctx={}) {
  const types=tiles.map(x=>typeof x==='number'?x:x.type);
  const blank={valid:false,yaku:[],han:0,dora:0,ura:0,yakuman:0,base:0,score:0,multiplier:ctx.multiplier??1};
  if(!validShape(types)||!types.includes(winType))return blank;
  const c=countsOf(types), used=c.map((n,t)=>n?t:-1).filter(t=>t>=0);
  const suits=new Set(used.filter(t=>t<27).map(t=>Math.floor(t/9)));
  const hasHonor=used.some(t=>t>=27);
  const dora=ctx.dora==null?0:c[nextDora(ctx.dora)];
  const ura=ctx.riichi&&ctx.ura!=null?c[nextDora(ctx.ura)]:0;
  const common=[], commonYak=[];
  const add=(arr,name,han)=>arr.push({name,han});
  if(ctx.riichi)add(common,ctx.doubleRiichi?'더블리치':'리치',ctx.doubleRiichi?2:1);
  if(ctx.riichi&&ctx.ippatsu)add(common,'일발',1);
  if(ctx.tsumo)add(common,'멘젠쯔모',1);
  if(ctx.tsumo&&ctx.lastTile)add(common,'해저모월',1);
  if(used.every(t=>t<27&&!terminal(t)))add(common,'탕야오',1);
  if(suits.size===1)add(common,hasHonor?'혼일색':'청일색',hasHonor?3:6);
  if(used.every(outside))add(common,'혼노두',2);
  if(used.every(t=>t>=27))add(commonYak,'자일색',1);
  if(used.every(terminal))add(commonYak,'청노두',1);
  if(used.every(t=>[19,20,21,23,25,32].includes(t)))add(commonYak,'녹일색',1);
  if(!hasHonor&&suits.size===1) {
    const off=[...suits][0]*9, b=[3,1,1,1,1,1,1,1,3];
    if(b.every((n,i)=>c[off+i]>=n))add(commonYak,'구련보등',1);
  }
  const results=[];
  function save(y,ym) {
    const yakuman=ym.reduce((s,x)=>s+x.han,0), intrinsic=y.reduce((s,x)=>s+x.han,0);
    const han=yakuman?0:intrinsic+(intrinsic>0?dora+ura:0);
    const base=basePoints(han,yakuman), multi=ctx.multiplier??1;
    results.push({valid:true,yaku:yakuman?ym.map(x=>({name:x.name,han:0,yakuman:x.han})):y,
      han,dora:yakuman?0:dora,ura:yakuman?0:ura,yakuman,base,score:Math.floor(base*Math.round(multi*100)/100),multiplier:multi});
  }
  if(isKokushi(c)){save([], [{name:'국사무쌍',han:1}]);}
  if(isChiitoi(c)){save([...common,{name:'칠대자',han:2}],commonYak.slice());}
  for(const shape of decompositions(c)) {
    const {groups,pair}=shape, sequences=groups.filter(g=>g.kind==='sequence'), trips=groups.filter(g=>g.kind==='triplet');
    const assignments=[];
    if(pair===winType)assignments.push({kind:'pair',t:pair});
    for(let gi=0;gi<groups.length;gi++) {
      const g=groups[gi];if(g.kind==='triplet'?g.t===winType:winType>=g.t&&winType<=g.t+2) assignments.push({...g,gi});
    }
    for(const finish of assignments) {
      const y=common.slice(), ym=commonYak.slice();
      const tripTypes=trips.map(g=>g.t), dragonCount=tripTypes.filter(t=>t>=31).length;
      const windCount=tripTypes.filter(t=>t>=27&&t<31).length;
      for(const [t,name] of [[31,'백'],[32,'발'],[33,'중']])if(tripTypes.includes(t))add(y,`역패 · ${name}`,1);
      if(tripTypes.includes(ctx.seatWind??27))add(y,'자풍패',1);
      if(tripTypes.includes(ctx.roundWind??27))add(y,'장풍패',1);
      if(dragonCount===3)add(ym,'대삼원',1);
      if(windCount===4)add(ym,'대사희',1);
      else if(windCount===3&&pair>=27&&pair<31)add(ym,'소사희',1);
      const concealed=trips.length-(!ctx.tsumo&&finish.kind==='triplet'?1:0);
      if(concealed===4)add(ym,'사암각',1);
      else if(concealed===3)add(y,'삼암각',2);
      if(trips.length===4)add(y,'또이또이',2);
      if(dragonCount===2&&pair>=31)add(y,'소삼원',2);
      const seqCount=new Map(); for(const g of sequences)seqCount.set(g.t,(seqCount.get(g.t)||0)+1);
      const repeats=[...seqCount.values()].reduce((s,n)=>s+Math.floor(n/2),0);
      if(repeats>=2)add(y,'량페코',3);else if(repeats===1)add(y,'이페코',1);
      if([...Array(7).keys()].some(r=>[r,r+9,r+18].every(t=>seqCount.has(t))))add(y,'삼색동순',2);
      if([...Array(9).keys()].some(r=>[r,r+9,r+18].every(t=>tripTypes.includes(t))))add(y,'삼색동각',2);
      if([0,9,18].some(s=>[s,s+3,s+6].every(t=>seqCount.has(t))))add(y,'일기통관',2);
      const valuePair=pair>=31||pair===(ctx.seatWind??27)||pair===(ctx.roundWind??27);
      const ryanmen=finish.kind==='sequence' && (winType===finish.t||winType===finish.t+2) &&
        !(finish.t%9===0&&winType===finish.t+2) && !(finish.t%9===6&&winType===finish.t);
      if(sequences.length===4&&!valuePair&&ryanmen)add(y,'핑후',1);
      if(sequences.length>0&&outside(pair)&&groups.every(g=>g.kind==='triplet'?outside(g.t):g.t%9===0||g.t%9===6))add(y,hasHonor?'찬타':'준찬타',hasHonor?2:3);
      save(y,ym);
    }
  }
  results.sort((a,b)=>b.score-a.score||b.base-a.base||b.han-a.han);
  return results[0]||blank;
}
export const SUPPORTED = ['리치','더블리치','일발 (첫 4쯔모)','멘젠쯔모 (리치 쯔모)','해저모월 (리치 쯔모)',
  '탕야오','핑후','이페코','역패 (백·발·중·자풍·장풍)','칠대자','또이또이','삼암각','삼색동순','삼색동각','일기통관','찬타','혼노두','소삼원','혼일색','준찬타','량페코','청일색',
  '국사무쌍','사암각','대삼원','소사희','대사희','자일색','청노두','녹일색','구련보등'];
