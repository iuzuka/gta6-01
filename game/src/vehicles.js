// Solmar Bay — vehicles: car physics, parked cars, and the traffic that
// drives the road grid. Traffic cars follow road centrelines, slow for the
// car ahead, and swerve away from a crash; parked cars wait to be stolen.

import { clamp, dist, makeRng, pick, randInt, range, turnToward } from './util.js';
import { ROAD_XS, ROAD_YS, ROAD_W, WORLD_W, WORLD_H, isOnRoad, nearestRoadX, nearestRoadY } from './city.js';

export const CAR_COLORS = ['#c0392b', '#2980b9', '#f39c12', '#27ae60', '#8e44ad', '#e8e8e8', '#2c3e50', '#e67e22', '#16a085', '#d4a017'];
export const CAR_NAMES = ['Vento', 'Cortez', 'Bison', 'Comet', 'Falcon', 'Rumba', 'Stallion', 'Prowler'];

export function makeCar(x, y, angle, opts = {}) {
  return {
    x, y, angle, speed: 0,
    color: opts.color || '#c0392b',
    name: opts.name || 'Vento',
    parked: !!opts.parked,
    traffic: !!opts.traffic,
    police: !!opts.police,
    // Traffic route: a list of road-centreline waypoints.
    route: opts.route || null,
    routeIndex: 0,
    cruise: opts.cruise || 150,
    health: 100,
    smoking: false,
    driver: opts.driver !== false,
    id: opts.id || 0,
  };
}

// A traffic car picks a random road route: drive along one road, turn at an
// intersection, keep going. Right-hand traffic: offset to the right of centre.
function newRoute(rng, car) {
  const vertical = rng() < 0.5;
  const route = [];
  let x = car.x;
  let y = car.y;
  for (let i = 0; i < 6; i++) {
    if (vertical) {
      const rx = pick(rng, ROAD_XS);
      route.push({ x: rx + (rng() < 0.5 ? 22 : -22), y: pick(rng, ROAD_YS) });
    } else {
      const ry = pick(rng, ROAD_YS);
      route.push({ x: pick(rng, ROAD_XS), y: ry + (rng() < 0.5 ? 22 : -22) });
    }
  }
  return route;
}

export function spawnTraffic(count, rng, excludeNear) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    let x = pick(rng, ROAD_XS);
    let y = pick(rng, ROAD_YS);
    if (excludeNear && dist(x, y, excludeNear.x, excludeNear.y) < 500) {
      x = pick(rng, ROAD_XS);
      y = pick(rng, ROAD_YS);
    }
    const vertical = rng() < 0.5;
    const car = makeCar(x, y, vertical ? Math.PI / 2 : 0, {
      color: pick(rng, CAR_COLORS), name: pick(rng, CAR_NAMES),
      traffic: true, cruise: range(rng, 120, 190), id: i + 1,
    });
    car.route = newRoute(rng, car);
    cars.push(car);
  }
  return cars;
}

export function spawnParked(count, rng, city) {
  const cars = [];
  let tries = 0;
  while (cars.length < count && tries < count * 20) {
    tries++;
    const rx = pick(rng, ROAD_XS);
    const ry = pick(rng, ROAD_YS);
    const side = rng() < 0.5 ? -1 : 1;
    const vertical = rng() < 0.5;
    const x = vertical ? rx + side * (ROAD_W / 2 - 14) : rx + range(rng, -120, 120);
    const y = vertical ? ry + range(rng, -120, 120) : ry + side * (ROAD_W / 2 - 14);
    if (x < 80 || x > WORLD_W - 80 || y < 80 || y > WORLD_H - 80) continue;
    if (cars.some((c) => dist(c.x, c.y, x, y) < 90)) continue;
    cars.push(makeCar(x, y, vertical ? Math.PI / 2 : 0, {
      color: pick(rng, CAR_COLORS), name: pick(rng, CAR_NAMES),
      parked: true, id: 1000 + cars.length,
    }));
  }
  return cars;
}

