import {build} from 'esbuild';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {copyFile} from 'node:fs/promises';
const directory=path.dirname(fileURLToPath(import.meta.url));
await build({entryPoints:[path.join(directory,'viewer.ts')],outfile:path.join(directory,'viewer.js'),bundle:true,format:'iife',platform:'browser',target:'es2022',minify:true,legalComments:'none'});
await copyFile(path.resolve(directory,'../../node_modules/three/LICENSE'),path.join(directory,'THIRD-PARTY-LICENSE.txt'));
console.log('TOOL-011 isolated viewer: '+path.join(directory,'index.html'));
