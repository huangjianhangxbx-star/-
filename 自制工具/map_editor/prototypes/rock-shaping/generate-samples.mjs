// Run from map_editor: node --experimental-strip-types prototypes/rock-shaping/generate-samples.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {shapeRock} from '../../core/rock-shaping.ts';
import {createFixture,presetSampleOptions} from './fixtures.ts';
import {createAsset,validateAsset} from '../../core/workshop-documents.ts';
import {paletteFromMap} from '../../core/palette.ts';
import {meshMap} from '../../core/mesher.ts';

const directory=path.dirname(fileURLToPath(import.meta.url));
const output=path.join(directory,'samples');await fs.mkdir(output,{recursive:true});
const records=[];
for(const [preset,fixture] of [['columnar-wall','block'],['terraced-rim','platform'],['terraced-rim','l-platform']]) {
 const source=createFixture(fixture);
 for(const seed of [17,73,211]) {
  const options={...presetSampleOptions(preset),seed};
  const start=performance.now(),result=shapeRock(source,options),computeMs=performance.now()-start;
  assert.deepEqual(result.diagnostics.blockingReasons,[]);
  assert.ok(result.removedCellKeys.length>0);
  const meshStart=performance.now(),quads=meshMap({cells:result.cells}).length,meshMs=performance.now()-meshStart;
  records.push({fixture,preset,seed,sourceCount:source.length,resultCount:result.cells.length,quads,computeMs,meshMs,sourceStamp:result.sourceStamp,recipe:result.recipe,diagnostics:result.diagnostics});
  // Keep one actual, independently readable native sample per shape, including L rim.
  if(seed!==17) continue;
  const id=`rock-${fixture}-${seed}`;
  const asset=createAsset(id);asset.schema='xinghai-workshop-asset-2';asset.name=`${preset} SAMPLE ${seed}`;
  asset.palette=['#92969b'];asset.materialProfile=paletteFromMap({mapId:id,revision:0,voxelSize:.25,palette:asset.palette});
  asset.canvases=[{canvasId:'rock',name:'灰模',visible:true,locked:false,voxelStepM:options.cellSize??.25,originTicks:[0,0,0],cells:result.cells,protectedColumns:[]}];
  asset.objects=[{objectId:'rock-object',name:asset.name,canvasIds:['rock'],originTicks:[0,0,0],cellKeys:result.cells.map(c=>`${c.x},${c.y},${c.z}`)}];
  const validated=validateAsset(asset);
  await fs.writeFile(path.join(output,`${id}.xhmodule.json`),JSON.stringify(validated));
  const reread=validateAsset(JSON.parse(await fs.readFile(path.join(output,`${id}.xhmodule.json`),'utf8')));
  assert.deepEqual(reread.canvases[0].cells,result.cells);
 }
}
await fs.writeFile(path.join(output,'recipes-and-metrics.json'),JSON.stringify({scope:'R0–R3 prototype; no live Workshop integration',runtime:process.version,platform:process.platform,records},null,2));
console.log(JSON.stringify(records.map(({fixture,seed,sourceCount,resultCount,computeMs,meshMs})=>({fixture,seed,sourceCount,resultCount,computeMs,meshMs})),null,2));
