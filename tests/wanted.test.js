// Wanted-level math: stars, heat, decay and police deployment.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wantedStars, addCrime, decayHeat, copsForStars, escapeRadius, MAX_WANTED } from '../game/src/police.js';

test('no heat means no stars', () => {
  assert.equal(wantedStars(0), 0);
  assert.equal(wantedStars(-10), 0);
});

test('100 heat per star, capped at five', () => {
  assert.equal(wantedStars(1), 1);
  assert.equal(wantedStars(100), 1);
  assert.equal(wantedStars(101), 2);
  assert.equal(wantedStars(500), 5);
  assert.equal(wantedStars(9999), MAX_WANTED);
});

test('crimes add their heat and clamp at the cap', () => {
  assert.equal(addCrime(0, 'steal'), 55);
  assert.equal(addCrime(0, 'shoot'), 70);
  assert.equal(addCrime(0, 'hitPed'), 90);
  assert.equal(addCrime(450, 'killCop'), 500);
  assert.equal(addCrime(0, 'unknown-crime'), 20);
});

test('hiding cools heat faster than being seen', () => {
  const seen = decayHeat(100, 10, false);
  const hidden = decayHeat(100, 10, true);
  assert.ok(hidden < seen);
  assert.equal(decayHeat(5, 10, true), 0);
  assert.equal(decayHeat(0, 10, true), 0);
});

test('more stars field more cops, with a bigger search radius', () => {
  assert.equal(copsForStars(0), 0);
  assert.equal(copsForStars(1), 1);
  assert.equal(copsForStars(5), 5);
  assert.ok(escapeRadius(5) > escapeRadius(1));
  assert.ok(escapeRadius(1) > 0);
});
