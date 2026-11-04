// Recipes have unlimited copies; all rule and score gear share five slots.
const PREVIOUS=[
 {id:'patternWind',kind:'recipe',name:'사풍 도안',price:1,special:'wind',text:'바닥패 1장을 동·남·서·북 중 하나로 해석. 도안 자체 점수 없음. 중복 구매는 다른 패에 우선 분산하며 같은 패에 중복되어도 속성은 늘지 않음.'},
 {id:'patternDual',kind:'recipe',name:'겹무늬 도안',price:1,special:'dual',numeric:true,text:'숫자패 1장을 같은 숫자의 만수·삭수 중 하나로 해석. 도안 자체 점수 없음. 중복은 다른 패에 우선 분산.'},
 {id:'patternDragon',kind:'recipe',name:'삼원 도안',price:1,special:'dragon',text:'바닥패 1장을 백·발·중 중 하나로 해석. 역패·삼원패 조합을 만들기 쉬워짐. 도안 자체 점수 없음.'},
 {id:'patternMirror',kind:'recipe',name:'거울 도안',price:1,special:'mirror',numeric:true,text:'숫자패를 원래 숫자 또는 10에서 뺀 숫자로 해석. 1↔9, 2↔8, 3↔7, 4↔6. 5는 대상 제외. 종류는 유지. 도안 자체 점수 없음.'},
 {id:'patternNeighbor',kind:'recipe',name:'옆 숫자 도안',price:1,special:'neighbor',numeric:true,text:'숫자패를 원래 숫자 또는 다음 숫자로 해석. 4는 4·5, 9는 9·1. 종류는 유지. 도안 자체 점수 없음.'},
 {id:'wind',kind:'consumable',name:'사풍 바꿔치기',price:3,text:'손패 또는 바닥패 1장을 모든 바람패로 취급. 기존 형태 조작을 대체. 사용하면 소멸.'},
 {id:'dual',kind:'consumable',name:'겹무늬 먹',price:3,text:'손패 또는 바닥의 숫자패 1장을 같은 숫자의 만수·삭수로 취급. 기존 형태 조작을 대체. 사용하면 소멸.'},
 {id:'shift',kind:'consumable',name:'한 칸 비틀기',price:2,text:'손패 또는 바닥의 숫자패 1장을 +1. 9는 1로. 사용하면 소멸.'},
 {id:'exchange',kind:'consumable',name:'소매 바꿔치기',price:2,text:'손패 또는 바닥패 1장을 버리고 패산 1장으로 교체. 기존 도안 효과도 버려짐. 사용하면 소멸.'},
 {id:'closed',kind:'gear',name:'정숙의 부적',price:6,text:'멘젠으로 화료하면 +2배율.'},
 {id:'open',kind:'gear',name:'드러난 패',price:6,text:'공개 몸통이 있는 화료는 +2배율.'},
 {id:'rig',kind:'gear',name:'위조 각인',price:7,text:'화료에 사용한 강화·조작패 1장마다 기본점 +20. 한 패의 중복 도안은 1장으로 셈.'},
 {id:'overlap',finalStage:true,kind:'gear',name:'겹침의 인장',price:7,text:'치또이츠와 일반형이 함께 성립하면 배율 ×2. 2챕터 보스 상점부터 등장.'},
 {id:'doraLens',kind:'gear',name:'도라 돋보기',price:5,text:'도라·뒷도라·적도라가 포함된 화료는 기본점 +30.'},
 {id:'patience',kind:'gear',name:'기다림의 태엽',price:7,text:'리치 후 쯔모기리마다 최종 배율 계수 +0.25. 최대 ×2.'},
 {id:'collector',kind:'gear',name:'역 수집가',price:8,text:'서로 다른 역 1종마다 +1배율, 한 화료에서 최대 +6.'},
 {id:'purse',kind:'gear',name:'복주머니',price:4,text:'화료마다 2냥. 라운드당 최대 6냥.'},
 {id:'bookSimple',kind:'gear',name:'탕야오 비급',price:4,text:'탕야오 화료의 기본점 +10, 배율 +1. 장비 1칸 사용.',match:['탕야오']},
 {id:'bookFlush',kind:'gear',name:'일색 비급',price:4,text:'혼일색 또는 청일색 화료의 기본점 +10, 배율 +1. 중복 적용 없음. 장비 1칸 사용.',match:['혼일색','청일색']},
 {id:'bookRiichi',kind:'gear',name:'리치 비급',price:4,text:'리치 화료의 기본점 +10, 배율 +1. 장비 1칸 사용.',match:['리치']},
 {id:'bookPairs',finalStage:true,kind:'gear',name:'치또이츠 비급',price:4,text:'치또이츠 화료의 기본점 +10, 배율 +1. 2챕터 보스 상점부터 등장. 장비 1칸 사용.',match:['치또이츠']},
 {id:'wideFloor',kind:'gear',name:'넓은 진열대',price:6,text:'다음 손부터 바닥패 5 → 6장. 장비 1칸 사용.'},
 {id:'pocket',kind:'gear',name:'넓은 소매',price:4,text:'소모품 보관 한도 2 → 3개. 장비 1칸 사용.'},
 {id:'discount',kind:'gear',name:'정비 계약',price:4,text:'상품·팩 가격 1냥 감소. 최소 1냥. 장비 1칸 사용.'},
 {id:'rerollPass',kind:'gear',name:'단골 증표',price:3,text:'상점 첫 재진열 가격 2 → 1냥. 이후 +1냥. 장비 1칸 사용.'},
 {id:'toolPack',kind:'pack',name:'소매 팩',price:3,text:'소모품 3개 공개 → 1개 선택. 보관칸 필요.',pool:'consumable'},
 {id:'gearPack',kind:'pack',name:'장비 팩',price:6,text:'규칙·득점 장비 최대 3개 공개 → 1개 선택. 장비 5칸 제한 공유.',pool:'gear'}
];
const CURRENT=[
 {id:'patternTriad',kind:'recipe',name:'삼색 도안',price:1,special:'triad',numeric:true,text:'숫자패 1장에 적용. 숫자를 유지하며 만수·통수·삭수 모두로 사용. 다른 종류 변경 도안과는 겹치지 않음.'},
 {id:'patternAdjacent',kind:'recipe',name:'이웃 도안',price:1,special:'adjacent',numeric:true,text:'숫자패 1장에 적용. 원래 숫자와 양옆 숫자로 사용. 4삭은 3·4·5삭. 1과 9는 연결하지 않음.'},
 {id:'patternDragon',kind:'recipe',name:'삼원 도안',price:1,special:'dragon',dragonsOnly:true,text:'백·발·중인 바닥패 1장에만 적용. 백·발·중 모두로 사용. 울면 사용한 종류로 고정.'},
 {id:'patternSleeve',kind:'recipe',name:'소매 도안',price:1,utility:true,text:'리치 전 바닥 단계에서 이 패와 고정되지 않은 손패 1장을 교환. 내보낸 손패는 버리며 멘젠 유지. 종류 변경 도안과 함께 부착 가능.'},
 {id:'patternHidden',kind:'recipe',name:'은밀 도안',price:1,utility:true,text:'이 패로 치·퐁해도 멘젠 유지. 몸통은 고정되며 암각으로 세지 않음. 대명깡·가깡에는 적용하지 않음.'},
 {id:'patternRefill',kind:'recipe',name:'보충 도안',price:1,utility:true,text:'이 패를 치·퐁·대명깡으로 가져오면 빈 바닥칸에 패산 1장을 보충. 도안 재적용 없음. 깡의 표시패·영상패를 먼저 확보. 패산이 없으면 미발동.'},
 {id:'wideFloor',kind:'gear',name:'넓은 진열대',price:6,text:'다음 손부터 바닥패 5 → 6장. 추가 패도 패산에서 가져옴. 장비 1칸.'},
 {id:'open',kind:'gear',name:'공개 수집가',price:6,text:'화료에 사용한 공개 몸통 1개마다 배율 +1. 은밀 도안으로 멘젠을 유지한 몸통도 공개 몸통으로 셈.'},
 {id:'closed',kind:'gear',name:'정숙의 부적',price:6,text:'멘젠 화료 시 최종 배율 ×1.5. 소매·은밀 도안으로 유지한 멘젠도 인정.'},
 {id:'rig',kind:'gear',name:'위조 감정사',price:7,text:'화료에 사용한 도안 패 1장마다 기본점 +20. 한 패의 여러 도안은 1장으로 셈. 소모품만 사용한 패는 제외.'},
 {id:'focus',kind:'gear',name:'한 우물',price:6,text:'획득 후 상점에서 목표 역 선택. 해당 역 화료 시 기본점 +20. 성공마다 다음 보너스 +10. 판매하면 성장 초기화.'},
 {id:'complex',kind:'gear',name:'복합 예술',price:7,text:'서로 다른 역 3종 이상 화료 시 최종 배율 ×1.5. 도라·조작·장비 보너스는 역 수에서 제외.'}
];
export const FOCUS_YAKU=['탕야오','혼일색','청일색','리치','또이또이','삼색동순'];
// Old holdings remain usable, but no longer appear in shops or packs.
export const CATALOG=[...CURRENT,...PREVIOUS.filter(x=>!CURRENT.some(y=>y.id===x.id)).map(x=>({...x,retired:x.kind==='recipe'||x.kind==='gear'}))];
export const SHOP_CATALOG=CATALOG.filter(x=>!x.retired);
export const itemById=id=>CATALOG.find(x=>x.id===id);
export const KIND_NAMES={recipe:'바닥패 도안',consumable:'일회용 소모품',gear:'규칙·득점 장비',pack:'선택 팩'};
export const RECIPE_TAGS={patternTriad:'삼색',patternAdjacent:'이웃',patternSleeve:'소매',patternHidden:'은밀',patternRefill:'보충',patternWind:'사풍',patternDual:'겹무늬',patternDragon:'삼원',patternMirror:'거울',patternNeighbor:'옆 숫자'};
