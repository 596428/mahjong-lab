import {Game,DEFAULTS,LIMITS,createScenario} from './game.js';
import {tileName,nextDora,SUPPORTED,waits,multiplier} from './rules.js';
import {faceMarkup} from './tile-art.js';
import {readRecord,saveRecord} from './records.js';

const $=s=>document.querySelector(s);
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>n.toLocaleString();
const windGlyph=t=>['東','南','西','北'][t-27];
const randomSeed=()=>crypto.randomUUID().slice(0,8).toUpperCase();
let config={...DEFAULTS};
try{config={...config,...JSON.parse(localStorage.getItem('mahjong-lab-config')||'{}')};}catch{}
config.seed=randomSeed();
let game=new Game(config),staged=[],winId=null,mode='normal',discardSelection=[],takeSelection=[],hint=null,riichiTimer=null,toastTimer=null;
const names={opening:'준비',play:'패 조합',riichi:'리치 진행',recovery:'패 회수',emergency:'비상 리치',won:'라운드 클리어',lost:'라운드 종료'};
const scenarios={win:'화료 연습',zero:'역 없는 패 확인',riichi:'리치 · 일발 연습',emergency:'교환 직후 리치 연습'};
let lastWinKey='',finishedRecorded=false,newRecord=false;
const storage={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)};
const best=()=>readRecord(storage,game.config);
const phaseNames={opening:'새로운 손',play:'화료 준비',riichi:'리치',recovery:'화료',emergency:'마지막 기회',lost:'도전 종료'};

function tile(t,{mini=false,action='',selected=false,winning=false,ghost=false,discard=false,hidden=false}={}){
  if(hidden)return `<div class="tile back ${mini?'mini':''}" role="img" aria-label="비공개 패"><strong>◆</strong></div>`;
  const type=typeof t==='number'?t:t.type,id=typeof t==='number'?'':t.id;
  const suit=type<9?'man':type<18?'pin':type<27?'sou':`honor ${type===31?'white':type===32?'green':type===33?'red':''}`;
  const tag=action?'button':'div';
  return `<${tag} class="tile ${suit} ${mini?'mini':''} ${selected?'selected':''} ${discard?'to-discard':''} ${winning?'winning':''} ${ghost?'ghost':''}" ${action?`data-action="${action}" data-id="${id}" aria-label="${esc(tileName(type))}${winning?' · 화료패':''}${selected?' · 선택됨':''}" aria-pressed="${selected}" draggable="${game.active&&['hand','floor','unstage'].includes(action)}"`:(ghost?'aria-hidden="true"':`role="img" aria-label="${esc(tileName(type))}"`)} title="${esc(tileName(type))}${winning?' · 지정된 화료패':''}">${ghost?'·':`<span class="tile-face" aria-hidden="true">${faceMarkup(type)}</span><span class="tile-code" aria-hidden="true">${type<27?`${type%9+1}${['m','p','s'][Math.floor(type/9)]}`:''}</span>`}</${tag}>`;
}
function sorted(tiles){return tiles.slice().sort((a,b)=>a.type-b.type||a.id-b.id);}
function tileList(tiles,options={}){return sorted(tiles).map(t=>tile(t,options)).join('');}
function resetSelections(){staged=[];winId=null;mode='normal';discardSelection=[];takeSelection=[];hint=null;}
function notify(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3400);}
function run(fn,{reset=true}={}){try{fn();if(reset)resetSelections();render();}catch(error){notify(error.message);}}
function start(next){clearInterval(riichiTimer);riichiTimer=null;game=next;lastWinKey='';finishedRecorded=false;newRecord=false;resetSelections();render();}
function toggle(array,id){const i=array.indexOf(id);if(i<0)array.push(id);else array.splice(i,1);}

