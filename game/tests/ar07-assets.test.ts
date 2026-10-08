import {test,expect} from 'vitest';
import {assetPath} from '../action-lab-assets';
test('xx assets are exact localhost whitelist paths, never arbitrary source files',()=>{
 expect(assetPath('/__al01-assets/xx/rozeul.json','127.0.0.1')).toMatch(/AR-07-X01/);
 expect(assetPath('/__al01-assets/xx/rozeul.spine','127.0.0.1')).toBeNull();
 expect(assetPath('/__al01-assets/xx/rozeul.json','192.168.1.2')).toBeNull();
 expect(assetPath('/__al01-assets/xx/../rozeul.json','127.0.0.1')).toBeNull();
});