// Arcade car physics: throttle accelerates, steering scales with speed,
// reverse is slower, drag and rolling resistance bleed speed off.
export function driveCar(car, input, dt) {
  const forward = Math.cos(car.angle);
  const right = Math.sin(car.angle);
  const speedAlong = car.speed;
  const accel = 340;
  const brake = 520;
  const maxForward = 460;
  const maxReverse = 160;
  if (input.up) {
    car.speed += (car.speed < 0 ? brake : accel) * dt;
  } else if (input.down) {
    car.speed -= (car.speed > 0 ? brake : accel * 0.55) * dt;
  } else {
    // Coast: drag toward zero.
    car.speed -= car.speed * 0.9 * dt;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  car.speed = clamp(car.speed, -maxReverse, maxForward);
  const steerAuthority = clamp(Math.abs(car.speed) / 120, 0, 1);
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += steer * 2.1 * steerAuthority * dir * dt;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(nx, 40, WORLD_W - 40);
  car.y = clamp(ny, 40, WORLD_H - 40);
  return Math.abs(car.speed) > 260 && steer !== 0;
}

export function updateTraffic(cars, dt, rng, player, buildings) {
  for (const car of cars) {
    if (!car.traffic || car.health <= 0) continue;
    const target = car.route && car.route[car.routeIndex];
    if (!target) { car.route = newRoute(rng, car); car.routeIndex = 0; continue; }
    const want = Math.atan2(target.y - car.y, target.x - car.x);
    car.angle = turnToward(car.angle, want, 2.4 * dt);
    // Slow for the car ahead so traffic does not pile up.
    let desired = car.cruise;
    for (const other of cars) {
      if (other === car) continue;
      const ahead = (other.x - car.x) * Math.cos(car.angle) + (other.y - car.y) * Math.sin(car.angle);
      const side = Math.abs((other.x - car.x) * -Math.sin(car.angle) + (other.y - car.y) * Math.cos(car.angle));
      if (ahead > 0 && ahead < 70 && side < 30) desired = Math.min(desired, 40);
    }
    // Panic-brake for the player standing in the road.
    if (player && !player.inCar) {
      const ahead = (player.x - car.x) * Math.cos(car.angle) + (player.y - car.y) * Math.sin(car.angle);
      const side = Math.abs((player.x - car.x) * -Math.sin(car.angle) + (player.y - car.y) * Math.cos(car.angle));
      if (ahead > 0 && ahead < 90 && side < 34) desired = 0;
    }
    car.speed += (desired - car.speed) * Math.min(1, 1.6 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (dist(car.x, car.y, target.x, target.y) < 40) {
      car.routeIndex++;
      if (car.routeIndex >= car.route.length) { car.route = newRoute(rng, car); car.routeIndex = 0; }
    }
    // Keep traffic on the map; respawn far away if it ever leaves.
    if (car.x < 20 || car.x > WORLD_W - 20 || car.y < 20 || car.y > WORLD_H - 20) {
      const p = { x: pick(rng, ROAD_XS), y: pick(rng, ROAD_YS) };
      car.x = p.x; car.y = p.y; car.route = newRoute(rng, car); car.routeIndex = 0;
    }
  }
}

// Simple circle collision between cars: push apart and trade a little speed.
// The player's car has priority: traffic takes the hit and the player's
// speed is mostly kept, so a head-on jam cannot pin the player in place.
export function collideCars(cars, priorityCar = null) {
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const min = 44;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        const aIsPriority = priorityCar !== null && a === priorityCar;
        const bIsPriority = priorityCar !== null && b === priorityCar;
        if (aIsPriority) {
          b.x += nx * (min - d);
          b.y += ny * (min - d);
          b.speed *= 0.4;
          a.speed *= 0.92;
        } else if (bIsPriority) {
          a.x -= nx * (min - d);
          a.y -= ny * (min - d);
          a.speed *= 0.4;
          b.speed *= 0.92;
        } else {
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
          const tmp = a.speed;
          a.speed = b.speed * 0.5;
          b.speed = tmp * 0.5;
        }
        if (Math.abs(a.speed) > 120 || Math.abs(b.speed) > 120) {
          a.health -= 4; b.health -= 4;
        }
      }
    }
  }
}

export function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(-22, -11, 46, 24);
  // Body.
  ctx.fillStyle = car.police ? '#1f2a44' : car.color;
  ctx.beginPath();
  ctx.roundRect(-23, -12, 46, 24, 7);
  ctx.fill();
  // Cabin and windshield.
  ctx.fillStyle = car.police ? '#dfe6ee' : '#22303e';
  ctx.beginPath();
  ctx.roundRect(-6, -10, 16, 20, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.55)';
  ctx.fillRect(8, -9, 4, 18);
  // Headlights and taillights.
  ctx.fillStyle = '#ffe9a3';
  ctx.fillRect(21, -10, 3, 5);
  ctx.fillRect(21, 5, 3, 5);
  ctx.fillStyle = '#ff4d4d';
  ctx.fillRect(-24, -10, 3, 5);
  ctx.fillRect(-24, 5, 3, 5);
  if (car.police) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-2, -12, 10, 24);
    ctx.fillStyle = '#e63946';
    ctx.fillRect(-2, -12, 5, 24);
    ctx.fillStyle = '#2a6fd6';
    ctx.fillRect(3, -12, 5, 24);
  }
  if (car.smoking || car.health < 35) {
    ctx.fillStyle = 'rgba(90,90,95,0.5)';
    ctx.beginPath();
    ctx.arc(18, 0, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (car.police) {
    // Flashing light bar.
    const t = (Date.now() / 300) % 2;
    ctx.fillStyle = t < 1 ? '#ff3b30' : '#2a6fd6';
    ctx.beginPath();
    ctx.arc(car.x, car.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}
