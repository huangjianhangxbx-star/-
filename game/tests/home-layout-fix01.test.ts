import {it, expect} from 'vitest';
import {createExplorationEntry, command} from '../src/core/engine';
import {initializeMapWorld, prepareTravel, commitTravel, type TravelTicket} from '../src/core/map-travel';
import {MAP_EDGES} from '../src/core/map-definitions';
import {terrainFits, segmentClear, clearShot, radius} from '../src/core/spatial';
import {navigate} from '../src/core/navigation';
import {activityAnchors} from '../src/core/activity-anchors';
import {groundBatches} from '../src/view/scene2d/ground-batch';
import {scene2DAssetPath} from '../scene2d-assets';

function home() {
  const s = createExplorationEntry();
  s.sessionMode = 'exploration';
  command(s, {type:'selectJourney', journey:'exploration', seed:18});
  command(s, {type:'carry', gold:0, vitality:0});
  initializeMapWorld(s);
  return s;
}

it('keeps the garden outside a real house wall and leaves a walkable rear opening', () => {
  const s = home();
  expect(terrainFits(s, {x:2, y:2})).toBe(false); // Outside the courtyard, not a floor tile.
  expect(terrainFits(s, {x:5, y:4})).toBe(false); // West house wall.
  expect(clearShot(s, {x:4, y:4}, {x:6, y:4})).toBe(false);
  expect(segmentClear(s, {x:6, y:6.5}, {x:4, y:6.5})).toBe(true);
  for (const u of s.units.filter(u => ['hunter','ranger'].includes(u.id))) {
    expect(navigate(s, u.pos, {x:4, y:8}, false, false, radius(u)).length).toBeGreaterThan(0);
  }
  for (const a of activityAnchors(s)) {
    expect(a.reachable.hunter, a.id).toBe(true);
    expect(a.reachable.ranger, a.id).toBe(true);
  }
});

it('initializes the original resident and traveller at the revised legal home positions', () => {
  const s = home(), resident = s.units.find(u => u.id === 'ranger')!;
  expect(s.units.find(u => u.id === 'hunter')!.pos).toEqual({x:16, y:7.8});
  expect(resident.pos).toEqual({x:15.4, y:4.8});
  const visit = s.world!.visit.generation;
  for (const index of [0, 1]) {
    const ticket:TravelTicket = {id:index+1, worldId:s.world!.id, placeId:s.world!.visit.placeId,
      visit:s.world!.visit.generation, actor:s.controlledBodyId!, control:s.controlRevision??0, edge:MAP_EDGES[index]};
    commitTravel(s, prepareTravel(s, ticket));
  }
  expect(s.units.filter(u => u.id === 'ranger')).toEqual([resident]);
  expect(s.world!.visit.generation).toBe(visit + 2);
  expect(terrainFits(s, s.units.find(u => u.id === 'hunter')!.pos)).toBe(true);
});

it('clips a long-plank repeat to the exact room edge rather than painting outside it', () => {
  const batches = groundBatches(1.75, 'mixed', {x:6, y:2, width:12, height:8});
  for (const batch of batches) {
    const points = batch.geometry.getAttribute('position');
    for (let i=0; i<points.count; i++) {
      expect(points.getX(i)).toBeGreaterThanOrEqual(5.5);
      expect(points.getX(i)).toBeLessThanOrEqual(17.5);
      expect(points.getY(i)).toBeGreaterThanOrEqual(-9.5);
      expect(points.getY(i)).toBeLessThanOrEqual(-1.5);
    }
    batch.geometry.dispose();
  }
});

it('serves only the selected local home wall aliases on loopback', () => {
  expect(scene2DAssetPath('/__scene2d-assets/home-wall/manifest.json', '127.0.0.1')).not.toBeNull();
  expect(scene2DAssetPath('/__scene2d-assets/home-wall/47.png', '::1')).not.toBeNull();
  for (const url of ['/__scene2d-assets/home-wall/0.png','/__scene2d-assets/home-wall/48.png',
    '/__scene2d-assets/home-wall/../private.json']) expect(scene2DAssetPath(url,'127.0.0.1')).toBeNull();
  expect(scene2DAssetPath('/__scene2d-assets/home-wall/1.png','10.0.0.1')).toBeNull();
});
