// Solmar Bay — the story: eight missions for Milo Reyes, a driver-for-hire
// pulled back into the underworld by his old friend Rosa Vega. Each mission
// is a small state machine: stages advance on waypoints, timers, kills and
// deliveries, and every mission pays cash on success and can fail outright.

import { dist } from './util.js';
import { money } from './util.js';

export const MISSIONS = [
  {
    id: 'm1', name: 'Back in the Saddle', giver: 'Rosa Vega', reward: 150,
    brief: 'Rosa needs a driver she can trust. Prove the old magic is still there: take the Vento to the Marina Pier.',
    stages: [
      { kind: 'goto', label: 'Drive to the Marina Pier', target: 'marina' },
      { kind: 'done', label: 'Report back to Rosa' },
    ],
    dialogue: [
      { who: 'Rosa Vega', text: 'Milo! Three years gone and you still park like a tourist. Get in the car.' },
      { who: 'Rosa Vega', text: 'Drive me to the Marina Pier. Easy. No cops, no trouble. Just drive.' },
    ],
  },
  {
    id: 'm2', name: 'The Package', giver: 'Rosa Vega', reward: 300,
    brief: 'A package is waiting at Harbor Market. Collect it and get it to the Palms Hotel before the buyer walks away. 100 seconds.',
    stages: [
      { kind: 'goto', label: 'Collect the package at Harbor Market', target: 'market' },
      { kind: 'timed', label: 'Deliver the package to the Palms Hotel', target: 'hotel', time: 100 },
      { kind: 'done', label: 'Delivery complete' },
    ],
    dialogue: [
      { who: 'Rosa Vega', text: 'A buyer is waiting at the Palms. The package is at Harbor Market. Do not open it. Do not stop for anyone.' },
      { who: 'Milo Reyes', text: 'A hundred seconds? Rosa, I drive a Vento, not a rocket.' },
    ],
  },
  {
    id: 'm3', name: 'Tail the Courier', giver: 'Dante Cole', reward: 450,
    brief: "Dante's rival crew has a courier moving product through town. Tail his car without being spotted — too close and he bolts, too far and you lose him.",
    stages: [
      { kind: 'tail', label: 'Tail the courier — stay close, stay unseen', target: 'tail' },
      { kind: 'fight', label: 'Take out the courier crew', target: 'tail' },
      { kind: 'done', label: 'Courier dealt with' },
    ],
    dialogue: [
      { who: 'Dante Cole', text: 'The courier drives a yellow Comet. Follow him. If he sees you, he runs, and the deal dies with him.' },
      { who: 'Dante Cole', text: 'When he stops, take the case. His friends will object. Object back.' },
    ],
  },
  {
    id: 'm4', name: 'The Bay Credit Job', giver: 'Rosa Vega', reward: 800,
    brief: 'The Bay Credit Bank holds the crew money of the men who burned Rosa out. Walk in, take it back, and walk out through their guns.',
    stages: [
      { kind: 'goto', label: 'Reach the Bay Credit Bank', target: 'bank' },
      { kind: 'fight', label: 'Clear the bank floor — 4 guards', target: 'bank' },
      { kind: 'goto', label: 'Escape to the Hideout', target: 'hideout' },
      { kind: 'done', label: 'The money is ours' },
    ],
    dialogue: [
      { who: 'Rosa Vega', text: 'They took everything from me once. Tonight we take it back. The bank. Four guards. You and me.' },
      { who: 'Milo Reyes', text: 'Four guards, Rosa. I brought a pistol and a prayer.' },
    ],
  },
  {
    id: 'm5', name: 'The Long Goodbye', giver: 'Rosa Vega', reward: 1200,
    brief: 'The whole SBPD is coming. Get Rosa to the Hideout across town with the heat on your tail — lose them or outrun them, then disappear.',
    stages: [
      { kind: 'goto', label: 'Pick up Rosa at the Marina Pier', target: 'marina' },
      { kind: 'chase', label: 'Lose the police and reach the Hideout', target: 'hideout' },
      { kind: 'done', label: 'Solmar Bay is yours again' },
    ],
    dialogue: [
      { who: 'Rosa Vega', text: 'They are coming for us, Milo. One last drive. If we make the Hideout, we are free. If not...' },
      { who: 'Milo Reyes', text: 'Then we drive like the city owes us. Because it does.' },
    ],
  },
  {
    id: 'm6', name: 'The Docks Deal', giver: 'Dante Cole', reward: 1500,
    brief: "Dante's buyers are waiting at the casino, but the rival crew hit the docks first. Clear them out, then run the case to the casino in 120 seconds.",
    stages: [
      { kind: 'goto', label: 'Reach the Harbor Docks', target: 'docks' },
      { kind: 'fight', label: 'Clear the docks — 5 rivals', target: 'docks' },
      { kind: 'timed', label: 'Run the case to the Golden Palm Casino', target: 'casino', time: 120 },
      { kind: 'done', label: 'The deal is done' },
    ],
    dialogue: [
      { who: 'Dante Cole', text: 'The case is at the docks and the Vipers got there first. Five of them. Take it back.' },
      { who: 'Dante Cole', text: 'When the docks are clear, the buyers are at the Golden Palm. Two minutes, Milo. Do not be late.' },
    ],
  },
  {
    id: 'm7', name: 'Night at the Casino', giver: 'Rosa Vega', reward: 2000, night: true,
    brief: 'The Golden Palm Casino skims the crew money every night. Walk in after dark, take the vault cash from six guards, and slip out to the Hideout.',
    stages: [
      { kind: 'goto', label: 'Reach the Golden Palm Casino', target: 'casino' },
      { kind: 'fight', label: 'Clear the casino floor — 6 guards', target: 'casino' },
      { kind: 'goto', label: 'Escape to the Hideout', target: 'hideout' },
      { kind: 'done', label: 'The vault is empty' },
    ],
    dialogue: [
      { who: 'Rosa Vega', text: 'The Golden Palm skims our money every single night. Tonight we skim it back. Six guards. Bring the loud one.' },
      { who: 'Milo Reyes', text: 'A casino heist at night. Rosa, you always did know how to plan a date.' },
    ],
  },
  {
    id: 'm8', name: 'The Last Ferry', giver: 'Rosa Vega', reward: 3000,
    brief: 'One last run. Pick Rosa up at the Marina Pier with every cop in Solmar Bay on your tail — the helicopter included — and make the midnight ferry.',
    stages: [
      { kind: 'goto', label: 'Pick up Rosa at the Marina Pier', target: 'marina' },
      { kind: 'chase', label: 'Lose the police and reach the Last Ferry', target: 'ferry' },
      { kind: 'done', label: 'Solmar Bay is behind you' },
    ],
    dialogue: [
      { who: 'Rosa Vega', text: 'The ferry leaves at midnight, Milo. Every cop in the city will be between us and it. Drive like you mean it.' },
      { who: 'Milo Reyes', text: 'Then we drive. And when we are on that ferry, this city can keep its noise.' },
    ],
  },
];

