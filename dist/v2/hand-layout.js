// Presentation order is separate from physical hand order and scoring state.
export const activeDraw=s=>s.phase==='action'&&s.hand.some(t=>t.id===s.drawn)?s.drawn:null;
const sortType=t=>t.special==='wind'?27:t.special==='dragon'?31:t.type;
export function setHandAutoSort(s,enabled){s.autoSortHand=!!enabled;if(enabled)sortHand(s);else syncHandOrder(s);}
export function syncHandOrder(s){
 if(s.autoSortHand){s.handOrder=[];s.drawIntegrated=false;}
 const ids=new Set(s.hand.map(t=>t.id));let kept=[...new Set(s.handOrder||[])].filter(id=>ids.has(id));
 const fresh=s.hand.filter(t=>!kept.includes(t.id)).slice().sort((a,b)=>a.id===activeDraw(s)?1:b.id===activeDraw(s)?-1:sortType(a)-sortType(b));
 s.handOrder=[...kept,...fresh.map(t=>t.id)];return s.handOrder;
}
export function handView(s){
 const ordered=syncHandOrder(s).map(id=>s.hand.find(t=>t.id===id));
 const drawId=s.drawIntegrated?null:activeDraw(s);
 return {body:ordered.filter(t=>t.id!==drawId),draw:ordered.find(t=>t.id===drawId)||null};
}
export function moveHandTile(s,id,targetId,after=false){
 if(!['action','floor','callDiscard'].includes(s.phase)||s.riichi||s.autoSortHand)return false;
 const order=syncHandOrder(s);if(id===targetId||!order.includes(id)||targetId&&!order.includes(targetId))return false;
 const next=order.filter(x=>x!==id),index=targetId?next.indexOf(targetId)+(after?1:0):next.length;next.splice(index,0,id);s.handOrder=next;
 if(id===activeDraw(s))s.drawIntegrated=true;return true;
}
export function sortHand(s){s.handOrder=[];s.drawIntegrated=false;syncHandOrder(s);}
