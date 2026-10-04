import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),core=require('../dist/workshop.cjs'),{commitPublish}=require('../desktop/publish-store.cjs');
const a=core.createAsset('a');a.cells=[{x:0,y:0,z:0,color:0}];const p=await core.createPublishPlan({kind:'asset',document:a},'interrupted','glb-fbx',{workshopVersion:'test',sourceFingerprint:'a'.repeat(64)});
await commitPublish(process.argv[2],p,{converter:async()=>{process.exit(73);}});
