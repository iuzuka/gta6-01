// Solmar Bay — the main loop: boot, input, camera, the world render, and
// the wiring between every system (player, traffic, police, missions,
// combat, audio, save). Top-down 2D on one canvas, no libraries.

import { clamp, dist, lerp, makeRng, money } from './util.js';
import { buildCity, districtAt, isBeach, isOnRoad, isWater, ROAD_W, ROAD_XS, ROAD_YS, WORLD_W, WORLD_H } from './city.js';
import { makePlayer, updatePlayerOnFoot, hurtPlayer, healPlayer, nearestEnterableCar, enterCar, exitCar, drawPlayer } from './player.js';
import { spawnTraffic, spawnParked, driveCar, updateTraffic, collideCars, drawCar } from './vehicles.js';
import { spawnPedestrians, updatePedestrians, drawPedestrian } from './pedestrians.js';
import { makePolice, addCrime, wantedStars, updatePolice, escapeRadius, drawOfficer } from './police.js';
import { makeBullets, fireBullet, updateBullets, drawBullets, meleeHit, makeEnemy, updateEnemies, drawEnemy } from './combat.js';
import { makeMissionState, startMission, updateMission, missionWaypoint } from './missions.js';
import { makeParticles, spawnDust, spawnSparks, spawnSmoke, spawnMuzzle, addSkid, updateParticles, drawParticles } from './particles.js';
import { drawHud, drawTitle, drawPause, drawMissionLog, drawGameOver } from './hud.js';
import { sfx, audioInit, sirenStart, sirenStop, engineStart, engineSet, engineStop, musicStart } from './audio.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { shotFromUrl, applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

let W = 1280;
let H = 800;

function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W;
  canvas.height = H;
}
window.addEventListener('resize', resize);
resize();

// ---- Game state ----
const rng = makeRng(20261117);
const city = buildCity(7);

const G = {
  screen: 'title', // title | play | pause | log | over
  player: makePlayer(1400, 660),
  city,
  cityRoadXs: ROAD_XS,
  cityRoadYs: ROAD_YS,
  traffic: [],
  parked: [],
  allCars: [],
  peds: [],
  police: makePolice(),
  missions: makeMissionState(),
  enemies: [],
  bullets: makeBullets(),
  particles: makeParticles(),
  camera: { x: 1400, y: 660 },
  clock: 9.0,
  shake: 0,
  waypoint: null,
  escapeRadius: 260,
  nearCar: null,
  tailCar: null,
  tailStop: null,
  mouse: { x: W / 2, y: H / 2, down: false },
  keys: {},
  time: 0,
  shotMode: null,
  hospitalRespawns: 0,
};

G.traffic = spawnTraffic(14, rng, { x: 1400, y: 660 });
G.parked = spawnParked(10, rng, city);
G.allCars = [...G.traffic, ...G.parked];
G.peds = spawnPedestrians(26, rng);

