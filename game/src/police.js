// Solmar Bay — the wanted system and the Solmar Bay Police Department.
// Crimes raise heat, hiding and time cool it down, and the SBPD answers with
// patrol cars and foot officers who chase, ram and try to arrest Milo.
// The level math is pure so tests can check it without a running game.

import { clamp, dist, makeRng, pick, turnToward } from './util.js';
import { makeCar } from './vehicles.js';
import { WORLD_W, WORLD_H } from './city.js';

export const MAX_WANTED = 5;

// Heat gained per crime, in "wanted points". 100 points = one star.
export const CRIME_HEAT = {
  steal: 55,
  assault: 45,
  shoot: 70,
  killCop: 120,
  speedPastCop: 25,
  hitPed: 90,
  wreck: 15,
};

export function wantedStars(heat) {
  if (heat <= 0) return 0;
  return clamp(Math.ceil(heat / 100), 1, MAX_WANTED);
}

// Add heat for a crime; returns the new heat value.
export function addCrime(heat, crime) {
  return clamp(heat + (CRIME_HEAT[crime] ?? 20), 0, MAX_WANTED * 100);
}

// Heat decay: hiding (no cop can see the player) cools twice as fast.
export function decayHeat(heat, dt, hidden) {
  const rate = hidden ? 9 : 3.5;
  return Math.max(0, heat - rate * dt);
}

// How many police units the current wanted level fields.
export function copsForStars(stars) {
  return [0, 1, 2, 3, 4, 5][stars] ?? 0;
}

// Radius of the search/escape circle the minimap shows, in world units.
export function escapeRadius(stars) {
  return 260 + stars * 90;
}

export function makePolice() {
  return {
    heat: 0,
    stars: 0,
    hiddenTimer: 0, // seconds since any cop last saw the player
    lastSeen: null,
    cars: [],
    officers: [],
    spawnTimer: 0,
  };
}

function spawnCopCar(police, rng, near) {
  const angle = rng() * Math.PI * 2;
  const d = 620 + rng() * 260;
  const car = makeCar(
    clamp(near.x + Math.cos(angle) * d, 80, WORLD_W - 80),
    clamp(near.y + Math.sin(angle) * d, 80, WORLD_H - 80),
    angle,
    { police: true, color: '#1f2a44', name: 'Interceptor', cruise: 330, id: 9000 + police.cars.length },
  );
  car.traffic = false;
  police.cars.push(car);
  return car;
}

function spawnOfficer(police, rng, near) {
  const angle = rng() * Math.PI * 2;
  const d = 260 + rng() * 160;
  police.officers.push({
    x: clamp(near.x + Math.cos(angle) * d, 40, WORLD_W - 40),
    y: clamp(near.y + Math.sin(angle) * d, 40, WORLD_H - 40),
    speed: 150 + police.stars * 12,
    health: 60,
    shootTimer: 1 + rng() * 2,
    phase: rng() * Math.PI * 2,
  });
}

export function updatePolice(police, dt, rng, player, playerCar, events) {
  police.stars = wantedStars(police.heat);
  if (police.stars === 0) {
    // Stand down: cars drive off, officers walk away.
    police.cars = [];
    police.officers = [];
    police.hiddenTimer += dt;
    return;
  }
  // Seeing the player resets the hidden timer; hiding grows it.
  const playerPos = playerCar || player;
  let anySees = false;
  for (const car of police.cars) {
    if (dist(car.x, car.y, playerPos.x, playerPos.y) < 700) anySees = true;
  }
  for (const off of police.officers) {
    if (dist(off.x, off.y, player.x, player.y) < 420) anySees = true;
  }
  if (anySees) {
    police.hiddenTimer = 0;
    police.lastSeen = { x: playerPos.x, y: playerPos.y };
  } else {
    police.hiddenTimer += dt;
  }
  police.heat = decayHeat(police.heat, dt, police.hiddenTimer > 4);
  police.stars = wantedStars(police.heat);

  // Keep the right number of units in the field.
  police.spawnTimer -= dt;
  const wantCars = Math.min(copsForStars(police.stars), police.stars >= 3 ? 3 : 2);
  if (police.cars.length < wantCars && police.spawnTimer <= 0) {
    spawnCopCar(police, rng, playerPos);
    police.spawnTimer = 2.5;
  }
  if (police.stars >= 2 && police.officers.length < police.stars - 1 && police.spawnTimer <= 0) {
    spawnOfficer(police, rng, player);
    police.spawnTimer = 2.5;
  }

  // Police cars chase and ram.
  const targetSpeed = 300 + police.stars * 34;
  for (const car of police.cars) {
    const tx = police.lastSeen ? police.lastSeen.x : playerPos.x;
    const ty = police.lastSeen ? police.lastSeen.y : playerPos.y;
    const want = Math.atan2(ty - car.y, tx - car.x);
    car.angle = turnToward(car.angle, want, 3.2 * dt);
    const d = dist(car.x, car.y, playerPos.x, playerPos.y);
    car.speed += ((d > 60 ? targetSpeed : 120) - car.speed) * Math.min(1, 1.4 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Ram the player's car or knock the player down.
    if (d < 52) {
      if (playerCar) {
        playerCar.health -= 12 * dt * 10;
        playerCar.speed *= 0.96;
        if (events) events.onRam();
      } else if (events) {
        events.onArrest(dt);
      }
    }
  }

  // Foot officers chase on foot and shoot from 3 stars up.
  for (const off of police.officers) {
    const d = dist(off.x, off.y, player.x, player.y);
    const want = Math.atan2(player.y - off.y, player.x - off.x);
    off.phase += dt * 9;
    if (d > 46) {
      off.x += Math.cos(want) * off.speed * dt;
      off.y += Math.sin(want) * off.speed * dt;
    } else if (events) {
      events.onArrest(dt);
    }
    off.shootTimer -= dt;
    if (police.stars >= 3 && d < 380 && d > 90 && off.shootTimer <= 0) {
      off.shootTimer = 1.6 + rng() * 1.2;
      if (events) events.onCopShot(off.x, off.y, want);
    }
  }
  police.officers = police.officers.filter((o) => o.health > 0);
}

export function drawOfficer(ctx, off) {
  const bob = Math.sin(off.phase) * 2;
  ctx.save();
  ctx.translate(off.x, off.y + bob * 0.3);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 7, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1f2a44';
  ctx.beginPath();
  ctx.roundRect(-6, -7, 12, 12, 4);
  ctx.fill();
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath();
  ctx.arc(0, -11, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1f2a44';
  ctx.fillRect(-6, -16, 12, 4);
  ctx.restore();
}
