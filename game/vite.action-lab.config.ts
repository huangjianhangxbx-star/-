import {defineConfig} from 'vite';
import {resolve} from 'node:path';
export default defineConfig({publicDir:false,build:{outDir:'../work/AL-01/build',emptyOutDir:true,rollupOptions:{input:resolve(import.meta.dirname,'action-lab.html')}}});