// ---- Mission wiring: the missions module calls back into the game here. ----
G.missionApi = {
  playerX: () => G.player.x,
  playerY: () => G.player.y,
  toast: (msg) => { G.missions.message = msg; G.missions.messageTimer = 5; },
  sfxMission: () => sfx.mission(),
  sfxFail: () => sfx.fail(),
  addCash: (n) => { G.player.cash += n; G.player.totalEarned += n; saveGame(snapshot()); },
  onMissionComplete: () => { healPlayer(G.player, 40); },
  raiseWanted: (stars) => { G.police.heat = Math.max(G.police.heat, stars * 100); },
  wantedStars: () => G.police.stars,
  enemiesLeft: () => G.enemies.filter((e) => e.health > 0).length,
  spawnTailCar: () => {
    const car = { x: 600, y: 600, angle: 0, speed: 150, color: '#f1c40f', name: 'Comet', parked: false, traffic: false, police: false, health: 100, smoking: false, cruise: 150, route: null, routeIndex: 0, id: 777, tail: true };
    car.route = [
      { x: 1000, y: 600 }, { x: 1000, y: 1000 }, { x: 1800, y: 1000 },
      { x: 1800, y: 1400 }, { x: 1000, y: 1400 }, { x: 1000, y: 1000 },
    ];
    G.tailCar = car;
    G.tailStop = { x: 1000, y: 1000 };
    G.allCars.push(car);
    return car;
  },
  tailArrived: () => {
    if (!G.tailCar) return false;
    return dist(G.tailCar.x, G.tailCar.y, 1000, 1000) < 60;
  },
  spawnBankGuards: () => {
    const bank = city.landmarks.bank;
    G.enemies.push(makeEnemy(bank.x - 40, bank.y - 30, { name: 'Guard' }));
    G.enemies.push(makeEnemy(bank.x + 40, bank.y - 30, { name: 'Guard' }));
    G.enemies.push(makeEnemy(bank.x - 40, bank.y + 30, { name: 'Guard', health: 90 }));
    G.enemies.push(makeEnemy(bank.x + 40, bank.y + 30, { name: 'Guard' }));
  },
  spawnCourierCrew: () => {
    const c = G.tailCar || { x: 1000, y: 1000 };
    G.enemies.push(makeEnemy(c.x - 30, c.y - 20, { name: 'Crew' }));
    G.enemies.push(makeEnemy(c.x + 30, c.y - 20, { name: 'Crew' }));
    G.enemies.push(makeEnemy(c.x, c.y + 30, { name: 'Crew', health: 90 }));
  },
};

function snapshot() {
  return {
    cash: G.player.cash,
    health: G.player.health,
    ammo: G.player.ammo,
    hasPistol: G.player.hasPistol,
    missionIndex: G.missions.index,
    missionsDone: G.missions.done,
    x: G.player.x,
    y: G.player.y,
    clock: G.clock,
    totalEarned: G.player.totalEarned,
    carsStolen: G.player.carsStolen,
  };
}

function applyLoadedSave(s) {
  G.player.cash = s.cash;
  G.player.health = s.health;
  G.player.ammo = s.ammo;
  G.player.hasPistol = s.hasPistol;
  G.player.x = s.playerX;
  G.player.y = s.playerY;
  G.player.totalEarned = s.totalEarned;
  G.player.carsStolen = s.carsStolen;
  G.missions.index = s.missionIndex;
  G.missions.done = s.missionsDone.slice();
  G.clock = s.clock;
  G.camera.x = s.playerX;
  G.camera.y = s.playerY;
}

// ---- Input ----
const keyMap = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
};

window.addEventListener('keydown', (e) => {
  audioInit();
  const k = keyMap[e.code];
  if (k) G.keys[k] = true;
  if (e.code === 'Enter') {
    if (G.screen === 'title') startNewGame(false);
    else if (G.screen === 'over') respawnAtHospital();
  }
  if (e.code === 'KeyC' && G.screen === 'title' && hasSave()) startNewGame(true);
  if (e.code === 'Escape') {
    if (G.screen === 'play') G.screen = 'pause';
    else if (G.screen === 'pause') G.screen = 'play';
    else if (G.screen === 'log') G.screen = 'pause';
  }
  if (e.code === 'KeyM') {
    if (G.screen === 'play') {
      if (!G.missions.active && G.missions.index < 5) {
        startMission(G.missions, city, G.missionApi);
      } else {
        G.screen = 'log';
      }
    } else if (G.screen === 'log') G.screen = 'play';
    else if (G.screen === 'pause') G.screen = 'log';
  }
  if (e.code === 'KeyE' && G.screen === 'play') tryEnterExitCar();
  if (e.code === 'Digit1' && G.screen === 'play') G.player.weapon = 'fist';
  if (e.code === 'Digit2' && G.screen === 'play' && G.player.hasPistol) G.player.weapon = 'pistol';
  if (e.code === 'KeyS' && G.screen === 'pause') {
    if (saveGame(snapshot())) { G.missions.message = 'Game saved.'; G.missions.messageTimer = 3; }
  }
  if (e.code === 'KeyQ' && G.screen === 'pause') { G.screen = 'title'; engineStop(); sirenStop(); }
  if (e.code === 'KeyF' && G.screen === 'play') punch();
});

