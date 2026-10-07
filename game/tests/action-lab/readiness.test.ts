import {expect, it} from 'vitest';
import {playableReadiness} from '../../src/action-lab/profiles/reference';

it('a visible placeholder and player tracks cannot silently enable unknown zombie damage', () => {
  const status = playableReadiness({playerTracks:true,playerRate:true,zombieTrack:false,movement:true,hitGeometry:false,presentation:true});
  expect(status.ready).toBe(false);
  expect(status.missing).toEqual(['zombieTrack','hitGeometry']);
});
it('only a complete explicitly supplied contract enables the playable gate', () => {
  expect(playableReadiness({playerTracks:true,playerRate:true,zombieTrack:true,movement:true,hitGeometry:true,presentation:true}).ready).toBe(true);
});
