// Solmar Bay — pedestrians: ordinary people walking the sidewalks. They
// stroll between intersections, wait at corners, and run away from gunfire,
// crashes and police chases. Hitting one is a crime the police notice.

import { clamp, dist, makeRng, pick, range, randInt } from './util.js';
import { ROAD_XS, ROAD_YS, ROAD_W, WORLD_W, WORLD_H } from './city.js';

const SHIRTS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#ecf0f1', '#1abc9c'];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

export function spawnPedestrians(count, rng) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const onVertical = rng() < 0.5;
    const rx = pick(rng, ROAD_XS);
    const ry = pick(rng, ROAD_YS);
    const side = rng() < 0.5 ? -1 : 1;
    peds.push({
      x: onVertical ? rx + side * (ROAD_W / 2 + 16) : range(rng, 120, WORLD_W - 120),
      y: onVertical ? range(rng, 120, WORLD_H - 120) : ry + side * (ROAD_W / 2 + 16),
      tx: 0, ty: 0, speed: range(rng, 34, 62),
      shirt: pick(rng, SHIRTS), skin: pick(rng, SKINS),
      panic: 0, wait: 0, walkPhase: rng() * Math.PI * 2,
      id: i,
    });
    pickNewTarget(peds[i], rng);
  }
  return peds;
}

function pickNewTarget(ped, rng) {
  const onVertical = rng() < 0.5;
  const rx = pick(rng, ROAD_XS);
  const ry = pick(rng, ROAD_YS);
  const side = rng() < 0.5 ? -1 : 1;
  if (onVertical) {
    ped.tx = rx + side * (ROAD_W / 2 + 16);
    ped.ty = range(rng, 120, WORLD_H - 120);
  } else {
    ped.tx = range(rng, 120, WORLD_W - 120);
    ped.ty = ry + side * (ROAD_W / 2 + 16);
  }
}

export function updatePedestrians(peds, dt, rng, danger) {
  for (const ped of peds) {
    ped.walkPhase += dt * 8;
    if (ped.panic > 0) ped.panic -= dt;
    // A nearby danger (gunfire, a speeding car, a chase) sends them running.
    if (danger && dist(ped.x, ped.y, danger.x, danger.y) < danger.r) {
      ped.panic = 2.5;
    }
    const speed = ped.panic > 0 ? ped.speed * 3.2 : ped.speed;
    const dx = ped.tx - ped.x;
    const dy = ped.ty - ped.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 12) {
      if (ped.wait > 0) { ped.wait -= dt; continue; }
      ped.wait = range(rng, 0, 2.5);
      pickNewTarget(ped, rng);
      continue;
    }
    let mx = (dx / d) * speed * dt;
    let my = (dy / d) * speed * dt;
    if (ped.panic > 0) {
      // Flee directly away from the danger point.
      const fx = ped.x - danger.x;
      const fy = ped.y - danger.y;
      const fd = Math.sqrt(fx * fx + fy * fy) || 1;
      mx = (fx / fd) * speed * dt;
      my = (fy / fd) * speed * dt;
    }
    ped.x = clamp(ped.x + mx, 30, WORLD_W - 30);
    ped.y = clamp(ped.y + my, 30, WORLD_H - 30);
  }
}

export function drawPedestrian(ctx, ped) {
  const bob = Math.sin(ped.walkPhase) * 2;
  ctx.save();
  ctx.translate(ped.x, ped.y + bob * 0.3);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 6, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // Legs.
  ctx.strokeStyle = '#2c3e50';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(-3 + bob, 8);
  ctx.moveTo(0, 2);
  ctx.lineTo(3 - bob, 8);
  ctx.stroke();
  // Body.
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.roundRect(-5, -6, 10, 10, 4);
  ctx.fill();
  // Head.
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(0, -10, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
