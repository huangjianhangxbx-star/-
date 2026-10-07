import {defineConfig} from 'vitest/config';
import {actionLabAssets} from './action-lab-assets';
export default defineConfig({plugins:[actionLabAssets()],test:{include:['tests/**/*.test.ts']},server:{host:'127.0.0.1',port:5173,strictPort:true}});
