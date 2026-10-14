import {defineConfig} from 'vitest/config';
import {scene2DAssets} from './scene2d-assets';
import {actionLabAssets} from './action-lab-assets';
export default defineConfig({plugins:[actionLabAssets(),scene2DAssets()],test:{include:['tests/**/*.test.ts']},server:{host:'127.0.0.1',port:5173,strictPort:true}});
