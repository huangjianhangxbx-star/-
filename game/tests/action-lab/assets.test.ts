import {expect,it} from 'vitest';
import {assetPath} from '../../action-lab-assets';
it('AUDIO-01 original music candidates are loopback-only and allowlisted',()=>{
 expect(assetPath('/__al01-assets/music/title.wav','127.0.0.1')).toMatch(/AUDIO-01[/\\]music[/\\]title.wav$/);
 expect(assetPath('/__al01-assets/music/other.wav','127.0.0.1')).toBeNull();
 expect(assetPath('/__al01-assets/music/title.wav','192.168.1.2')).toBeNull();
});
it('only exact local evaluation resources can be served',()=>{
 expect(assetPath('/__al01-assets/blue/unit.json','127.0.0.1')).toMatch(/blue[/\\]unit.json$/);
 for(const path of ['/__al01-assets/../intake.json','/__al01-assets/%2e%2e/intake.json','/__al01-assets/zombie/1僵尸.png','/__al01-assets/blue/unit.json?x=1'])expect(assetPath(path,'127.0.0.1')).toBeNull();
 expect(assetPath('/__al01-assets/blue/unit.json','192.168.1.2')).toBeNull();
});
it('AL02 serves only the selected original effect sprites on localhost',()=>{
 expect(assetPath('/__al01-assets/effects/column.png','127.0.0.1')).toMatch(/AL-02[/\\]assets[/\\]effects[/\\]column.png$/);
 expect(assetPath('/__al01-assets/effects/axe.png','127.0.0.1')).not.toBeNull();
 expect(assetPath('/__al01-assets/column/other.png','127.0.0.1')).toBeNull();
});
it('S3 ice texture is an exact localhost-only resource, not a directory or bundle endpoint',()=>{
 expect(assetPath('/__al01-assets/effects/ice-ground.png','127.0.0.1')).toMatch(/CR-SKILL-01[/\\]assets[/\\]effects[/\\]ice-ground.png$/);
 for(const path of ['/__al01-assets/effects/other.png','/__al01-assets/effects/ice-ground.png?x=1','/__al01-assets/../CR-SKILL-01/ice.png'])expect(assetPath(path,'127.0.0.1')).toBeNull();
 expect(assetPath('/__al01-assets/effects/ice-ground.png','192.168.1.2')).toBeNull();
});