window.addEventListener('keyup', (e) => {
  const k = keyMap[e.code];
  if (k) G.keys[k] = false;
});

canvas.addEventListener('mousemove', (e) => {
  G.mouse.x = e.clientX;
  G.mouse.y = e.clientY;
});
canvas.addEventListener('mousedown', (e) => {
  audioInit();
  if (e.button !== 0) return;
  if (G.screen === 'title') { startNewGame(false); return; }
  if (G.screen === 'play') shoot();
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function startNewGame(continueSave) {
  audioInit();
  engineStart();
  musicStart();
  if (continueSave) {
    const s = loadGame();
    if (s) applyLoadedSave(s);
  } else {
    const fresh = makePlayer(1400, 660);
    fresh.cash = 250;
    G.player = fresh;
    G.missions = makeMissionState();
    G.police = makePolice();
    G.enemies = [];
    G.clock = 9.0;
    G.camera.x = 1400;
    G.camera.y = 660;
  }
  G.screen = 'play';
  G.missions.message = continueSave ? 'Welcome back to Solmar Bay.' : 'Milo Reyes is back. Press M to start the first job.';
  G.missions.messageTimer = 5;
}

function respawnAtHospital() {
  const h = city.hospital;
  G.player.health = 100;
  G.player.dead = false;
  G.player.cash = Math.max(0, G.player.cash - 200);
  G.player.inCar = null;
  G.player.x = h.x + h.w / 2;
  G.player.y = h.y + h.h + 30;
  G.police = makePolice();
  G.enemies = [];
  G.hospitalRespawns++;
  G.camera.x = G.player.x;
  G.camera.y = G.player.y;
  G.screen = 'play';
  G.missions.message = 'Solmar General patched you up. -$200.';
  G.missions.messageTimer = 4;
}

function tryEnterExitCar() {
  const p = G.player;
  if (p.inCar) {
    exitCar(p);
    sfx.door();
    return;
  }
  const car = nearestEnterableCar(p, G.allCars);
  if (!car) return;
  const res = enterCar(p, car);
  sfx.door();
  if (res && res.stolen) {
    p.carsStolen++;
    // Stealing in view of the law raises the wanted level.
    const seen = G.police.cars.some((c) => dist(c.x, c.y, p.x, p.y) < 550)
      || G.police.officers.some((o) => dist(o.x, o.y, p.x, p.y) < 400)
      || G.police.stars > 0;
    if (seen) {
      G.police.heat = addCrime(G.police.heat, 'steal');
      G.missions.message = 'Grand theft auto — the cops saw that!';
      G.missions.messageTimer = 3;
    } else {
      G.missions.message = 'Nice ride. Keep it quiet.';
      G.missions.messageTimer = 2;
    }
  }
}

function aimAngle() {
  const sx = G.player.x - G.camera.x + W / 2;
  const sy = G.player.y - G.camera.y + H / 2;
  return Math.atan2(G.mouse.y - sy, G.mouse.x - sx);
}

function punch() {
  const p = G.player;
  if (p.inCar || p.punchTimer > 0) return;
  p.punchTimer = 0.35;
  sfx.punch();
  const targets = [...G.enemies, ...G.police.officers, ...G.peds];
  const angle = aimAngle();
  if (meleeHit(p, angle, targets)) {
    G.shake = Math.max(G.shake, 4);
    spawnSparks(G.particles, p.x + Math.cos(angle) * 24, p.y + Math.sin(angle) * 24, 5);
    G.police.heat = addCrime(G.police.heat, 'assault');
  }
}

function shoot() {
  const p = G.player;
  if (p.inCar || p.dead) return;
  if (p.weapon === 'fist') { punch(); return; }
  if (p.shootCooldown > 0) return;
  if (p.ammo <= 0) {
    G.missions.message = 'Out of ammo — find a gun shop (coming soon) or use fists [1].';
    G.missions.messageTimer = 2.5;
    return;
  }
  p.ammo--;
  p.shootCooldown = 0.22;
  const angle = aimAngle();
  fireBullet(G.bullets, p.x, p.y, angle, { fromPlayer: true });
  spawnMuzzle(G.particles, p.x, p.y, angle);
  sfx.shot();
  G.shake = Math.max(G.shake, 2.5);
  G.police.heat = addCrime(G.police.heat, 'shoot');
  for (const ped of G.peds) {
    if (dist(ped.x, ped.y, p.x, p.y) < 320) ped.panic = 2.5;
  }
}

// ---- Collision helpers ----
function resolveBuildingCollision(pos, r) {
  // Inline circle-vs-rect resolution (same math as util.pushCircleOutOfRect,
  // kept local so the hot path stays allocation-free).
  for (const b of city.buildings) {
    const nx = clamp(pos.x, b.x, b.x + b.w);
    const ny = clamp(pos.y, b.y, b.y + b.h);
    const dx = pos.x - nx;
    const dy = pos.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      pos.x = nx + (dx / d) * r;
      pos.y = ny + (dy / d) * r;
    } else {
      const left = pos.x - b.x;
      const right = b.x + b.w - pos.x;
      const top = pos.y - b.y;
      const bottom = b.y + b.h - pos.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) pos.x = b.x - r;
      else if (m === right) pos.x = b.x + b.w + r;
      else if (m === top) pos.y = b.y - r;
      else pos.y = b.y + b.h + r;
    }
  }
}

