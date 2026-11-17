// Car collisions: traffic yields to the player's car, and two traffic cars
// trade speed when they meet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCar, collideCars, driveCar } from '../game/src/vehicles.js';

test('the player car keeps its speed through a head-on collision', () => {
  const player = makeCar(100, 100, 0, { name: 'Vento' });
  player.speed = 300;
  const other = makeCar(120, 100, Math.PI, { name: 'Comet', traffic: true });
  other.speed = 150;
  collideCars([player, other], player);
  assert.ok(Math.abs(player.speed) > 200, 'player speed kept, got ' + player.speed);
  assert.ok(Math.abs(other.speed) < 100, 'traffic car slowed, got ' + other.speed);
  const d = Math.hypot(player.x - other.x, player.y - other.y);
  assert.ok(d >= 44, 'cars separated, distance ' + d);
});

test('two traffic cars trade speed and separate', () => {
  const a = makeCar(100, 100, 0, { traffic: true });
  a.speed = 200;
  const b = makeCar(120, 100, 0, { traffic: true });
  b.speed = 100;
  collideCars([a, b]);
  assert.equal(a.speed, 50);
  assert.equal(b.speed, 100);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 44);
});

test('driving accelerates forward and brakes in reverse', () => {
  const car = makeCar(500, 500, 0, {});
  driveCar(car, { up: true }, 1);
  assert.ok(car.speed > 200, 'accelerated, got ' + car.speed);
  assert.ok(car.x > 500, 'moved forward');
  const before = car.speed;
  driveCar(car, { down: true }, 0.5);
  assert.ok(car.speed < before, 'braking slows the car');
});