export function makeMissionState() {
  return {
    active: null, // { def, stageIndex, timer, dialogue, dialogueIndex, dialogueTimer, targetCar, enemiesSpawned, tailSpotted }
    index: 0, // next mission number (0..5)
    done: [], // completed mission ids
    message: '', // transient toast
    messageTimer: 0,
  };
}

export function currentMissionDef(state) {
  return MISSIONS[state.index] || null;
}

export function startMission(state, world, api) {
  const def = currentMissionDef(state);
  if (!def || state.active) return false;
  if (def.night && api.setClock) api.setClock(21.5); // a night job starts after dark
  state.active = {
    def,
    stageIndex: 0,
    timer: 0,
    dialogue: def.dialogue.slice(),
    dialogueIndex: 0,
    dialogueTimer: 0,
    targetCar: null,
    enemiesSpawned: false,
    tailDistance: 0,
    spottedTimer: 0,
  };
  const stage = def.stages[0];
  if (stage.kind === 'tail') {
    state.active.targetCar = api.spawnTailCar();
  }
  api.toast(def.name + ' — ' + def.brief);
  api.sfxMission();
  return true;
}

function stageTarget(stage, world, mission) {
  if (stage.kind === 'tail' || stage.kind === 'fight') {
    if (mission.targetCar) return { x: mission.targetCar.x, y: mission.targetCar.y, label: 'Courier' };
  }
  const lm = world.landmarks[stage.target];
  return lm ? { x: lm.x, y: lm.y, label: lm.label } : null;
}

export function missionWaypoint(state, world) {
  if (!state.active) return null;
  const stage = state.active.def.stages[state.active.stageIndex];
  if (!stage || stage.kind === 'done') return null;
  return stageTarget(stage, world, state.active);
}

export function missionObjective(state) {
  if (!state.active) return null;
  const stage = state.active.def.stages[state.active.stageIndex];
  if (!stage) return null;
  return { label: stage.label, timer: state.active.timer };
}

