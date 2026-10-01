import {createGame as accountGame,command} from '../src/core/engine';
import {makeCard} from '../src/core/cards';
/** Explicit funded account and old-effect hand only for unrelated regression arenas. */
export function createGame(mode?:string){const s=accountGame(mode);s.economy.account.vitality=40;command(s,{type:'carry',gold:0,vitality:40});s.cards.push(...(['heal','barricade','power','cooldown'] as const).map(k=>makeCard(s,k)));return s;}
