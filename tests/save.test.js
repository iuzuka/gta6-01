// Save/load serialization: a save round-trips, and corrupt data falls back safely.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeSave, sanitizeSave, defaultSave } from '../game/src/save.js';

function fakeState() {
  return {
    cash: 1250, health: 73, ammo: 12, hasPistol: true,
    missionIndex: 2, missionsDone: ['m1', 'm2'],
    x: 1800, y: 1000, clock: 15.5, totalEarned: 450, carsStolen: 3,
  };
}

test('serialize then sanitize keeps every field', () => {
  const parsed = JSON.parse(serializeSave(fakeState()));
  const back = sanitizeSave(parsed);
  assert.equal(back.cash, 1250);
  assert.equal(back.health, 73);
  assert.equal(back.ammo, 12);
  assert.equal(back.hasPistol, true);
  assert.equal(back.missionIndex, 2);
  assert.deepEqual(back.missionsDone, ['m1', 'm2']);
  assert.equal(back.playerX, 1800);
  assert.equal(back.playerY, 1000);
  assert.equal(back.clock, 15.5);
  assert.equal(back.totalEarned, 450);
  assert.equal(back.carsStolen, 3);
  assert.equal(back.version, 1);
});

test('a missing or corrupt save falls back to the default', () => {
  assert.deepEqual(sanitizeSave(null), defaultSave());
  assert.deepEqual(sanitizeSave('garbage'), defaultSave());
  assert.deepEqual(sanitizeSave({}), defaultSave());
});

test('out-of-range values are clamped, not trusted', () => {
  const back = sanitizeSave({ cash: 'lots', health: -5, ammo: -3, missionIndex: 99, missionsDone: ['m1', 42, null], playerX: NaN });
  assert.equal(back.cash, 250);
  assert.equal(back.health, -5); // health is a plain number; gameplay clamps it
  assert.equal(back.ammo, 0);
  assert.equal(back.missionIndex, 5);
  assert.deepEqual(back.missionsDone, ['m1']);
  assert.equal(back.playerX, 1400);
});
