import {optionsFor} from './game.js';
import {tileName} from './rules.js';
const CALLS={chi:'치',pon:'퐁',daiminkan:'대명깡',ankan:'암깡',kakan:'가깡'};
// One primary action, with explicit alternatives in a disclosure menu.
export function actionChoices(s,selected,floorSelected){
 if(s.riichi)return [];
 const o=optionsFor(s),out=[],put=(action,label,payload={},hint='')=>out.push({action,label,payload,hint});
 if(s.phase==='floor'){
  const ron=o.ron.find(x=>x.tile.id===floorSelected);if(ron)put('ron','론 · 화료',{id:floorSelected},`${ron.score.score}점부터`);
  const seen=new Set();for(const x of o.calls.filter(x=>x.take===floorSelected)){
   const key=JSON.stringify([x.kind,x.types,x.ids.map(id=>{const t=s.hand.find(t=>t.id===id);return [t.type,t.special||'',!!t.red];}).sort()]);
   if(seen.has(key))continue;seen.add(key);put('call',CALLS[x.kind],x,x.types.map(tileName).join(' '));
  }
  const sleeve=s.floor.find(t=>t.id===floorSelected&&t.floorEffects?.includes('patternSleeve'));
  if(sleeve&&s.hand.some(t=>t.id===selected))put('sleeve','소매 · 손패와 교환',{take:floorSelected,id:selected},`${tileName(s.hand.find(t=>t.id===selected).type)} 버림 · 멘젠 유지`);
  put('draw',s.wall.length?'넘기기 · 다음 쯔모':'남은 기회 종료',{},'바닥패를 그대로 두고 진행');
 }else if(['action','callDiscard'].includes(s.phase)){
  if(o.tsumo?.valid)put('tsumo','쯔모 · 화료',{},`${o.tsumo.score}점부터`);
  const riichi=o.riichi.find(x=>x.id===selected);if(riichi)put('riichi','리치 선언',{id:selected},`${tileName(s.hand.find(x=>x.id===selected).type)} 버리고 자동 진행`);
  if(s.hand.some(x=>x.id===selected))put('discard','버리기',{id:selected},tileName(s.hand.find(x=>x.id===selected).type));
  for(const x of o.kans)put('kan',CALLS[x.kind],x,tileName(x.t));
 }
 return out;
}
