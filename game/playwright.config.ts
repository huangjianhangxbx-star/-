import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'*.spec.ts',timeout:30000,use:{baseURL:'http://127.0.0.1:5173',viewport:{width:1440,height:900},launchOptions:{executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--use-angle=swiftshader','--enable-webgl']}},reporter:'list',outputDir:'../work/browser-results',webServer:{command:'npm run dev',url:'http://127.0.0.1:5173',reuseExistingServer:true}});



