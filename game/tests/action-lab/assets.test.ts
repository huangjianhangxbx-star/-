import {expect,it} from 'vitest';
import {assetPath} from '../../action-lab-assets';
it('only exact local evaluation resources can be served',()=>{
 expect(assetPath('/__al01-assets/blue/unit.json','127.0.0.1')).toMatch(/blue[/\\]unit.json$/);
 for(const path of ['/__al01-assets/../intake.json','/__al01-assets/%2e%2e/intake.json','/__al01-assets/zombie/1僵尸.png','/__al01-assets/blue/unit.json?x=1'])expect(assetPath(path,'127.0.0.1')).toBeNull();
 expect(assetPath('/__al01-assets/blue/unit.json','192.168.1.2')).toBeNull();
});
