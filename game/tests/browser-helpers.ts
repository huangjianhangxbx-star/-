import type {Page} from '@playwright/test';
/** Real model selection; skill readiness is explicit fixture setup, not an initial-state assumption. */
export async function selectModel(page:Page,id:string,ready=true){
 const p=await page.evaluate(({id,ready})=>{const s=(window as any).prototype.state;const u=s.units.find((u:any)=>u.id===id);if(ready)u.skillCd=0;return (window as any).prototype.project(u.pos);},{id,ready});
 await page.mouse.click(p.x,p.y);
}

/** Explicit funded entry for legacy combat assertions; economic-flow tests use the real zero account. */
export async function prepareRegression(page:Page){
 await page.waitForFunction(()=>(window as any).prototype?.state);
 await page.evaluate(async()=>{const s=(window as any).prototype.state;const {command}=await import('/src/core/engine.ts' as string);const {makeCard}=await import('/src/core/cards.ts' as string);if(s.phase==='account'){s.economy.account.vitality=40;command(s,{type:'carry',gold:0,vitality:40});}else s.economy.carried.vitality=40;for(const kind of ['heal','barricade','power','cooldown'] as const)s.cards.push(makeCard(s,kind));});
}
