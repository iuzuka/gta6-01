// Solmar Bay — combat: fists and the pistol, bullets, muzzle flashes, enemy
// shooters, and the damage numbers every fight runs on. Enemies are plain
// objects so missions can spawn their own crews.

import { dist } from './util.js';

export function makeBullets() {
  return [];
}

export function fireBullet(bullets, x, y, angle, opts = {}) {
  bullets.push({
    x: x + Math.cos(angle) * 18,
    y: y + Math.sin(angle) * 18,
    vx: Math.cos(angle) * 720,
    vy: Math.sin(angle) * 720,
    life: 0.9,
    damage: opts.damage || 34,
    fromPlayer: opts.fromPlayer !== false,
  });
}

export function updateBullets(bullets, dt, hitTargets, onHitWall) {
  for (const b of bullets) {
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.life <= 0) continue;
    for (const t of hitTargets) {
      if (t.health <= 0) continue;
      const r = t.radius || 16;
      if (dist(b.x, b.y, t.x, t.y) < r) {
        t.health -= b.damage;
        b.life = 0;
        if (onHitWall) onHitWall(b.x, b.y, t);
        break;
      }
    }
  }
  return bullets.filter((b) => b.life > 0);
}

export function drawBullets(ctx, bullets) {
  ctx.fillStyle = '#ffe27a';
  for (const b of bullets) {
    ctx.fillRect(b.x - 3, b.y - 1.5, 6, 3);
  }
}

// A melee swing: hits anything within reach in front of the attacker.
export function meleeHit(attacker, angle, targets, range = 34, damage = 22) {
  let hitAny = false;
  for (const t of targets) {
    if (t.health <= 0) continue;
    const d = dist(attacker.x, attacker.y, t.x, t.y);
    if (d > range + (t.radius || 14)) continue;
    const a = Math.atan2(t.y - attacker.y, t.x - attacker.x);
    let diff = a - angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) < 1.1) {
      t.health -= damage;
      hitAny = true;
    }
  }
  return hitAny;
}

export function makeEnemy(x, y, opts = {}) {
  return {
    x, y, health: opts.health || 70, radius: 15,
    speed: opts.speed || 120,
    shootTimer: 1 + Math.random() * 1.5,
    aim: 0, name: opts.name || 'Goon',
    kind: opts.kind || 'shooter',
    patrolX: x, patrolY: y,
  };
}

// Enemy AI: close in, strafe at range, and shoot the player when in range.
export function updateEnemies(enemies, dt, player, fireEnemyBullet) {
  for (const e of enemies) {
    if (e.health <= 0) continue;
    const d = dist(e.x, e.y, player.x, player.y);
    e.aim = Math.atan2(player.y - e.y, player.x - e.x);
    if (d > 260) {
      e.x += Math.cos(e.aim) * e.speed * dt;
      e.y += Math.sin(e.aim) * e.speed * dt;
    } else if (d < 140) {
      e.x -= Math.cos(e.aim) * e.speed * 0.6 * dt;
      e.y -= Math.sin(e.aim) * e.speed * 0.6 * dt;
    } else {
      // Strafe sideways so the fight moves.
      const strafe = Math.sin(Date.now() / 900 + e.patrolX) > 0 ? 1 : -1;
      e.x += Math.cos(e.aim + Math.PI / 2) * strafe * e.speed * 0.5 * dt;
      e.y += Math.sin(e.aim + Math.PI / 2) * strafe * e.speed * 0.5 * dt;
    }
    e.shootTimer -= dt;
    if (e.shootTimer <= 0 && d < 420 && player.health > 0) {
      e.shootTimer = 1.4 + Math.random() * 1.1;
      fireEnemyBullet(e.x, e.y, e.aim);
    }
  }
  return enemies.filter((e) => e.health > 0);
}

export function drawEnemy(ctx, e) {
  const flash = e.shootTimer > 1.9 ? 1 : 0;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 7, 7, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(e.aim);
  ctx.fillStyle = '#3a2e2e';
  ctx.beginPath();
  ctx.roundRect(-6, -7, 13, 14, 4);
  ctx.fill();
  // Gun barrel.
  ctx.fillStyle = '#222';
  ctx.fillRect(6, -1.5, 10, 3);
  if (flash) {
    ctx.fillStyle = '#ffe27a';
    ctx.beginPath();
    ctx.moveTo(16, -4);
    ctx.lineTo(26, 0);
    ctx.lineTo(16, 4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // Health bar.
  ctx.fillStyle = '#222';
  ctx.fillRect(e.x - 14, e.y - 26, 28, 4);
  ctx.fillStyle = '#e63946';
  ctx.fillRect(e.x - 14, e.y - 26, 28 * Math.max(0, e.health / 70), 4);
}
