// Solmar Bay — the city itself: road grid, districts, buildings, parks,
// the beach and the marina. Everything is generated once from a seed so the
// map is identical every run, and every other system asks this module where
// things are (is this a road? is this spot inside a building?).

import { clamp, makeRng, pick, randInt, range } from './util.js';

export const WORLD_W = 3600;
export const WORLD_H = 2600;
export const ROAD_W = 96; // drivable asphalt width
export const BLOCK = 400; // distance between road centrelines

// Road centrelines. Vertical roads run the full height, horizontal the width.
export const ROAD_XS = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000, 3400];
export const ROAD_YS = [200, 600, 1000, 1400, 1800, 2200];

export const DISTRICTS = [
  { name: 'Downtown Solmar', x: 0, y: 0, w: 1600, h: 1200, tint: '#2b3a55' },
  { name: 'Old Town', x: 1600, y: 0, w: 1000, h: 1200, tint: '#54432e' },
  { name: 'Marina District', x: 2600, y: 0, w: 1000, h: 1200, tint: '#274b5e' },
  { name: 'Harbor Yards', x: 0, y: 1200, w: 1600, h: 1100, tint: '#3a3f45' },
  { name: 'Palm Heights', x: 1600, y: 1200, w: 1000, h: 1100, tint: '#3d5238' },
  { name: 'Solmar Beach', x: 2600, y: 1200, w: 1000, h: 1100, tint: '#8a6f3f' },
  { name: 'The Boardwalk', x: 0, y: 2300, w: 3600, h: 300, tint: '#a8874f' },
];

const PALETTES = {
  tower: ['#5d6b82', '#6b7a94', '#4a5a75', '#7d8aa3', '#54627e'],
  house: ['#c98f6b', '#b98a5e', '#a87f6d', '#d9a06f', '#8f7d6b'],
  shop: ['#7a6a8f', '#8f7a6a', '#6a8f7d', '#96705a', '#5e7a96'],
  yard: ['#6b6f75', '#75706b', '#5f6a63', '#7a7568'],
};

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[0];
}

export function isOnRoad(x, y) {
  for (const rx of ROAD_XS) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  for (const ry of ROAD_YS) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  return false;
}

export function nearestRoadX(x) {
  let best = ROAD_XS[0];
  for (const rx of ROAD_XS) if (Math.abs(rx - x) < Math.abs(best - x)) best = rx;
  return best;
}

export function nearestRoadY(y) {
  let best = ROAD_YS[0];
  for (const ry of ROAD_YS) if (Math.abs(ry - y) < Math.abs(best - y)) best = ry;
  return best;
}

// A point is beach sand when it is in the southern strip, below the last road.
export function isBeach(x, y) {
  return y >= 2320 && y <= WORLD_H;
}

export function isWater(x, y) {
  return y > WORLD_H - 90;
}

// Snap a point onto the nearest road centreline (used for traffic spawning).
export function snapToRoad(x, y) {
  const dx = Math.abs(x - nearestRoadX(x));
  const dy = Math.abs(y - nearestRoadY(y));
  if (dx <= dy) return { x: nearestRoadX(x), y: clamp(y, 60, WORLD_H - 60) };
  return { x: clamp(x, 60, WORLD_W - 60), y: nearestRoadY(y) };
}

export function buildCity(seed = 7) {
  const rng = makeRng(seed);
  const buildings = [];
  const parks = [];
  const palms = [];

  // One building (or a park) per block between roads.
  for (let bx = 0; bx < ROAD_XS.length - 1; bx++) {
    for (let by = 0; by < ROAD_YS.length - 1; by++) {
      const x0 = ROAD_XS[bx] + ROAD_W / 2 + 14;
      const y0 = ROAD_YS[by] + ROAD_W / 2 + 14;
      const x1 = ROAD_XS[bx + 1] - ROAD_W / 2 - 14;
      const y1 = ROAD_YS[by + 1] - ROAD_W / 2 - 14;
      if (y0 > 2260) continue; // the boardwalk strip stays open
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const downtown = cx < 1600 && cy < 1200;
      const roll = rng();
      if (roll < 0.14) {
        // A park with palm trees and a pond.
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, pond: rng() < 0.5 });
        for (let p = 0; p < 7; p++) {
          palms.push({ x: range(rng, x0 + 20, x1 - 20), y: range(rng, y0 + 20, y1 - 20) });
        }
        continue;
      }
      const kind = downtown ? (rng() < 0.55 ? 'tower' : 'shop') : (rng() < 0.5 ? 'house' : 'shop');
      if (kind === 'tower') {
        buildings.push({
          x: x0 + 30, y: y0 + 30, w: x1 - x0 - 60, h: y1 - y0 - 60,
          color: pick(rng, PALETTES.tower), tall: true, kind,
          roof: pick(rng, ['#3d4a61', '#46536b', '#39445a']),
        });
      } else if (kind === 'house') {
        // A row of two or three small houses per block.
        const n = randInt(rng, 2, 3);
        for (let i = 0; i < n; i++) {
          const hw = (x1 - x0 - (n - 1) * 24) / n;
          buildings.push({
            x: x0 + i * (hw + 24), y: y0 + 40, w: hw, h: y1 - y0 - 90,
            color: pick(rng, PALETTES.house), tall: false, kind,
            roof: pick(rng, ['#8a4a3a', '#6b4a3a', '#7a5a4a']),
          });
        }
      } else {
        buildings.push({
          x: x0 + 16, y: y0 + 16, w: x1 - x0 - 32, h: y1 - y0 - 32,
          color: pick(rng, PALETTES.shop), tall: false, kind,
          roof: pick(rng, ['#4a4a55', '#5a4a4a', '#44555a']),
        });
      }
    }
  }

  // Marina boats moored along the east edge.
  const boats = [];
  for (let i = 0; i < 9; i++) {
    boats.push({ x: 3300 + (i % 3) * 70, y: 260 + i * 110, angle: range(rng, -0.3, 0.3), len: range(rng, 46, 78) });
  }

  return {
    buildings, parks, palms, boats,
    hospital: { x: 600, y: 1000, w: 240, h: 160, name: 'Solmar General Hospital' },
    garage: { x: 1400, y: 600, w: 220, h: 150, name: "Milo's Garage" },
    // Mission landmarks, spread across the map.
    landmarks: {
      garage: { x: 1400, y: 600, label: "Milo's Garage" },
      marina: { x: 3000, y: 600, label: 'Marina Pier' },
      market: { x: 600, y: 1400, label: 'Harbor Market' },
      beach: { x: 3000, y: 2100, label: 'Solmar Beach' },
      hotel: { x: 1000, y: 1000, label: 'Palms Hotel' },
      bank: { x: 1800, y: 1000, label: 'Bay Credit Bank' },
      hideout: { x: 2600, y: 1800, label: 'The Hideout' },
    },
  };
}
