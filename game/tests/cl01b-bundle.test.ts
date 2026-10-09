import {it,expect} from 'vitest';
import {build} from 'vite';
it('actual formal build never includes retired UI constructors',async()=>{
 const ids:string[]=[];
 await build({configFile:'vite.config.ts',logLevel:'error',plugins:[{name:'cl01b-module-audit',generateBundle(_,bundle){for(const chunk of Object.values(bundle))if(chunk.type==='chunk')ids.push(...Object.keys(chunk.modules));}}],build:{write:false}});
 expect(ids.length).toBeGreaterThan(100);
 expect(ids.filter(id=>/\/src\/(ui|hand-drawer|card-motion|build-ui)\.ts$/.test(id))).toEqual([]);
},30000);