function sourceTiles(tiles,source){
  if(!tiles.length)return `<div class="floor-empty">${source==='floor'?(game.s.phase==='opening'?'바닥패를 공개하거나, 손패로 리치를 선언하세요.':game.s.phase==='riichi'?'리치 중에는 바닥패를 사용하지 않습니다.':'남아 있는 바닥패가 없습니다.'):'손패가 모두 제출되었습니다.'}</div>`;
  return sorted(tiles).map(t=>{
    if(staged.includes(t.id)||(mode==='modify'&&(source==='hand'?discardSelection:takeSelection).includes(t.id)))return tile(t,{ghost:true});
    const recovery=game.s.phase==='recovery';
    const active=game.active||(recovery&&source==='floor');
    const selecting=source==='floor'?takeSelection:discardSelection;
    return tile(t,{action:active?source:'',selected:(mode==='modify'||recovery)&&selecting.includes(t.id),discard:mode==='modify'&&source==='hand'&&discardSelection.includes(t.id)});
  }).join('');
}
function floorMarkup(){
  const s=game.s,r=s.riichi;
  if(!r)return `<div class="floor-zone"><div class="zone-head"><h2>바닥패</h2><span>${s.phase==='recovery'?`회수 ${takeSelection.length} / ${Math.min(game.remainingTake,13-s.hand.length,s.floor.length)}`:`추가 공개 ${Math.max(0,s.exposed-game.config.baseReveal)} / ${game.config.maxReveal-game.config.baseReveal} · 회수 잔여 ${game.remainingTake}장`}</span></div><div class="tiles" id="floor-tiles">${sourceTiles(s.floor,'floor')}</div>${game.active&&s.poolRiichiOpen?'<p class="pool-riichi-note">교환 직후: 바닥패를 포함해 리치 가능 · 한 장 더 보면 기회 종료</p>':''}</div>`;
  const won=!!s.result&&s.result.mode!=='normal';
  return `<section class="riichi-river" aria-label="이번 리치의 버린 패"><div class="zone-head"><h2>이번 리치의 버린 패</h2><span>선언 때 버린 패 + 쯔모기리 ${r.discardedFloor.length+r.discardedHand.length+r.tsumogiri.length}장</span></div><div class="river-section"><div class="river-label">선언 때 버린 바닥패 <b>${r.discardedFloor.length}장</b></div><div class="tiles river-tiles" aria-label="리치 선언 때 버린 바닥패">${r.discardedFloor.length?tileList(r.discardedFloor,{mini:true}):'<span class="river-empty">버린 바닥패 없음</span>'}</div></div>${r.discardedHand.length?`<div class="river-section"><div class="river-label">선언 때 버린 손패 <b>${r.discardedHand.length}장</b></div><div class="tiles river-tiles" aria-label="리치 선언 때 버린 손패">${tileList(r.discardedHand,{mini:true})}</div></div>`:''}<div class="river-section"><div class="river-label">쯔모기리 <b>${r.tsumogiri.length}장</b><span>뽑은 순서 →</span></div><div class="tiles river-tiles tsumogiri-tiles" id="riichi-tsumogiri" aria-label="리치 후 쯔모기리한 패">${r.tsumogiri.length?r.tsumogiri.map((t,i)=>`<div class="river-tile"><span class="draw-number">${i+1}</span>${tile(t,{mini:true})}</div>`).join(''):'<span class="river-empty">아직 쯔모기리한 패가 없습니다.</span>'}</div></div><div class="riichi-cost"><strong>선언 후 패산 소모 ${r.draws}장</strong><span>패산 ${r.wallStart} → ${s.wall.length}장${won?' · 화료패 1장 포함':''}</span></div><p class="river-note">선언 때 버린 손패·바닥패는 선언 후 패산 소모 장수에 포함하지 않습니다.</p></section>`;
}
function trayMarkup(){
  const s=game.s;
  if(mode==='modify')return `<div class="modify-tray" id="modification-tray"><section class="modify-zone discard-zone"><div class="zone-head"><h2>버릴 손패</h2><span>${discardSelection.length} / ${game.config.maxModify}장</span></div><div class="tiles" aria-label="버릴 패 공간">${Array.from({length:game.config.maxModify},(_,i)=>{const t=s.hand.find(x=>x.id===discardSelection[i]);return t?tile(t,{action:'undiscard',discard:true}):`<div class="slot modify-slot">${i+1}</div>`;}).join('')}</div></section><section class="modify-zone take-zone"><div class="zone-head"><h2>회수할 바닥패</h2><span>${takeSelection.length} / ${game.remainingTake}장</span></div><div class="tiles" aria-label="회수할 패 공간">${takeSelection.length?takeSelection.map(id=>tile(s.floor.find(t=>t.id===id),{action:'untake',selected:true})).join(''):`<div class="take-placeholder">${game.remainingTake?'바닥패를 클릭하거나 여기로 끌어오세요.':'이번 시도의 회수 한도를 모두 사용했습니다.'}</div>`}</div></section></div><div class="tray-caption"><span>패를 클릭하거나 중앙으로 끌어오기 · 다시 누르면 되돌리기</span><span>패산에서 ${Math.max(0,discardSelection.length-takeSelection.length)}장 보충</span></div>`;
  if(s.phase==='riichi')return `<div class="riichi-stage"><div class="riichi-label">${s.riichi.emergency?'비상 리치':'立直 · 리치'}</div>${s.riichi.last?tile(s.riichi.last):'<div class="muted small" style="padding:20px">화료패를 기다립니다</div>'}<div class="small muted">${s.riichi.draws}번째 쯔모 · 대기 ${s.riichi.waits.map(tileName).join(' / ')}</div><div class="riichi-dots">${Array.from({length:4},(_,i)=>`<span class="${i<s.riichi.draws?'used':''}"></span>`).join('')}</div></div>`;
  const result=['recovery','won'].includes(s.phase)?s.result:null;
  const tiles=result?result.tiles:staged.map(id=>game.pool.find(t=>t.id===id)).filter(Boolean);
  return `<div class="tray" id="submission-tray" aria-label="패 조합 공간">${Array.from({length:14},(_,i)=>tiles[i]?tile(tiles[i],{action:result?'':'unstage',winning:tiles.length===14&&tiles[i].id===(result?result.winId:winId)}):`<div class="slot">${String(i+1).padStart(2,'0')}</div>`).join('')}</div><div class="tray-caption"><span>${result?'제출한 패는 버림패로 이동했습니다.':mode==='modify'?'손패에서 버릴 패, 바닥에서 가져올 패를 선택하세요.':'드래그로 순서 변경 · 클릭으로 되돌리기 · 화료패는 평화·암각 판정에 사용'}</span>${!result&&tiles.length===14?`<label>화료패 <select id="winning-select" aria-label="화료패 지정">${tiles.map(t=>`<option value="${t.id}" ${t.id===winId?'selected':''}>${tileName(t.type)}</option>`).join('')}</select></label>`:''}</div>`;
}
function yakuRows(r){return `<ul class="yaku-list">${r.yaku.map(y=>`<li><span>${y.name}</span><span>${y.yakuman?`${y.yakuman} 역만`:`${y.han}판`}</span></li>`).join('')}${r.dora?`<li><span>도라</span><span>+${r.dora}판</span></li>`:''}${r.ura?`<li><span>뒷도라</span><span>+${r.ura}판</span></li>`:''}</ul>`;}
function inspector(){
  const s=game.s;
  if(s.phase==='lost')return `<div class="panel-title">이번 도전</div><h2 class="inspector-title">${newRecord?'새로운 최고 기록':'수고했어요'}</h2><div class="preview-big">${fmt(s.score)}<small>점</small></div><p class="empty-inspector">${esc(s.endedReason)}<br>화료 ${s.events.filter(e=>e.action==='win').length}회 · 패산 ${s.wall.length}장 남음</p><button class="primary" data-action="new-seed">다시 도전</button><button class="quiet" data-action="restart">같은 패산으로 다시</button>`;
  if(s.phase==='emergency'){
    const candidates=game.emergencyCandidates();
    return `<div class="panel-title">마지막 기회</div><h2 class="inspector-title">비상 리치</h2><p class="empty-inspector">더 공개하거나 교환할 수 없고, 지금은 화료할 수도 없습니다.<br><br>한 번뿐인 기회로 손패와 바닥패에서 텐파이 13장을 구성하세요. 회수 한도는 적용하지 않습니다.</p><div class="emergency-options">${candidates.map((ts,i)=>`<div class="candidate"><div class="tiles">${ts.map(t=>tile(t,{mini:true})).join('')}</div><div class="candidate-label">대기 ${waits(ts).map(tileName).join(' · ')}</div><button data-action="emergency" data-index="${i}">이 패로 비상 리치</button></div>`).join('')}</div>`;
  }
  if(mode==='modify'){
    const replacement=Math.max(0,discardSelection.length-takeSelection.length),refresh=Math.min(game.config.baseReveal,Math.max(0,s.wall.length-replacement)),valid=discardSelection.length>0&&takeSelection.length<=discardSelection.length&&replacement<=s.wall.length;
    return `<div class="panel-title">손패 다듬기</div><h2 class="inspector-title">패 교환</h2><p class="empty-inspector">버릴 손패와 가져올 바닥패를 중앙에 놓으세요. 빈자리는 패산에서 뽑습니다. 확정하면 남은 바닥패를 전부 버리고 새로 공개합니다.</p><ul class="yaku-list"><li><span>버릴 손패</span><span>${discardSelection.length}장</span></li><li><span>가져올 바닥패</span><span>${takeSelection.length}장</span></li><li><span>남은 바닥패 버림</span><span>${s.floor.length-takeSelection.length}장</span></li><li><span>새 바닥패 공개</span><span>${refresh}장</span></li><li><span>패산 소모 합계</span><span>${replacement+refresh}장</span></li></ul><p class="formula">교환 기회 ${s.modifications} → ${s.modifications-1}회<br>배율 ×${game.factor.toFixed(2)} 유지 · 손패 보충 ${replacement}장 + 바닥패 ${refresh}장<br>이번 손의 회수 한도 ${game.remainingTake}장${takeSelection.length>discardSelection.length?'<br><b>가져올 패 수만큼 손패를 버려야 합니다.</b>':replacement>s.wall.length?'<br>패산에 보충할 패가 부족합니다.':''}</p><button class="primary" data-action="confirm-modify" ${valid?'':'disabled'}>교환 확정</button><button class="quiet" data-action="cancel-mode">취소하고 돌아가기</button>`;
  }
  if(s.phase==='riichi')return `<div class="panel-title">손패 고정</div><h2 class="inspector-title">화료패를 기다립니다</h2><div class="wait-preview">${s.riichi.waits.map(t=>tile(t,{mini:true})).join('')}</div><p class="empty-inspector">대기 ${s.riichi.waits.map(tileName).join(' · ')}<br>화료할 때까지 자동 쯔모기리합니다.</p><ul class="yaku-list"><li><span>일발</span><span>${s.riichi.draws<4?`${4-s.riichi.draws}쯔모 기회 남음`:'기회 종료'}</span></li><li><span>유지되는 배율</span><span>×${s.riichi.multiplier.toFixed(2)}</span></li><li><span>선언 후 패산 소모</span><span>${s.riichi.draws}장</span></li></ul><p class="formula">대기패가 패산에 남아 있다는 보장은 없습니다.</p><button data-action="fast-riichi">결과까지 빠르게</button>`;
  const selectedWaits=game.active?game.riichiWaits(staged):[],selectedRiichi=game.canRiichiSelection(staged);
  if(selectedWaits.length)return `<div class="panel-title">선택한 13장 · 텐파이</div><h2 class="inspector-title">${selectedRiichi?'리치할 수 있습니다':'텐파이 · 리치 조건 미충족'}</h2><div class="wait-preview">${selectedWaits.map(t=>tile(t,{mini:true})).join('')}</div><p class="empty-inspector">대기 ${selectedWaits.map(tileName).join(' · ')}<br>선택한 13장을 고정하고 나머지 ${game.pool.length-13}장을 버립니다.<br>교환 기회와 회수 한도는 소비하지 않습니다.</p><p class="formula">현재 배율 ×${game.factor.toFixed(2)} 유지<br>남은 패산 ${s.wall.length}장</p><button class="primary" data-action="riichi" ${selectedRiichi?'':'disabled'}>${selectedRiichi?'선택한 13장으로 리치':s.wall.length?'바닥패 리치는 교환 직후만 가능':'패산이 없어 리치 불가'}</button><button class="quiet" data-action="clear">모두 되돌리기</button><p class="empty-inspector">14장을 완성하면 바로 화료할 수도 있습니다.</p>`;
  const r=s.phase==='recovery'?s.result:(staged.length===14?game.preview(staged,winId):null);
  let body=`<div class="panel-title">${s.result?'이번 화료':'화료 예상 점수'}</div>`;
  if(r?.valid&&r.yaku.length){body+=`<div class="preview-big">${fmt(r.score)}<small>점</small></div>${yakuRows(r)}<p class="formula">${r.yakuman?`${r.yakuman} 역만`:`${r.han}판`} · ${fmt(r.base)} × ${r.multiplier.toFixed(2)}<br><button class="inline-link" data-action="scoring">이 게임의 점수표</button></p>`;}
  else if(r?.valid)body+=`<div class="hand-status no-yaku">역이 없습니다</div><p class="empty-inspector">형태는 완성됐지만 화료할 수 없습니다. 도라만으로는 역이 생기지 않습니다.<br><br>패를 교환하거나 다른 조합을 찾아보세요.</p>`;
  else body+=`<div class="preview-big">${staged.length}<small>/ 14 장</small></div><p class="empty-inspector">${staged.length===14?'아직 화료형이 아닙니다. 내려놓은 패를 눌러 바꿀 수 있습니다.':'손패와 바닥패를 조합해<br>가운데에 14장을 놓으세요.'}</p><div class="decision-note">지금 화료해 점수를 쌓을까요?<br>더 좋은 패를 기다릴까요?</div>`;
  if(game.active){body+=`<button class="primary" data-action="submit" ${r?.valid&&r.yaku.length?'':'disabled'}>${r?.valid&&r.yaku.length?`화료 · ${fmt(r.score)}점`:r?.valid?'역이 있어야 화료 가능':'화료'}</button><div class="preview-tools"><button class="quiet small" data-action="hint">화료 조합 힌트</button><button class="quiet small" data-action="clear" ${staged.length?'':'disabled'}>모두 되돌리기</button></div>`;}
  if(s.phase==='recovery'){
    const cap=Math.min(game.remainingTake,13-s.hand.length,s.floor.length);
    body+=`<div class="carry-note"><b>${cap?'다음 손에 남길 패를 고르세요':'다음 화료를 준비하세요'}</b><p>${cap?`바닥패 최대 ${cap}장 회수 · 선택 ${takeSelection.length}장<br>고르지 않은 바닥패는 버립니다.`:'남은 손패를 유지하고 패산에서 보충합니다.'}</p></div><button class="primary" data-action="next">${takeSelection.length?`${takeSelection.length}장 남기고 다음 손으로`:'다음 손으로'}</button>`;
  }
  if(hint)body+=`<div class="hint-box">${hint.length?'현재 패로 가능한 화료 조합입니다. 화료패에 따라 역이 달라질 수 있습니다.':'현재 공개된 패로는 역 있는 화료가 불가능합니다.'}${hint.length?`<div class="hint-tiles">${hint.map(t=>tile(t,{mini:true})).join('')}</div>`:''}</div>`;
  return body;
}
function controls(){
  const s=game.s,c=game.config;if(!game.active)return '';
  if(mode==='modify')return `<button data-action="cancel-mode">교환 취소</button><span class="muted small" style="align-self:center">확정하기 전까지 패와 교환 기회는 소비되지 않습니다.</span>`;
  const revealLabel=s.phase==='opening'?`바닥패 ${Math.min(c.baseReveal,s.wall.length)}장 열기`:'한 장 더 보기';
  const nextFactor=multiplier(s.exposed+1,c.baseReveal);
  const revealCost=s.phase==='opening'?`패산 −${Math.min(c.baseReveal,s.wall.length)} · 배율 유지`:game.canReveal?`패산 −1 · ×${game.factor.toFixed(2)} → ×${nextFactor.toFixed(2)}`:s.wall.length?'이번 손의 공개 한도 도달':'패산이 모두 소진되었습니다';
  const riichiNote=!s.wall.length?'남은 패산이 있어야 선언 가능':s.poolRiichiOpen?'교환 직후 · 손패 + 바닥패로 선택':game.handWaits.length?'손패 13장으로 리치 가능':'바닥패 사용은 패 교환 직후에만';
  return `<button class="action-card ${s.phase==='opening'?'primary':''}" data-action="${s.phase==='opening'?'open':'reveal'}" ${game.canReveal?'':'disabled'}><strong>${revealLabel}</strong><small>${revealCost}${s.poolRiichiOpen?' · 바닥패 리치 기회 종료':''}</small></button><button class="action-card" data-action="modify" ${game.canModify?'':'disabled'}><strong>패 교환 <span>${s.modifications}회</span></strong><small>${game.canModify?`손패 1~${c.maxModify}장 · 교환 기회 −1`:s.modifications?'보충할 패가 없습니다':'교환 기회를 모두 사용했습니다'}</small></button><button class="action-card riichi" data-action="riichi" ${game.canRiichi?'':'disabled'}><strong>리치 선언</strong><small>${riichiNote}</small></button>`;
}
function endSummary(){
  const s=game.s,wins=s.events.filter(e=>e.action==='win');
  return `<section class="end-banner"><div class="eyebrow">${s.scenario?'연습 결과':newRecord?'최고 기록 경신':'이번 도전의 기록'}</div><h2>${fmt(s.score)}<small> 점</small></h2><p>${esc(s.endedReason)}</p><div class="end-metrics"><span>화료 <b>${wins.length}회</b></span><span>최대 화료 <b>${fmt(Math.max(0,...wins.map(e=>e.result.score)))}점</b></span><span>남은 패산 <b>${s.wall.length}장</b></span></div><div class="end-actions"><button class="primary" data-action="new-seed">새 패산으로 다시 도전</button><button data-action="restart">같은 패산으로 다시</button></div></section>`;
}
function render(){
  const s=game.s,c=game.config,ended=s.phase==='lost',history=s.events.filter(e=>e.action==='win').slice(-4).reverse();
  if(ended&&!finishedRecorded){const saved=saveRecord(storage,game);newRecord=saved.saved;finishedRecorded=true;}
  const record=best();
  const oldRiver=$('#riichi-tsumogiri'),riverScroll=oldRiver?{top:oldRiver.scrollTop,atEnd:oldRiver.scrollHeight-oldRiver.clientHeight-oldRiver.scrollTop<12}:null;
  const winKey=s.result?`${s.attempt}-${s.result.winId}`:'',newWin=winKey&&winKey!==lastWinKey;if(winKey)lastWinKey=winKey;
  $('#app').innerHTML=`<div class="app-shell"><header><div class="brand"><div class="brand-mark">發</div><div><p class="eyebrow">혼자 두는 마작</p><h1>밤의 작탁</h1></div></div><div class="header-actions"><button class="quiet" data-action="intro">처음 오셨나요?</button><button class="quiet" data-action="rules">게임 방법</button><button class="quiet" data-action="roadmap">개발 방향</button><button class="quiet" data-action="settings">설정</button><button data-action="ask-new">새 도전</button></div></header>
  <section class="goal-banner"><div><h2>패산이 다할 때까지, 더 높은 점수를.</h2><p>화료를 이어가며 최고 기록에 도전하세요.</p></div><div class="best-score"><span>나의 최고 기록</span><b>${record?fmt(record.score):'—'}<small>${record?'점':''}</small></b><span>현재 규칙 · 이 브라우저</span></div></section>
  <section class="stats" aria-label="도전 상태"><div class="stat"><span class="stat-label">이번 도전의 점수</span><div class="stat-value score-value">${fmt(s.score)}<small> 점</small></div><div class="stat-note">${history.length?`${s.events.filter(e=>e.action==='win').length}번의 화료를 이어왔습니다`:'첫 화료를 기다립니다'}</div></div><div class="stat"><span class="stat-label">남은 패산</span><div class="stat-value">${s.wall.length}<small> 장</small></div><div class="wall-track"><span style="width:${s.wall.length/(134-c.hidden)*100}%"></span></div></div><div class="stat"><span class="stat-label">남은 교환</span><div class="stat-value">${s.modifications}<small> 회</small></div><div class="stat-note">도전 전체에서 공유</div></div><div class="stat"><span class="stat-label">이번 화료 배율</span><div class="stat-value">×${game.factor.toFixed(2)}</div><div class="stat-note">추가 공개할수록 감소</div></div></section>
  ${s.scenario?`<div class="scenario-banner">연습 모드 · ${scenarios[s.scenario]} <span class="small">최고 기록에 반영되지 않습니다.</span></div>`:''}
  ${ended?endSummary():''}
  <main class="layout"><section class="table" aria-label="마작 작탁"><div class="table-inner"><div class="table-top"><span class="table-tag">${s.attempt}번째 손</span><span class="phase-tag">${phaseNames[s.phase]}</span></div>
  ${s.phase==='recovery'?`<div class="win-banner ${newWin?'win-enter':''}"><span class="win-seal">和</span><div><div class="eyebrow">${s.result.mode==='normal'?'화료':s.result.mode==='emergency'?'비상 리치 · 쯔모':'리치 · 쯔모'}</div><strong>+${fmt(s.result.score)}<small>점</small></strong><p>${s.result.yaku.map(y=>y.name).join(' · ')}</p></div><span class="win-total">누적 ${fmt(s.score)}점</span></div>`:''}
  ${floorMarkup()}
  <div class="tray-zone"><div class="zone-head tray-head"><h2>${mode==='modify'?'패 교환':s.phase==='riichi'?'리치 쯔모':s.result?'화료한 패':'조합할 패'} ${mode==='modify'?'<span class="badge">선택 중</span>':''}</h2><span>${mode==='modify'?'버릴 패와 가져올 패를 놓으세요':s.result?'和 · 화료패':s.phase==='riichi'?'첫 4쯔모 이내 화료 시 일발':'화료는 14장 · 리치는 텐파이 13장'}</span></div>${trayMarkup()}</div>
  <div class="hand-zone"><div class="zone-head"><h2>손패 <span>${s.hand.length}장</span></h2><span class="${mode==='modify'?'mode-label':''}">${mode==='modify'?`버릴 패 ${discardSelection.length} / ${c.maxModify}장 선택`:s.phase==='riichi'?'리치 중에는 패를 바꿀 수 없습니다':s.phase==='recovery'?'사용하지 않은 손패는 다음 손에 남습니다':'클릭하거나 가운데로 끌어오세요'}</span></div><div class="tiles" id="hand-tiles">${sourceTiles(s.hand,'hand')}</div></div>
  ${game.active?`<div class="table-bottom">${controls()}</div>`:''}<div class="message" role="status">${esc(s.message)}</div>
  ${ended?`<details class="sealed"><summary>이번 도전에서 제외됐던 패 ${s.hidden.length}장 보기</summary><div class="tiles">${tileList(s.hidden,{mini:true})}</div></details>`:''}</div></section>
  <aside class="side"><section class="panel"><div class="wind-summary"><span>장풍 <b>${windGlyph(c.roundWind)}</b></span><span>자풍 <b>${windGlyph(c.seatWind)}</b></span></div><div class="panel-title">도라 표시패</div><div class="indicator-row">${tile(s.dora,{mini:true})}<div class="indicator-info">이번 도라<br><b>${tileName(nextDora(s.dora.type))}</b></div><div class="ura-group">${tile(s.ura,{mini:true,hidden:!s.uraRevealed&&!ended})}<span>뒷도라 표시패</span></div></div></section><section class="panel inspection" aria-label="화료 점수 미리보기">${inspector()}</section><section class="panel log-panel"><div class="panel-title">이어온 화료</div>${history.length?history.map(e=>`<div class="history-entry"><span>${e.attempt}번째 손 · ${e.mode==='normal'?'화료':e.mode==='emergency'?'비상 리치':'리치'}<br><span class="muted">${e.result.yaku.slice(0,2).map(y=>y.name).join(' · ')}</span></span><b>+${fmt(e.result.score)}</b></div>`).join(''):'<p class="history-empty">작은 화료로 차곡차곡.<br>때로는 리치로 큰 한 수.<br>어떤 기록을 남기게 될까요?</p>'}</section></aside></main>
  <footer><span>화료할 때마다 다음 손으로 · 화료·공개·교환·리치가 모두 막히면 도전 종료</span><button class="inline-link" data-action="scoring">리치마작과 다른 점수 계산 안내</button></footer></div>`;
  const river=$('#riichi-tsumogiri');if(river)river.scrollTop=!riverScroll||riverScroll.atEnd?river.scrollHeight:riverScroll.top;
  if(s.phase==='riichi'&&!riichiTimer)riichiTimer=setInterval(()=>{if(game.s.phase!=='riichi'){clearInterval(riichiTimer);riichiTimer=null;return;}run(()=>game.drawRiichi());},650);
  else if(s.phase!=='riichi'&&riichiTimer){clearInterval(riichiTimer);riichiTimer=null;}
}
const settingsFields=[['baseReveal','기본 공개 장수','배율 감소 없이 공개하는 장수'],['maxReveal','기본 + 추가 공개 한도','교환 시 기본 바닥패 재공개는 제외'],['modifications','도전 전체 교환 횟수','화료해도 회복되지 않음'],['maxModify','교환 1회 최대 버리기','손패에서 선택'],['maxTake','한 손의 바닥패 회수 한도','교환 + 화료 후 회수 합계'],['hidden','비공개 제외 장수','표시패 2장과 별도로 제외']];
function showSettings(){
  const c=game.config;
  $('#settings-dialog').innerHTML=`<div class="dialog-heading"><h2>작탁 설정</h2><button class="quiet" data-action="close-settings" aria-label="설정 닫기">✕</button></div><p class="settings-intro">현재 패산 <b class="seed">${esc(c.seed)}</b><br>다른 규칙의 최고 기록은 따로 저장합니다.</p><div class="settings-shortcuts"><button data-action="intro">첫 플레이 안내</button><button data-action="export">플레이 기록 저장</button></div><details class="settings-details"><summary>규칙과 패산 변경</summary><form id="settings-form"><div class="settings-grid"><label class="field wide">패산 시드<input name="seed" maxlength="80" value="${esc(c.seed)}" required><small>같은 시드와 같은 설정이면 같은 패산입니다.</small></label>${settingsFields.map(([key,label,note])=>`<label class="field">${label}<input type="number" name="${key}" min="${LIMITS[key][0]}" max="${LIMITS[key][1]}" step="1" value="${c[key]}" required><small>${note}</small></label>`).join('')}${['seatWind','roundWind'].map((key,i)=>`<label class="field">${i?'장풍':'자풍'}<select name="${key}">${[27,28,29,30].map(t=>`<option value="${t}" ${c[key]===t?'selected':''}>${windGlyph(t)}</option>`).join('')}</select></label>`).join('')}</div><div class="dialog-actions"><button type="button" data-action="restore-defaults">기본 규칙</button><button class="primary" type="submit">적용하고 새 도전</button></div><p class="small muted">적용하면 현재 도전은 초기화됩니다.</p></form></details><details class="settings-details"><summary>연습용 배치</summary><p class="small muted">규칙을 익히기 위한 고정 배치입니다. 최고 기록에는 반영되지 않습니다.</p><div class="test-controls"><select id="scenario-select" aria-label="연습 배치">${Object.entries(scenarios).map(([key,name])=>`<option value="${key}">${name}</option>`).join('')}</select><button data-action="load-scenario">연습 시작</button></div></details>`;
  $('#settings-dialog').showModal();
}
const scoreTable=()=>`<div id="score-guide"><h3>판수가 높을수록 더 높은 점수</h3><p>역의 판수와 도라를 합산합니다. 실제 리치마작의 부수·친/자 점수 대신 아래 점수표를 사용합니다.</p><table class="score-table"><thead><tr><th>판수</th><th>기본 점수</th></tr></thead><tbody>${[['1판','100'],['2판','200'],['3판','400'],['4판','800'],['5판','1,600'],['6~7판','2,400'],['8~10판','3,200'],['11~12판','4,800'],['13판 이상','6,400'],['역만','1개당 6,400']].map(([a,b])=>`<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</tbody></table><p><b>획득 점수 = 기본 점수 × 이번 화료 배율</b><br>소수점은 버립니다. 같은 판수 구간은 같은 기본 점수를 받습니다. 별개의 역만은 중첩하되 단기·순정 등의 더블 역만은 적용하지 않습니다.</p></div>`;
function showRules(scoring=false){
  $('#rules-dialog').innerHTML=`<div class="dialog-heading"><h2>${scoring?'이 게임의 점수':'리치마작을 안다면, 이것만'}</h2><button class="quiet" data-action="close-rules" aria-label="가이드 닫기">✕</button></div><div class="rules-copy">${scoring?scoreTable():`<p class="guide-lead">패산이 다 떨어질 때까지 최대한 높은 점수를 모으세요. 한 번 화료해도 끝나지 않습니다.</p><h3>손패 + 바닥패로 화료</h3><p>상대 없이 혼자 진행합니다. 공개된 바닥패와 손패에서 14장을 골라 가운데에 놓으세요. <b>역이 있어야 화료할 수 있고, 도라는 역이 아닙니다.</b> 울기·깡·상대에게 론하기는 없습니다.</p><p>마지막에 놓은 패를 화료패로 지정합니다. 지정 메뉴에서 바꿀 수 있고, 핑후·암각 판정에 사용합니다. 일반 화료는 문전이지만 쯔모 역을 주지 않으며, 화료패로 완성한 각자는 암각으로 세지 않습니다.</p><h3>지금 화료할까, 패를 다듬을까?</h3><p>기본 바닥패는 ${game.config.baseReveal}장입니다. 한 장 더 공개할 때마다 패산이 줄고 이번 화료 배율은 0.08씩 내려갑니다(최저 ×0.40). 한 손의 추가 공개는 최대 ${game.config.maxReveal-game.config.baseReveal}장입니다. 교환으로 다시 받는 기본 바닥패는 이 한도에 포함하지 않습니다.</p><p>교환 기회 1회로 손패 1~${game.config.maxModify}장을 버리고, 선택한 바닥패와 패산에서 손패를 먼저 보충합니다. 남은 바닥패는 전부 버리고 기본 ${game.config.baseReveal}장을 새로 공개합니다(패산 부족 시 남은 만큼). 이 재공개로 배율이 더 내려가지 않으며, 기존 배율·추가 공개 한도·회수 한도는 초기화하지 않습니다. 바닥패는 한 손에 최대 ${game.config.maxTake}장 회수할 수 있으며, 교환과 화료 후 회수를 합산합니다.</p><h3>화료 뒤에도 이어지는 작탁</h3><p>화료에 쓴 14장은 소비합니다. 사용하지 않은 손패는 남기고, 남은 바닥패 중 일부를 회수한 뒤 나머지는 버립니다. 손패를 13장까지 보충하고 다음 손을 시작합니다. 배율과 회수 한도는 초기화되지만 교환 횟수는 회복되지 않습니다.</p><h3>손패 + 바닥패로 리치</h3><p>패 교환 직후 새 기본 바닥패가 공개됐을 때만, 바닥패와 손패 중 텐파이 13장을 골라 선언할 수 있습니다. 한 장 더 공개하거나 화료해 다음 손으로 넘어가면 이 기회는 끝납니다. 최초 기본 공개에서는 바닥패를 사용할 수 없습니다. 손패 13장 자체가 텐파이라면 기존처럼 리치할 수 있습니다. 중앙에 직접 고르거나 리치 버튼에서 후보를 고르세요. 선택한 13장만 고정하고 나머지 손패·바닥패는 버립니다. 교환 기회와 회수 한도는 소비하지 않습니다. 남은 패산이 있어야 선언할 수 있습니다. 화료할 때까지 자동 쯔모기리하며, <b>첫 4장 이내 화료하면 일발</b>입니다. 선언 당시 배율을 유지합니다. 리치 화료에는 멘젠쯔모와 뒷도라가 적용됩니다.</p><p>최초 배패에서 아무 행동 없이 선언하면 더블리치, 패산의 마지막 쯔모로 화료하면 해저모월입니다. 대기패가 실제 패산에 남아 있는지는 알려주지 않습니다. 버린 바닥패와 쯔모기리는 화면에서 계속 확인할 수 있습니다.</p><h3>도전이 끝나는 순간</h3><p>패산이 소진돼도 남은 패로 가능한 화료·교환은 할 수 있습니다. <b>화료·추가 공개·교환·리치가 모두 불가능하면 패산이 남아 있어도 종료</b>합니다.</p><p>손패 자체가 텐파이이거나 패 교환 직후의 바닥패 리치 조건을 만족하면 계속할 수 있습니다. 조건을 우회하는 비상 리치는 제공하지 않습니다.</p><h3>도라와 보이지 않는 패</h3><p>136장에서 실제 도라·뒷도라 표시패 각 1장과 비공개 패 ${game.config.hidden}장을 제외합니다. 표시패는 도전 내내 고정되며, 뒷도라는 첫 리치 화료 때 공개합니다. 제외 패는 도전 종료 후 확인할 수 있습니다.</p>${scoreTable()}<details class="settings-details"><summary>지원 역과 제외 규칙</summary><div class="yaku-tags">${SUPPORTED.map(y=>`<span>${y}</span>`).join('')}</div><p>깡 관련 역, 창깡·영상개화, 하저로어, 천화·지화·인화, 유국만관, 로컬 역과 적도라는 없습니다.</p></details>`}</div>`;
  $('#rules-dialog').showModal();
}
function showRoadmap(){
  $('#roadmap-dialog').innerHTML=`<div class="dialog-heading"><h2 id="roadmap-title">앞으로의 개발 방향</h2><button class="quiet" data-action="close-roadmap" aria-label="개발 방향 닫기">✕</button></div><span class="roadmap-status">개발 구상 · 아직 미구현</span><p class="roadmap-lead">패를 잘 조합하는 것에서,<br><strong>나만의 득점 방식을 만드는 게임으로.</strong></p><p class="roadmap-intro">Balatro처럼, 도전 중 얻는 보상과 효과로 자신만의 플레이 방식을 만들어 가려 합니다.</p><div class="roadmap-cards"><section><span class="roadmap-number">01</span><div><h3>패산 강화·변경</h3><p>도전 중 패를 추가·제거하거나 강화해, 원하는 역을 만들기 좋은 패산으로 바꿉니다.</p><small>구상 예시 · 만수패를 늘려 혼일색을 노리기</small></div></section><section><span class="roadmap-number">02</span><div><h3>특수 효과 조합</h3><p>여러 효과를 모아 같은 패로도 다른 방식으로 점수를 벌게 합니다. 어떤 효과를 함께 고를지가 새로운 전략이 됩니다.</p><small>구상 예시 · 낮은 역을 자주 화료할수록 강해지는 조합</small></div></section><section><span class="roadmap-number">03</span><div><h3>이카사마</h3><p>제한된 기회에 패나 도라 등에 개입해 불리한 상황을 바꿉니다. 기술을 언제 쓸지, 언제 아낄지 선택합니다.</p><small>구상 예시 · 필요한 패를 찾거나 도라 표시패 바꾸기</small></div></section></div><p class="roadmap-note">현재 버전은 패 조합·교환·리치의 기본 재미를 확인하는 단계입니다. 위 기능과 예시는 개발 방향을 설명하는 구상이며, 세부 규칙과 구현 내용은 바뀔 수 있습니다.</p><button class="primary roadmap-return" data-action="close-roadmap">작탁으로 돌아가기</button>`;
  $('#roadmap-dialog').showModal();
}
function showIntro(){
  $('#settings-dialog').close();
  $('#intro-dialog').innerHTML=`<div class="intro-art" aria-hidden="true">${[0,1,2,9,10,11,32].map(t=>tile(t)).join('')}</div><div class="eyebrow">밤의 작탁에 오신 것을 환영합니다</div><h2>익숙한 패로,<br> 새로운 한 판.</h2><p class="intro-goal">패산이 다 떨어질 때까지<br><strong>최대한 높은 점수를 모으세요.</strong></p><div class="intro-steps"><div><span>01</span><p><b>손패와 바닥패를 합쳐 화료</b>가운데에 직접 14장을 놓습니다. 역은 필요합니다.</p></div><div><span>02</span><p><b>한 번의 화료로 끝나지 않아요</b>남긴 패로 다음 손을 이어가며 점수를 쌓습니다.</p></div><div><span>03</span><p><b>텐파이라면 리치로 승부</b>손패 텐파이로 선언하거나, 교환 직후 바닥패를 조합하세요. 첫 4쯔모 안에 화료하면 일발!</p></div></div><p class="intro-note">상대·울기·깡 없음 · 부수 대신 전용 점수표 사용<br>진행 가능한 행동이 모두 막혀도 도전이 끝납니다.</p><button class="primary intro-start" data-action="begin">작탁에 앉기</button><button class="quiet" data-action="intro-rules">자세한 게임 방법</button>`;
  $('#intro-dialog').showModal();
}
let riichiChoices=[];
function showRiichiChoices(){
  riichiChoices=game.riichiCandidates(12);
  if(game.handWaits.length){const key=game.s.hand.map(t=>t.type).sort((a,b)=>a-b).join(',');riichiChoices=[game.s.hand.slice(),...riichiChoices.filter(ts=>ts.map(t=>t.type).sort((a,b)=>a-b).join(',')!==key)];}
  $('#riichi-dialog').innerHTML=`<div class="dialog-heading"><h2>리치할 13장 선택</h2><button class="quiet" data-action="close-riichi" aria-label="리치 선택 닫기">✕</button></div><p class="empty-inspector">${game.s.poolRiichiOpen?'패 교환 직후라 바닥패를 포함할 수 있습니다. 추가 공개하면 이 기회는 끝납니다.':'현재 손패 13장으로 리치합니다. 바닥패 사용은 교환 직후에만 가능합니다.'} 선택 후 중앙에서 확인하고 리치를 선언하세요. 교환 기회·회수 한도는 소비하지 않습니다.</p><p class="small muted">후보는 일부만 표시합니다. 창을 닫고 중앙에 직접 13장을 골라도 됩니다.</p><div class="riichi-choices">${riichiChoices.map((ts,i)=>`<section class="candidate"><div class="tiles">${ts.map(t=>tile(t,{mini:true})).join('')}</div><p class="small">대기 ${waits(ts.map(t=>t.type)).map(tileName).join(' · ')} · 바닥패 ${ts.filter(t=>game.s.floor.some(f=>f.id===t.id)).length}장 사용</p><button data-action="pick-riichi" data-index="${i}">이 13장 선택</button></section>`).join('')}</div>`;
  $('#riichi-dialog').showModal();
}
function askNew(){
  if(game.s.phase==='lost'||(!game.s.actions&&!game.s.score)){newSeed();return;}
  $('#confirm-dialog').innerHTML=`<div class="dialog-heading"><h2>새 도전을 시작할까요?</h2></div><p class="empty-inspector">진행 중인 ${fmt(game.s.score)}점의 도전은 초기화됩니다. 최고 기록은 도전이 끝났을 때 저장됩니다.</p><div class="dialog-actions"><button data-action="cancel-new">이어서 플레이</button><button class="primary" data-action="confirm-new">새 패산으로 시작</button></div>`;
  $('#confirm-dialog').showModal();
}
function newSeed(){config={...config,seed:randomSeed()};start(new Game(config));}

function sourceClick(source,id){
  const s=game.s;
  if(mode==='modify'){
    const arr=source==='hand'?discardSelection:takeSelection;
    if(!arr.includes(id)&&arr.length>=(source==='hand'?game.config.maxModify:game.remainingTake)){notify('선택 가능한 장수를 초과했습니다.');return;}
    toggle(arr,id);render();return;
  }
  if(s.phase==='recovery'&&source==='floor'){
    if(!takeSelection.includes(id)&&takeSelection.length>=Math.min(game.remainingTake,13-s.hand.length)){notify('회수 한도를 초과했습니다.');return;}
    toggle(takeSelection,id);render();return;
  }
  if(!game.active)return;
  if(staged.length>=14){notify('제출 공간은 14장까지입니다. 먼저 한 장을 되돌려 주세요.');return;}
  if(!staged.includes(id)){staged.push(id);winId=id;}hint=null;render();
}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-action]');if(!button||button.disabled)return;
  const action=button.dataset.action,id=Number(button.dataset.id);
  if(['hand','floor'].includes(action)){sourceClick(action,id);return;}
  if(action==='unstage'){staged=staged.filter(x=>x!==id);if(winId===id)winId=staged.at(-1)??null;render();return;}
  if(action==='undiscard'){discardSelection=discardSelection.filter(x=>x!==id);render();return;}
  if(action==='untake'){takeSelection=takeSelection.filter(x=>x!==id);render();return;}
  if(action==='open')run(()=>game.openBase(),{reset:false});
  else if(action==='reveal')run(()=>game.reveal(),{reset:false});
  else if(action==='submit')run(()=>game.submit(staged,winId));
  else if(action==='modify'){resetSelections();mode='modify';render();}
  else if(action==='confirm-modify')run(()=>game.modify(discardSelection,takeSelection));
  else if(action==='cancel-mode'||action==='clear'){resetSelections();render();}
  else if(action==='next')run(()=>game.nextAttempt(takeSelection));
  else if(action==='riichi'){if(game.canRiichiSelection(staged))run(()=>game.declareRiichi(staged));else showRiichiChoices();}
  else if(action==='pick-riichi'){staged=riichiChoices[Number(button.dataset.index)].map(t=>t.id);winId=staged.at(-1);hint=null;$('#riichi-dialog').close();render();}
  else if(action==='close-riichi')$('#riichi-dialog').close();
  else if(action==='fast-riichi')run(()=>{while(game.s.phase==='riichi')game.drawRiichi();});
  else if(action==='emergency')run(()=>game.chooseEmergency(game.emergencyCandidates()[Number(button.dataset.index)]));
  else if(action==='hint'){hint=game.shapeHints(1)[0]||[];render();}
  else if(action==='settings')showSettings();
  else if(action==='scoring')showRules(true);
  else if(action==='intro')showIntro();
  else if(action==='roadmap')showRoadmap();
  else if(action==='close-roadmap')$('#roadmap-dialog').close();
  else if(action==='begin'){try{localStorage.setItem('midnight-intro-v2','seen');}catch{}$('#intro-dialog').close();}
  else if(action==='intro-rules'){$('#intro-dialog').close();showRules();}
  else if(action==='ask-new')askNew();
  else if(action==='cancel-new')$('#confirm-dialog').close();
  else if(action==='confirm-new'){$('#confirm-dialog').close();newSeed();}
  else if(action==='rules')showRules();
  else if(action==='close-settings')$('#settings-dialog').close();
  else if(action==='close-rules')$('#rules-dialog').close();
  else if(action==='restore-defaults'){for(const [key,value]of Object.entries(DEFAULTS)){const input=$(`#settings-form [name="${key}"]`);if(input)input.value=value;}}
  else if(action==='load-scenario'){const name=$('#scenario-select').value;$('#settings-dialog').close();start(createScenario(name,config));}
  else if(action==='restart')start(game.s.scenario?createScenario(game.s.scenario,config):new Game(game.config));
  else if(action==='new-seed')newSeed();
  else if(action==='export'){
    const url=URL.createObjectURL(new Blob([JSON.stringify(game.exportLog(),null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=`mahjong-lab-${game.config.seed.replace(/[^a-zA-Z0-9_-]/g,'_')}-${game.s.events.length}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('플레이 기록을 저장했습니다.');
  }
});
document.addEventListener('change',e=>{if(e.target.id==='winning-select'){winId=Number(e.target.value);render();}});
document.addEventListener('submit',e=>{
  if(e.target.id!=='settings-form')return;e.preventDefault();
  const data=Object.fromEntries(new FormData(e.target));config=new Game(data).config;
  try{localStorage.setItem('mahjong-lab-config',JSON.stringify(config));}catch{}
  $('#settings-dialog').close();start(new Game(config));
});
// Pointer capture keeps drag/drop consistent in embedded browsers and on touch screens.
let tileDrag=null,suppressClickUntil=0;
function clearTileDrag(){
  if(!tileDrag)return;
  tileDrag.preview?.remove();
  if(tileDrag.element.hasPointerCapture(tileDrag.pointerId))tileDrag.element.releasePointerCapture(tileDrag.pointerId);
  document.querySelector('.tray-zone')?.classList.remove('drag-over');
  document.querySelectorAll('.reorder-target').forEach(el=>el.classList.remove('reorder-target'));tileDrag=null;
}
document.addEventListener('dragstart',e=>{if(e.target.closest('.tile'))e.preventDefault();});
document.addEventListener('pointerdown',e=>{
  suppressClickUntil=0;
  const b=e.target.closest('[data-action]');
  if(e.button!==0||!game.active||!b||!['hand','floor','unstage'].includes(b.dataset.action)||tileDrag)return;
  tileDrag={id:Number(b.dataset.id),source:b.dataset.action,element:b,pointerId:e.pointerId,x:e.clientX,y:e.clientY,moved:false,preview:null};
  b.setPointerCapture(e.pointerId);
});
document.addEventListener('pointermove',e=>{
  if(!tileDrag||e.pointerId!==tileDrag.pointerId)return;
  if(!tileDrag.moved&&Math.hypot(e.clientX-tileDrag.x,e.clientY-tileDrag.y)<7)return;
  e.preventDefault();tileDrag.moved=true;
  if(!tileDrag.preview){
    const preview=tileDrag.element.cloneNode(true);preview.removeAttribute('data-action');preview.removeAttribute('data-id');
    preview.setAttribute('aria-hidden','true');preview.tabIndex=-1;preview.classList.add('drag-preview');
    const rect=tileDrag.element.getBoundingClientRect();preview.style.width=`${rect.width}px`;preview.style.height=`${rect.height}px`;
    document.body.append(preview);tileDrag.preview=preview;
  }
  tileDrag.preview.style.left=`${e.clientX}px`;tileDrag.preview.style.top=`${e.clientY}px`;
  const under=document.elementFromPoint(e.clientX,e.clientY);
  document.querySelector('.tray-zone')?.classList.toggle('drag-over',!!under?.closest('.tray-zone'));
  document.querySelectorAll('.reorder-target').forEach(el=>el.classList.remove('reorder-target'));
  if(tileDrag.source==='unstage')under?.closest('#submission-tray > .tile, #submission-tray > .slot')?.classList.add('reorder-target');
});
document.addEventListener('pointerup',e=>{
  if(!tileDrag||e.pointerId!==tileDrag.pointerId)return;
  const {id,source,moved}=tileDrag;
  const under=document.elementFromPoint(e.clientX,e.clientY),overTray=!!under?.closest('.tray-zone');
  const target=under?.closest('#submission-tray > .tile, #submission-tray > .slot');
  const targetIndex=target?Array.from(target.parentElement.children).indexOf(target):-1;
  clearTileDrag();if(!moved)return;
  suppressClickUntil=performance.now()+300;e.preventDefault();
  if(!game.active||!overTray||!game.pool.some(t=>t.id===id))return;
  if(source==='unstage'){
    if(mode!=='normal'||targetIndex<0)return;
    const from=staged.indexOf(id);if(from<0)return;
    staged.splice(from,1);staged.splice(Math.min(targetIndex,staged.length),0,id);render();return;
  }
  const selected=mode==='modify'?(source==='hand'?discardSelection:takeSelection):staged;
  if(!selected.includes(id))sourceClick(source,id);
});
document.addEventListener('pointercancel',clearTileDrag);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&tileDrag){suppressClickUntil=performance.now()+300;clearTileDrag();}});
document.addEventListener('click',e=>{if(performance.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
render();
try{if(localStorage.getItem('midnight-intro-v2')!=='seen')showIntro();}catch{showIntro();}
