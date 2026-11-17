// Solmar Bay — Milo Reyes: on-foot movement, health, weapons, and getting
// in and out of cars. The player object is the one thing every system reads,
// so it stays small and explicit.

import { clamp, dist } from './util.js';
import { WORLD_W, WORLD_H, isBeach } from './city.js';

export function makePlayer(x, y) {
  return {
    x, y, angle: 0, // facing, radians
    speed: 0,
    health: 100,
    maxHealth: 100,
    cash: 250,
    ammo: 24,
    hasPistol: true,
    weapon: 'pistol', // 'fist' | 'pistol'
    inCar: null, // the car object Milo is driving, or null
    punchTimer: 0,
    shootCooldown: 0,
    hurtTimer: 0,
    arrestTimer: 0, // time spent being grabbed by police
    dead: false,
    totalEarned: 0,
    carsStolen: 0,
  };
}

const FOOT_SPEED = 210;
const RUN_MULT = 1.55;

// On-foot movement: WASD/arrows, Shift to run, collision with buildings.
export function updatePlayerOnFoot(player, input, dt, collide) {
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len;
    my /= len;
    const speed = FOOT_SPEED * (input.run ? RUN_MULT : 1) * (isBeach(player.x, player.y) ? 0.8 : 1);
    player.x = clamp(player.x + mx * speed * dt, 24, WORLD_W - 24);
    player.y = clamp(player.y + my * speed * dt, 24, WORLD_H - 24);
    player.angle = Math.atan2(my, mx);
    player.speed = speed;
  } else {
    player.speed = 0;
  }
  if (collide) collide(player, 14);
  player.punchTimer = Math.max(0, player.punchTimer - dt);
  player.shootCooldown = Math.max(0, player.shootCooldown - dt);
  player.hurtTimer = Math.max(0, player.hurtTimer - dt);
}

export function hurtPlayer(player, amount) {
  if (player.dead || player.hurtTimer > 0.25) return;
  player.health = Math.max(0, player.health - amount);
  player.hurtTimer = 0.35;
  if (player.health <= 0) player.dead = true;
}

export function healPlayer(player, amount) {
  player.health = Math.min(player.maxHealth, player.health + amount);
}

// Find the nearest car the player could enter (parked, traffic or police).
export function nearestEnterableCar(player, cars, maxDist = 70) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (car.health <= 0) continue;
    const d = dist(player.x, player.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

// Milo gets in: parked cars and traffic cars are stealable; a police car
// already has its own driver and cannot be taken.
export function enterCar(player, car) {
  if (!car || car.police) return null;
  const stolen = car.parked || car.traffic;
  car.parked = false;
  car.traffic = false;
  player.inCar = car;
  player.x = car.x;
  player.y = car.y;
  return { stolen };
}

export function exitCar(player) {
  const car = player.inCar;
  if (!car) return null;
  const side = Math.cos(car.angle + Math.PI / 2);
  const sideY = Math.sin(car.angle + Math.PI / 2);
  player.x = clamp(car.x + side * 34, 24, WORLD_W - 24);
  player.y = clamp(car.y + sideY * 34, 24, WORLD_H - 24);
  player.angle = car.angle;
  player.inCar = null;
  car.speed = 0;
  return car;
}

export function drawPlayer(ctx, player, aimAngle) {
  if (player.dead) return;
  const bob = player.speed > 10 ? Math.sin(Date.now() / 90) * 2 : 0;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 8, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(aimAngle !== undefined ? aimAngle : player.angle);
  // Legs.
  ctx.strokeStyle = '#2c3e50';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-4 + bob, 9);
  ctx.moveTo(0, 0);
  ctx.lineTo(4 - bob, 9);
  ctx.stroke();
  // Jacket — Milo's teal driver jacket.
  ctx.fillStyle = '#0e7c7b';
  ctx.beginPath();
  ctx.roundRect(-6, -8, 12, 13, 5);
  ctx.fill();
  // Head.
  ctx.fillStyle = '#c68642';
  ctx.beginPath();
  ctx.arc(2, -11, 5.5, 0, Math.PI * 2);
  ctx.fill();
  // Hair.
  ctx.fillStyle = '#1c1c1c';
  ctx.beginPath();
  ctx.arc(1, -13, 5, Math.PI, Math.PI * 2);
  ctx.fill();
  // Weapon in hand.
  if (player.weapon === 'pistol') {
    ctx.fillStyle = '#222';
    ctx.fillRect(6, -2, 11, 3);
  }
  ctx.restore();
}
