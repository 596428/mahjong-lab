// Original SVG tile faces: no external fonts, images, or sprite dependencies.
const spots={1:[[24,30]],2:[[24,17],[24,43]],3:[[12,14],[24,30],[36,46]],4:[[13,17],[35,17],[13,43],[35,43]],5:[[12,14],[36,14],[24,30],[12,46],[36,46]],6:[[13,12],[35,12],[13,30],[35,30],[13,48],[35,48]],7:[[12,10],[24,18],[36,26],[13,40],[35,40],[13,53],[35,53]],8:[[13,9],[35,9],[13,24],[35,24],[13,39],[35,39],[13,54],[35,54]],9:[[11,12],[24,12],[37,12],[11,30],[24,30],[37,30],[11,48],[24,48],[37,48]]};
const bambooSpots={...spots,3:[[24,12],[13,43],[35,43]],7:[[24,9],[12,25],[24,25],[36,25],[12,46],[24,46],[36,46]]};
export function faceMarkup(type){
  if(type<9)return `<span class="man-number">${'一二三四五六七八九'[type]}</span><span class="man-character">萬</span>`;
  if(type>=27)return type===31?'<span class="white-dragon"></span>':`<span class="honor-character">${['東','南','西','北','','發','中'][type-27]}</span>`;
  const n=type%9+1;
  if(type<18){
    return `<svg viewBox="0 0 48 62" aria-hidden="true">${spots[n].map(([x,y],i)=>{
      const color=n===1?'#235e64':n===5&&i===2||n===7&&i<3||n===9&&i>=3&&i<6?'#ae4136':'#2e5676',r=n===1?17:n>=7?5:6.8;
      return `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${color}" stroke-width="${n===1?3:2}"/><circle cx="${x}" cy="${y}" r="${r*.47}" fill="none" stroke="${color}" stroke-width="1.4"/><circle cx="${x}" cy="${y}" r="${n===1?3:1.3}" fill="${color}"/>`;
    }).join('')}</svg>`;
  }
  if(n===1)return `<svg viewBox="0 0 48 62" aria-hidden="true"><path d="M14 48 31 29 24 25 10 52M22 40 35 48 26 36" fill="#236d50"/><path d="M19 39C6 35 9 22 19 21L26 23C30 24 33 19 30 15L25 12C19 9 20 3 27 4L32 8 36 7 33 12C41 22 38 35 29 40Z" fill="#287759"/><path d="m28 4 2-3 3 5" fill="#b34437"/><path d="m33 9 8 1-7 4" fill="#ac9039"/><circle cx="28" cy="9" r="1.4" fill="#f5efd9"/><path d="M15 24Q34 24 22 36M14 28l14 3M16 32l9 4" fill="none" stroke="#e7d596" stroke-width="1.5"/><path d="m21 40-2 9-5 1m13-11 3 9h6" fill="none" stroke="#9d4a36" stroke-width="2"/></svg>`;
  return `<svg viewBox="0 0 48 62" aria-hidden="true">${bambooSpots[n].map(([x,y],i)=>{
    const color=n===5&&i===2||n===9&&i>=3&&i<6?'#a84332':'#287350';
    return `<g stroke="${color}" fill="${color}" transform="translate(${x} ${y})"><rect x="-2.1" y="-6" width="4.2" height="12" rx="1.6"/><path d="M-4-5H4M-4 5H4M-3 0H3" stroke-width="1.8"/><path d="M0-5V5" stroke="#c9d5a9" stroke-width=".9"/></g>`;
  }).join('')}</svg>`;
}
