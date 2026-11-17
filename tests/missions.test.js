// Mission progression: start, reach a waypoint, deliver on time, fail on timeout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeMissionState, startMission, updateMission, MISSIONS } from '../game/src/missions.js';

const world = {
  landmarks: {
    marina: { x: 3000, y: 600, label: 'Marina Pier' },
    market: { x: 600, y: 1400, label: 'Harbor Market' },
    hotel: { x: 1000, y: 1000, label: 'Palms Hotel' },
    bank: { x: 1800, y: 1000, label: 'Bay Credit Bank' },
    hideout: { x: 2600, y: 1800, label: 'The Hideout' },
    garage: { x: 1400, y: 600, label: "Milo's Garage" },
  },
};

function fakeApi(playerPos) {
  const calls = { cash: 0, completed: [], failed: false };
  return {
    calls,
    playerX: () => playerPos.x,
    playerY: () => playerPos.y,
    toast: () => {},
    sfxMission: () => {},
    sfxFail: () => {},
    addCash: (n) => { calls.cash += n; },
    onMissionComplete: (def) => { calls.completed.push(def.id); },
    raiseWanted: () => {},
    wantedStars: () => 0,
    enemiesLeft: () => 0,
    spawnTailCar: () => ({ x: 600, y: 600 }),
    tailArrived: () => false,
    spawnBankGuards: () => {},
    spawnCourierCrew: () => {},
  };
}

test('there are five missions with rising rewards', () => {
  assert.equal(MISSIONS.length, 5);
  const rewards = MISSIONS.map((m) => m.reward);
  assert.deepEqual(rewards, [150, 300, 450, 800, 1200]);
  for (const m of MISSIONS) {
    assert.ok(m.name && m.giver && m.brief && m.stages.length >= 2);
  }
});

test('mission 1 completes when the player reaches the marina', () => {
  const state = makeMissionState();
  const pos = { x: 1000, y: 600 };
  const api = fakeApi(pos);
  assert.equal(startMission(state, world, api), true);
  assert.equal(state.active.def.id, 'm1');
  // Still driving: nothing happens far from the pier.
  updateMission(state, world, api, 1);
  assert.ok(state.active);
  // Arrive at the pier.
  pos.x = 3000; pos.y = 600;
  updateMission(state, world, api, 0.1);
  assert.equal(state.active, null);
  assert.deepEqual(state.done, ['m1']);
  assert.equal(state.index, 1);
  assert.equal(api.calls.cash, 150);
  assert.deepEqual(api.calls.completed, ['m1']);
});

test('mission 2 fails when the delivery timer runs out', () => {
  const state = makeMissionState();
  state.index = 1;
  const pos = { x: 600, y: 1400 };
  const api = fakeApi(pos);
  assert.equal(startMission(state, world, api), true);
  updateMission(state, world, api, 0.1); // collect the package
  assert.equal(state.active.stageIndex, 1);
  assert.ok(state.active.timer > 0);
  // Wait out the whole timer without delivering.
  updateMission(state, world, api, 200);
  assert.equal(state.active, null);
  assert.deepEqual(state.done, []);
  assert.equal(api.calls.cash, 0);
});

test('mission 2 pays when the delivery lands in time', () => {
  const state = makeMissionState();
  state.index = 1;
  const pos = { x: 600, y: 1400 };
  const api = fakeApi(pos);
  startMission(state, world, api);
  updateMission(state, world, api, 0.1); // collect
  pos.x = 1000; pos.y = 1000; // arrive at the hotel
  updateMission(state, world, api, 1);
  assert.equal(state.active, null);
  assert.deepEqual(state.done, ['m2']);
  assert.equal(api.calls.cash, 300);
});

test('cannot start a mission while one is active', () => {
  const state = makeMissionState();
  const api = fakeApi({ x: 0, y: 0 });
  assert.equal(startMission(state, world, api), true);
  assert.equal(startMission(state, world, api), false);
});