// ---- Update ----
let lastTime = performance.now();

function update(dt) {
  G.time += dt;
  G.clock = (G.clock + dt / 150) % 24; // a full day takes ~2.5 real minutes
  if (G.missions.messageTimer > 0) G.missions.messageTimer -= dt;

  const p = G.player;
  if (p.dead) return;

  // --- Player ---
  if (p.inCar) {
    const car = p.inCar;
    const prevX = car.x;
    const prevY = car.y;
    const prevSpeed = car.speed;
    const skidding = driveCar(car, G.keys, dt);
    resolveBuildingCollision(car, 22);
    // A wall hit is when the car barely moved although it was going fast.
    const moved = Math.hypot(car.x - prevX, car.y - prevY);
    const expected = Math.abs(prevSpeed) * dt;
    const hitWall = expected > 20 && moved < expected * 0.5;
    if (hitWall) {
      car.speed *= 0.4;
      car.health -= 6;
      spawnSparks(G.particles, car.x, car.y, 8);
      sfx.crash();
      G.shake = Math.max(G.shake, 6);
      if (car.health < 35) car.smoking = true;
    }
    if (skidding) {
      addSkid(G.particles, car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20, car.x, car.y);
      spawnDust(G.particles, car.x, car.y, 1);
    }
    if (Math.abs(car.speed) > 40) spawnDust(G.particles, car.x - Math.cos(car.angle) * 22, car.y - Math.sin(car.angle) * 22, 1);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    // Speeding past a police car is a crime.
    if (Math.abs(car.speed) > 380) {
      for (const cop of G.police.cars) {
        if (dist(cop.x, cop.y, car.x, car.y) < 260) {
          G.police.heat = addCrime(G.police.heat, 'speedPastCop');
          break;
        }
      }
    }
    // Running over a pedestrian.
    for (let i = G.peds.length - 1; i >= 0; i--) {
      const ped = G.peds[i];
      if (dist(ped.x, ped.y, car.x, car.y) < 26 && Math.abs(car.speed) > 90) {
        G.peds.splice(i, 1);
        G.police.heat = addCrime(G.police.heat, 'hitPed');
        spawnSparks(G.particles, ped.x, ped.y, 10);
        sfx.crash();
        G.shake = Math.max(G.shake, 7);
        G.missions.message = 'You hit a pedestrian! The SBPD is coming.';
        G.missions.messageTimer = 3;
      }
    }
    engineSet(Math.abs(car.speed) / 460, true);
  } else {
    updatePlayerOnFoot(p, G.keys, dt, (pos, r) => resolveBuildingCollision(pos, r));
    engineSet(0, false);
  }

  // --- Tail car (mission 3) drives its route ---
  if (G.tailCar && G.tailCar.route) {
    const tc = G.tailCar;
    const target = tc.route[tc.routeIndex];
    if (target) {
      const want = Math.atan2(target.y - tc.y, target.x - tc.x);
      let d = want - tc.angle;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      tc.angle += clamp(d, -2 * dt, 2 * dt);
      tc.speed = 150;
      tc.x += Math.cos(tc.angle) * tc.speed * dt;
      tc.y += Math.sin(tc.angle) * tc.speed * dt;
      if (dist(tc.x, tc.y, target.x, target.y) < 40) tc.routeIndex++;
    }
  }

  // --- Traffic, pedestrians, police ---
  updateTraffic(G.traffic, dt, rng, p, city.buildings);
  collideCars(G.allCars, p.inCar);
  const danger = G.bullets.length > 0 || G.police.stars > 0
    ? { x: p.x, y: p.y, r: 420 } : null;
  updatePedestrians(G.peds, dt, rng, danger);
  updatePolice(G.police, dt, rng, p, p.inCar, {
    onRam: () => { G.shake = Math.max(G.shake, 8); sfx.crash(); spawnSparks(G.particles, p.x, p.y, 8); },
    onArrest: (dt2) => {
      p.arrestTimer += dt2;
      if (p.arrestTimer > 1.4) {
        G.missions.message = 'BUSTED — the SBPD hauled you in.';
        G.missions.messageTimer = 3;
        p.health = 0;
        p.dead = true;
        G.screen = 'over';
        G.overReason = 'Busted by the Solmar Bay Police Department.';
        sfx.fail();
      }
    },
    onCopShot: (x, y, angle) => {
      fireBullet(G.bullets, x, y, angle, { fromPlayer: false, damage: 9 });
      sfx.shot();
    },
  });
  G.escapeRadius = escapeRadius(G.police.stars);
  // Police cars slide around buildings instead of driving through roofs.
  for (const cop of G.police.cars) resolveBuildingCollision(cop, 22);
  if (G.police.stars > 0) sirenStart(); else sirenStop();
  if (!p.inCar) p.arrestTimer = Math.max(0, p.arrestTimer - dt * 2);

  // --- Combat: bullets move, then hit checks run per bullet kind. ---
  G.bullets = updateBullets(G.bullets, dt, [], null);
  for (const b of G.bullets) {
    if (b.life <= 0) continue;
    if (b.fromPlayer) {
      for (const t of [...G.enemies, ...G.police.officers]) {
        if (t.health > 0 && dist(b.x, b.y, t.x, t.y) < (t.radius || 15)) {
          t.health -= b.damage;
          b.life = 0;
          spawnSparks(G.particles, b.x, b.y, 4);
          if (t.health <= 0 && G.police.officers.includes(t)) {
            G.police.heat = addCrime(G.police.heat, 'killCop');
          }
          break;
        }
      }
    } else if (dist(b.x, b.y, p.x, p.y) < 15) {
      hurtPlayer(p, b.damage);
      b.life = 0;
      spawnSparks(G.particles, b.x, b.y, 4);
    }
  }
  G.bullets = G.bullets.filter((b) => b.life > 0);
  G.enemies = updateEnemies(G.enemies, dt, p, (x, y, angle) => {
    fireBullet(G.bullets, x, y, angle, { fromPlayer: false, damage: 8 });
    spawnMuzzle(G.particles, x, y, angle);
    sfx.shot();
  });
  // Killed enemies sometimes drop ammo.
  for (const e of [...G.enemies]) {
    if (e.health <= 0 && !e.looted) {
      e.looted = true;
      p.ammo += 6;
    }
  }
  G.enemies = G.enemies.filter((e) => e.health > 0);

  // --- Missions ---
  updateMission(G.missions, city, G.missionApi, dt);
  G.waypoint = missionWaypoint(G.missions, city);
  if (!G.waypoint && !G.missions.active && G.missions.index < 5) {
    const def = { 0: 'garage', 1: 'market', 2: 'garage', 3: 'bank', 4: 'marina' }[G.missions.index];
    const lm = city.landmarks[def];
    G.waypoint = { x: lm.x, y: lm.y, label: lm.label };
  }

  // --- Car smoke, particles, camera ---
  for (const car of G.allCars) {
    if (car.smoking && Math.random() < 0.3) spawnSmoke(G.particles, car.x, car.y, 1);
    if (car.health <= 0 && !car.wrecked) {
      car.wrecked = true;
      spawnSparks(G.particles, car.x, car.y, 20);
      sfx.crash();
    }
  }
  updateParticles(G.particles, dt);

  const tx = p.inCar ? p.inCar.x : p.x;
  const ty = p.inCar ? p.inCar.y : p.y;
  G.camera.x = lerp(G.camera.x, tx, Math.min(1, 5 * dt));
  G.camera.y = lerp(G.camera.y, ty, Math.min(1, 5 * dt));
  G.shake = Math.max(0, G.shake - dt * 22);

  // Near-car prompt.
  G.nearCar = p.inCar ? null : nearestEnterableCar(p, G.allCars, 70);

  // Death by damage.
  if (p.health <= 0 && !p.dead) {
    p.dead = true;
    G.screen = 'over';
    G.overReason = 'Milo Reyes was taken out on the streets of Solmar Bay.';
    sfx.fail();
    engineStop();
    sirenStop();
  }

  statusEl.textContent = 'Solmar Bay — cash ' + money(p.cash) + ', wanted ' + G.police.stars + ' stars, '
    + (G.missions.active ? 'mission ' + G.missions.active.def.name : 'no active mission');
}

