import {normalizeConfig} from './game.js';
const storageKey='midnight-table-records-v2';
export function recordKey(config){const {seed,...rules}=normalizeConfig(config);return 'exchange-riichi-v1:'+JSON.stringify(rules);}
export function readRecord(storage,config){
  try{const all=JSON.parse(storage.getItem(storageKey)||'{}'),record=all[recordKey(config)];return record&&Number.isFinite(record.score)&&record.score>=0?record:null;}catch{return null;}
}
export function saveRecord(storage,game){
  if(game.s.phase!=='lost'||game.s.scenario)return {saved:false,record:readRecord(storage,game.config)};
  const previous=readRecord(storage,game.config);if(previous&&previous.score>=game.s.score)return {saved:false,record:previous};
  const record={score:game.s.score,seed:game.config.seed,wins:game.s.events.filter(e=>e.action==='win').length,date:new Date().toISOString()};
  try{const all=JSON.parse(storage.getItem(storageKey)||'{}');all[recordKey(game.config)]=record;storage.setItem(storageKey,JSON.stringify(all));return {saved:true,record};}catch{return {saved:false,record:previous};}
}
