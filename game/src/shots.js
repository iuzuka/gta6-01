// Solmar Bay — staged screenshot states. The `shot` URL query picks a real
// state of the game (never a mockup): the title screen, Milo driving through
// downtown traffic, a police chase at three stars, or a mission in progress.
// Each state is built from the same systems the player uses.

import { dist } from './util.js';
import { makeCar } from './vehicles.js';
import { addCrime, wantedStars } from './police.js';
import { startMission } from './missions.js';
import { enterCar } from './player.js';

// Returns the shot name from the URL, or null for normal play.
export function shotFromUrl() {
  try {
    const q = new URLSearchParams(window.location.search);
    return q.get('shot');
  } catch {
    return null;
  }
}

// Drive the game into the requested staged state. Runs after the world is
// built; the main loop then keeps traffic, pedestrians and police moving.
export function applyShot(G, name) {
  const city = G.city;
  if (name === 'start') {
    G.screen = 'title';
    return;
  }
  G.screen = 'play';
  if (name === 'drive') {
    // Milo in a red Vento, rolling down the downtown strip with traffic.
    const car = G.traffic[0] || makeCar(1000, 600, 0, { color: '#c0392b', name: 'Vento' });
    car.x = 1000;
    car.y = 600;
    car.angle = 0;
    car.speed = 300;
    car.traffic = false;
    car.parked = false;
    G.player.x = 1000;
    G.player.y = 600;
    enterCar(G.player, car);
    if (!G.allCars.includes(car)) G.allCars.push(car);
    G.player.health = 100;
    G.clock = 16.5; // golden hour
    G.keys.up = true; // keep the car rolling for the shot
  } else if (name === 'chase') {
    const car = makeCar(1400, 1000, Math.PI / 2, { color: '#c0392b', name: 'Vento' });
    car.speed = 380;
    G.player.x = 1400;
    G.player.y = 1000;
    enterCar(G.player, car);
    if (!G.allCars.includes(car)) G.allCars.push(car);
    // Clear the road ahead so the getaway is not born in a traffic jam.
    G.traffic = G.traffic.filter((t) => dist(t.x, t.y, 1400, 1000) > 500);
    G.allCars = G.allCars.filter((c) => !c.traffic || dist(c.x, c.y, 1400, 1000) > 500);
    G.police.heat = addCrime(0, 'steal');
    G.police.heat = addCrime(G.police.heat, 'shoot');
    G.police.heat = addCrime(G.police.heat, 'shoot');
    G.police.heat = addCrime(G.police.heat, 'speedPastCop');
    G.police.stars = wantedStars(G.police.heat); // 3 stars
    G.police.lastSeen = { x: 1400, y: 1000 };
    // Two interceptors already on Milo's tail, close enough to see.
    for (const [dx, dy, angle] of [[-260, -180, 0.6], [200, 260, -2.2]]) {
      const cop = makeCar(1400 + dx, 1000 + dy, angle, { police: true, color: '#1f2a44', name: 'Interceptor', cruise: 330 });
      cop.speed = 340;
      G.police.cars.push(cop);
      G.allCars.push(cop);
    }
    G.clock = 19.2; // sunset, sirens on
    G.keys.up = true; // keep the getaway rolling for the shot
  } else if (name === 'mission') {
    // Mission 2 in progress: the timed delivery, downtown at noon.
    G.player.x = 600;
    G.player.y = 1320;
    G.player.health = 86;
    G.player.ammo = 18;
    G.clock = 11.0;
    G.missions.index = 1; // start "The Package", not mission 1
    startMission(G.missions, city, G.missionApi);
    // Skip the pickup stage so the shot shows the timed delivery leg.
    if (G.missions.active) {
      G.missions.active.stageIndex = 1;
      G.missions.active.timer = 82;
      G.missions.active.dialogueIndex = 1;
    }
  } else if (name === 'play') {
    G.player.x = 1000;
    G.player.y = 600;
    G.clock = 10.0;
  }
  G.camera.x = G.player.x;
  G.camera.y = G.player.y;
}
