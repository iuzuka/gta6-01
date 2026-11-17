// Shared math helpers: angles, circle-vs-rectangle collision and formatting.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { angleDiff, turnToward, circleHitsRect, pushCircleOutOfRect, money, clockString, clamp } from '../game/src/util.js';

test('angleDiff takes the short way around the circle', () => {
  assert.ok(Math.abs(angleDiff(0, Math.PI * 0.9)) < Math.PI);
  assert.ok(Math.abs(angleDiff(Math.PI * 0.9, -Math.PI * 0.9)) < 0.7); // 36° the short way, not 324°
  assert.equal(angleDiff(1, 1), 0);
});

test('turnToward never overshoots its target angle', () => {
  assert.equal(turnToward(0, 0.1, 0.5), 0.1);
  assert.equal(turnToward(0, 1, 0.3), 0.3);
  assert.equal(turnToward(0, -1, 0.3), -0.3);
});

test('circleHitsRect detects overlap and near misses', () => {
  const rect = { x: 100, y: 100, w: 50, h: 50 };
  assert.equal(circleHitsRect(120, 120, 10, rect), true);
  assert.equal(circleHitsRect(95, 120, 10, rect), true); // touching the edge
  assert.equal(circleHitsRect(50, 50, 10, rect), false);
});

test('pushCircleOutOfRect separates an overlapping circle', () => {
  const rect = { x: 100, y: 100, w: 50, h: 50 };
  const pos = { x: 120, y: 120 };
  assert.equal(pushCircleOutOfRect(pos, 10, rect), true);
  assert.equal(circleHitsRect(pos.x, pos.y, 10, rect), false);
  const far = { x: 0, y: 0 };
  assert.equal(pushCircleOutOfRect(far, 10, rect), false);
});

test('money and clock formatting', () => {
  assert.equal(money(1250), '$1,250');
  assert.equal(money(0), '$0');
  assert.equal(clockString(9.5), '09:30');
  assert.equal(clockString(19.25), '19:15');
  assert.equal(clockString(0), '00:00');
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
});