function advanceStage(state, api) {
  state.active.stageIndex++;
  const def = state.active.def;
  const stage = def.stages[state.active.stageIndex];
  if (!stage) return;
  if (stage.kind === 'tail') {
    state.active.targetCar = api.spawnTailCar();
  } else if (stage.kind === 'fight' && state.active.def.id === 'm4') {
    api.spawnBankGuards();
    state.active.enemiesSpawned = true;
  } else if (stage.kind === 'fight' && state.active.def.id === 'm6') {
    api.spawnRivalCrew();
    state.active.enemiesSpawned = true;
  } else if (stage.kind === 'fight' && state.active.def.id === 'm7') {
    api.spawnCasinoGuards();
    state.active.enemiesSpawned = true;
  } else if (stage.kind === 'fight') {
    api.spawnCourierCrew();
    state.active.enemiesSpawned = true;
  }
  if (stage.kind === 'timed') state.active.timer = stage.time;
  if (stage.kind === 'chase') api.raiseWanted(state.active.def.id === 'm8' ? 5 : 3);
}

function completeMission(state, api) {
  const def = state.active.def;
  state.done.push(def.id);
  state.index = Math.min(8, state.index + 1);
  api.addCash(def.reward);
  api.toast('Mission complete: ' + def.name + ' — earned ' + money(def.reward));
  api.sfxMission();
  api.onMissionComplete(def);
  state.active = null;
}

function failMission(state, api, reason) {
  api.toast('Mission failed: ' + reason);
  api.sfxFail();
  state.active = null;
}

// Advance the active mission one tick. `api` is the game wiring: player
// position, enemy counts, cash, sounds and spawners.
export function updateMission(state, world, api, dt) {
  if (!state.active) return;
  const m = state.active;
  const def = m.def;
  const stage = def.stages[m.stageIndex];
  if (!stage) { completeMission(state, api); return; }

  // Dialogue lines roll one at a time, 3.5 seconds each.
  if (m.dialogueIndex < m.dialogue.length) {
    m.dialogueTimer += dt;
    if (m.dialogueTimer > 3.5) { m.dialogueTimer = 0; m.dialogueIndex++; }
  }

  const px = api.playerX();
  const py = api.playerY();
  const target = stageTarget(stage, world, m);

  if (stage.kind === 'goto' || stage.kind === 'timed') {
    if (stage.kind === 'timed') {
      m.timer -= dt;
      if (m.timer <= 0) { failMission(state, api, 'Out of time'); return; }
    }
    if (target && dist(px, py, target.x, target.y) < 70) {
      if (stage.kind === 'goto' && def.id === 'm1') {
        // Mission 1 is a pure drive: arriving finishes the drive stage.
      }
      advanceStage(state, api);
      if (def.stages[m.stageIndex] && def.stages[m.stageIndex].kind === 'done') {
        completeMission(state, api);
      }
    }
  } else if (stage.kind === 'tail') {
    const car = m.targetCar;
    if (!car) { failMission(state, api, 'Lost the courier'); return; }
    const d = dist(px, py, car.x, car.y);
    m.tailDistance = d;
    if (d > 900) { failMission(state, api, 'Lost the courier'); return; }
    if (d < 110) {
      m.spottedTimer += dt;
      if (m.spottedTimer > 2.5) {
        api.toast('Spotted! The courier is running!');
        advanceStage(state, api);
      }
    } else {
      m.spottedTimer = Math.max(0, m.spottedTimer - dt);
    }
    // The tail ends when the courier reaches his stop.
    if (api.tailArrived && api.tailArrived()) {
      advanceStage(state, api);
    }
  } else if (stage.kind === 'fight') {
    if (api.enemiesLeft() === 0 && m.enemiesSpawned) {
      advanceStage(state, api);
      if (def.stages[m.stageIndex] && def.stages[m.stageIndex].kind === 'done') {
        completeMission(state, api);
      }
    }
  } else if (stage.kind === 'chase') {
    if (target && dist(px, py, target.x, target.y) < 70) {
      if (api.wantedStars() === 0) {
        advanceStage(state, api);
        completeMission(state, api);
      } else {
        api.toast('Lose the police first — stay out of sight!');
      }
    }
  } else if (stage.kind === 'done') {
    completeMission(state, api);
  }
}

export function currentDialogue(state) {
  if (!state.active) return null;
  const m = state.active;
  if (m.dialogueIndex >= m.dialogue.length) return null;
  return m.dialogue[m.dialogueIndex];
}
