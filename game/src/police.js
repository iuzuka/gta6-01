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
    heli: null, // the SBPD helicopter: up at 4 stars, gone again after a while
    heliCooldown: 0, // seconds before it can come back after leaving
  };
}

// The helicopter flies at 4 and 5 stars, as long as it is not already up
// and its break after the last sortie has passed.
export function heliShouldSpawn(police) {
  return police.stars >= 4 && !police.heli && police.heliCooldown <= 0;
}

const HELI_SORTIE = 30; // seconds the helicopter stays up
const HELI_BREAK = 25; // seconds before it can return
const HELI_SPEED = 420; // it is faster than any car

function spawnHeli(police, near) {
  police.heli = {
    x: near.x + 260,
    y: near.y - 320,
    angle: 0,
    rotor: 0,
    timeLeft: HELI_SORTIE,
    shootTimer: 2,
  };
}

// One tick of helicopter logic. Pure enough for tests: it takes the
// player's position and an events object with onHeliShot, and returns
// nothing — the helicopter lives on the police object.
export function updateHelicopter(police, dt, playerPos, events) {
  const heli = police.heli;
  if (!heli) {
    police.heliCooldown = Math.max(0, police.heliCooldown - dt);
    return;
  }
  heli.rotor += dt * 28;
  heli.timeLeft -= dt;
  if (heli.timeLeft <= 0) {
    police.heli = null;
    police.heliCooldown = HELI_BREAK;
    return;
  }
  // Circle above the player, a little ahead of where they are going.
  const want = Math.atan2(playerPos.y - heli.y, playerPos.x - heli.x);
  heli.angle = turnToward(heli.angle, want, 2.6 * dt);
  const d = dist(heli.x, heli.y, playerPos.x, playerPos.y);
  const speed = d > 240 ? HELI_SPEED : HELI_SPEED * 0.5;
  heli.x += Math.cos(heli.angle) * speed * dt;
  heli.y += Math.sin(heli.angle) * speed * dt;
  // At 5 stars it shoots down at the player.
  heli.shootTimer -= dt;
  if (police.stars >= 5 && d < 460 && heli.shootTimer <= 0) {
    heli.shootTimer = 2.2;
    if (events && events.onHeliShot) {
      events.onHeliShot(heli.x, heli.y, Math.atan2(playerPos.y - heli.y, playerPos.x - heli.x));
    }
  }
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
    // Stand down: cars drive off, officers walk away, the helicopter leaves.
    police.cars = [];
    police.officers = [];
    if (police.heli) {
      police.heli = null;
      police.heliCooldown = HELI_BREAK;
    } else {
      police.heliCooldown = Math.max(0, police.heliCooldown - dt);
    }
    police.hiddenTimer += dt;
    return;
  }
  // Seeing the player resets the hidden timer; hiding grows it.
  const playerPos = playerCar || player;
  let anySees = false;
  // The helicopter never loses the player while it is up.
  if (police.heli) anySees = true;
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
  if (heliShouldSpawn(police)) spawnHeli(police, playerPos);
  updateHelicopter(police, dt, playerPos, events);
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

export function drawHelicopter(ctx, heli, night) {
  ctx.save();
  ctx.translate(heli.x, heli.y);
  // Searchlight cone at night, sweeping toward the player below.
  if (night) {
    ctx.fillStyle = 'rgba(255,240,170,0.10)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-70, 150);
    ctx.lineTo(70, 150);
    ctx.closePath();
    ctx.fill();
  }
  // Rotor, spinning fast enough to blur.
  ctx.strokeStyle = 'rgba(30,30,40,0.85)';
  ctx.lineWidth = 3;
  const r = heli.rotor % Math.PI;
  ctx.beginPath();
  ctx.moveTo(-34 * Math.cos(r), -34 * Math.sin(r));
  ctx.lineTo(34 * Math.cos(r), 34 * Math.sin(r));
  ctx.stroke();
  // Shadow, body, tail and skids.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(4, 6, 16, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1f2a44';
  ctx.beginPath();
  ctx.ellipse(0, 0, 15, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a6fd6';
  ctx.beginPath();
  ctx.arc(8, -2, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1f2a44';
  ctx.fillRect(-26, -2, 14, 4);
  ctx.fillStyle = '#e63946';
  ctx.fillRect(-28, -2, 4, 4);
  ctx.restore();
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