// ---- Render ----
function daylight() {
  const c = G.clock;
  if (c >= 6 && c < 17) return { r: 255, g: 255, b: 255, a: 0 };
  if (c >= 17 && c < 19.5) { // sunset
    const t = (c - 17) / 2.5;
    return { r: 255, g: 140, b: 60, a: 0.16 + t * 0.12 };
  }
  if (c >= 19.5 || c < 5) return { r: 10, g: 20, b: 60, a: 0.32 }; // night
  const t = (c - 5) / 1; // dawn
  return { r: 255, g: 180, b: 120, a: 0.14 * (1 - t) };
}

function render() {
  if (G.screen === 'title') {
    drawTitle(ctx, W, H, hasSave(), G.missions.index);
    return;
  }
  ctx.clearRect(0, 0, W, H);
  const shakeX = (Math.random() - 0.5) * G.shake;
  const shakeY = (Math.random() - 0.5) * G.shake;
  const camX = G.camera.x - W / 2 + shakeX;
  const camY = G.camera.y - H / 2 + shakeY;

  ctx.save();
  ctx.translate(-camX, -camY);

  // Ground.
  ctx.fillStyle = '#4a6b46';
  ctx.fillRect(camX - 20, camY - 20, W + 40, H + 40);
  // Beach sand and sea at the south edge.
  ctx.fillStyle = '#d9bd7a';
  ctx.fillRect(0, 2320, WORLD_W, 190);
  ctx.fillStyle = '#2a7fa8';
  ctx.fillRect(0, 2510, WORLD_W, 90);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let i = 0; i < 12; i++) {
    ctx.fillRect(((i * 317 + G.time * 12) % WORLD_W), 2514 + (i % 3) * 26, 60, 3);
  }

  // Parks.
  for (const park of city.parks) {
    ctx.fillStyle = '#3f7a3a';
    ctx.fillRect(park.x, park.y, park.w, park.h);
    if (park.pond) {
      ctx.fillStyle = '#4a90b8';
      ctx.beginPath();
      ctx.ellipse(park.x + park.w / 2, park.y + park.h / 2, 40, 26, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Palm trees.
  for (const palm of city.palms) {
    ctx.strokeStyle = '#6b4a2a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(palm.x, palm.y);
    ctx.lineTo(palm.x + 3, palm.y - 12);
    ctx.stroke();
    ctx.fillStyle = '#2e8b3a';
    ctx.beginPath();
    ctx.arc(palm.x + 3, palm.y - 14, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Roads: asphalt, sidewalks, centre dashes.
  ctx.fillStyle = '#3c3f45';
  for (const rx of ROAD_XS) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (const ry of ROAD_YS) ctx.fillRect(0, ry - ROAD_W / 2, WORLD_W, ROAD_W);
  ctx.strokeStyle = '#5a5e66';
  ctx.lineWidth = 2;
  for (const rx of ROAD_XS) {
    ctx.beginPath(); ctx.moveTo(rx - ROAD_W / 2, 0); ctx.lineTo(rx - ROAD_W / 2, WORLD_H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rx + ROAD_W / 2, 0); ctx.lineTo(rx + ROAD_W / 2, WORLD_H); ctx.stroke();
  }
  for (const ry of ROAD_YS) {
    ctx.beginPath(); ctx.moveTo(0, ry - ROAD_W / 2); ctx.lineTo(WORLD_W, ry - ROAD_W / 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, ry + ROAD_W / 2); ctx.lineTo(WORLD_W, ry + ROAD_W / 2); ctx.stroke();
  }
  ctx.fillStyle = '#e8d44d';
  for (const rx of ROAD_XS) {
    for (let y = 40; y < WORLD_H; y += 64) ctx.fillRect(rx - 2, y, 4, 28);
  }
  for (const ry of ROAD_YS) {
    for (let x = 40; x < WORLD_W; x += 64) ctx.fillRect(x, ry - 2, 28, 4);
  }

  // Buildings with a fake 3D wall and windows.
  for (const b of city.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    if (b.tall) {
      ctx.fillStyle = 'rgba(255,255,190,0.5)';
      for (let wx = b.x + 14; wx < b.x + b.w - 12; wx += 26) {
        for (let wy = b.y + 14; wy < b.y + b.h - 12; wy += 26) {
          ctx.fillRect(wx, wy, 10, 12);
        }
      }
    } else {
      ctx.fillStyle = '#3a2e22';
      ctx.fillRect(b.x + b.w / 2 - 8, b.y + b.h - 16, 16, 16);
    }
  }

  // Hospital and garage labels, below the buildings so they never collide
  // with a waypoint marker drawn above them.
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.fillText('🏥 ' + city.hospital.name, city.hospital.x + city.hospital.w / 2, city.hospital.y + city.hospital.h + 18);
  ctx.fillText("🔧 " + city.garage.name, city.garage.x + city.garage.w / 2, city.garage.y + city.garage.h + 18);
  ctx.textAlign = 'left';

  // Marina boats in the southern sea.
  for (const boat of city.boats) {
    ctx.save();
    ctx.translate(boat.x, 2545 + (boat.y % 30));
    ctx.rotate(boat.angle);
    ctx.fillStyle = '#e8e8e8';
    ctx.beginPath();
    ctx.ellipse(0, 0, boat.len / 2, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(-6, -16, 12, 14);
    ctx.restore();
  }

  drawParticles(ctx, G.particles);

  // Waypoint beacon.
  if (G.waypoint) {
    const wp = G.waypoint;
    const pulse = 1 + Math.sin(G.time * 5) * 0.15;
    ctx.save();
    ctx.translate(wp.x, wp.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(18, 0);
    ctx.lineTo(0, 26);
    ctx.lineTo(-18, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    // Skip the label when the waypoint sits under the top HUD panels.
    const wpScreenY = wp.y - camY;
    if (wpScreenY > 100) ctx.fillText(wp.label, wp.x, wp.y - 34);
    ctx.textAlign = 'left';
  }

  // Cars, pedestrians, police, player, enemies, bullets.
  for (const car of G.allCars) {
    if (car.health > 0) drawCar(ctx, car);
  }
  if (G.tailCar && G.tailCar.health > 0) drawCar(ctx, G.tailCar);
  for (const ped of G.peds) drawPedestrian(ctx, ped);
  for (const off of G.police.officers) drawOfficer(ctx, off);
  for (const e of G.enemies) drawEnemy(ctx, e);
  if (G.player.inCar) {
    // Player is inside the car; draw the car already handled above.
  } else {
    drawPlayer(ctx, G.player, G.mouse ? aimAngle() : undefined);
  }
  drawBullets(ctx, G.bullets);

  // Aim reticle.
  if (G.screen === 'play' && !G.player.inCar) {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(G.mouse.x + camX, G.mouse.y + camY, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(G.mouse.x + camX - 13, G.mouse.y + camY);
    ctx.lineTo(G.mouse.x + camX - 5, G.mouse.y + camY);
    ctx.moveTo(G.mouse.x + camX + 5, G.mouse.y + camY);
    ctx.lineTo(G.mouse.x + camX + 13, G.mouse.y + camY);
    ctx.stroke();
  }

  ctx.restore();

  // Day / sunset / night tint.
  const dl = daylight();
  if (dl.a > 0) {
    ctx.fillStyle = `rgba(${dl.r},${dl.g},${dl.b},${dl.a})`;
    ctx.fillRect(0, 0, W, H);
  }
  // Night headlights glow.
  if (G.clock >= 19.5 || G.clock < 5) {
    ctx.fillStyle = 'rgba(255,240,180,0.06)';
    ctx.fillRect(0, 0, W, H);
  }

  // Off-screen waypoint arrow.
  if (G.waypoint && G.screen === 'play') {
    const sx = G.waypoint.x - camX;
    const sy = G.waypoint.y - camY;
    if (sx < 40 || sx > W - 40 || sy < 40 || sy > H - 40) {
      const cx = clamp(sx, 60, W - 60);
      const cy = clamp(sy, 60, H - 60);
      const a = Math.atan2(sy - H / 2, sx - W / 2);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-8, -9);
      ctx.lineTo(-8, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffd34d';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(Math.round(dist(G.player.x, G.player.y, G.waypoint.x, G.waypoint.y)) + 'm', cx, cy + 24);
      ctx.textAlign = 'left';
    }
  }

  drawHud(ctx, G, W, H);
  if (G.screen === 'pause') drawPause(ctx, W, H, G);
  if (G.screen === 'log') drawMissionLog(ctx, W, H, G);
  if (G.screen === 'over') drawGameOver(ctx, W, H, G.overReason || 'Milo is down.');
}

// ---- Main loop ----
function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  if (G.screen === 'play') update(dt);
  else if (G.screen === 'title') { G.time += dt; }
  render();
  requestAnimationFrame(frame);
}

// Staged shots: apply the requested state, then let the world run a couple
// of seconds so traffic and pedestrians are visibly moving.
G.shotMode = shotFromUrl();
if (G.shotMode) {
  applyShot(G, G.shotMode);
  if (G.shotMode !== 'start') {
    engineStart();
    musicStart();
  }
  setTimeout(() => { window.__shotReady = true; }, 2500);
} else {
  setTimeout(() => { window.__shotReady = true; }, 1200);
}

window.__solmar = G;
requestAnimationFrame(frame);
