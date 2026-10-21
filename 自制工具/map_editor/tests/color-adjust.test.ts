import test from 'node:test';import assert from 'node:assert/strict';import {adjustColor} from '../core/color-adjust.ts';
test('color adjustments preserve neutral values, clamp brightness and remove saturation',()=>{assert.equal(adjustColor('#123456',0,0,0),'#123456');assert.equal(adjustColor('#123456',100,0,0),'#ffffff');assert.equal(adjustColor('#123456',-100,0,0),'#000000');const gray=adjustColor('#ff0000',0,0,-100);assert.equal(gray.slice(1,3),gray.slice(3,5));assert.equal(gray.slice(3,5),gray.slice(5,7));});

test('hue rotates primary colors and wraps without changing gray',()=>{assert.equal(adjustColor('#ff0000',0,0,0,120),'#00ff00');assert.equal(adjustColor('#ff0000',0,0,0,-120),'#0000ff');assert.equal(adjustColor('#808080',0,0,0,90),'#808080');});
