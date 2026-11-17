// Solmar Bay — particles and skid marks: dust kicked up by tyres, sparks
// from impacts, smoke from a wrecked car, and the dark tyre tracks a hard
// turn leaves on the asphalt.

export function makeParticles() {
  return { list: [], skids: [] };
}

export function spawnDust(particles, x, y, n = 3) {
  for (let i = 0; i < n; i++) {
    particles.list.push({
      kind: 'dust', x: x + (Math.random() - 0.5) * 14, y: y + (Math.random() - 0.5) * 14,
      vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40,
      life: 0.5 + Math.random() * 0.4, max: 0.9, size: 4 + Math.random() * 5,
    });
  }
}

export function spawnSparks(particles, x, y, n = 10) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 80 + Math.random() * 180;
    particles.list.push({
      kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.25 + Math.random() * 0.25, max: 0.5, size: 2 + Math.random() * 2,
    });
  }
}

export function spawnSmoke(particles, x, y, n = 2) {
  for (let i = 0; i < n; i++) {
    particles.list.push({
      kind: 'smoke', x: x + (Math.random() - 0.5) * 10, y: y + (Math.random() - 0.5) * 10,
      vx: (Math.random() - 0.5) * 12, vy: -18 - Math.random() * 20,
      life: 0.9 + Math.random() * 0.7, max: 1.6, size: 8 + Math.random() * 8,
    });
  }
}

export function spawnMuzzle(particles, x, y, angle) {
  particles.list.push({
    kind: 'muzzle', x: x + Math.cos(angle) * 14, y: y + Math.sin(angle) * 14,
    vx: 0, vy: 0, life: 0.06, max: 0.06, size: 10, angle,
  });
}

export function addSkid(particles, x1, y1, x2, y2) {
  particles.skids.push({ x1, y1, x2, y2, life: 6 });
  if (particles.skids.length > 400) particles.skids.splice(0, particles.skids.length - 400);
}

export function updateParticles(particles, dt) {
  for (const p of particles.list) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.kind === 'smoke') p.size += 14 * dt;
    if (p.kind === 'spark') { p.vx *= 0.92; p.vy *= 0.92; }
  }
  particles.list = particles.list.filter((p) => p.life > 0);
  for (const s of particles.skids) s.life -= dt;
  particles.skids = particles.skids.filter((s) => s.life > 0);
}

export function drawParticles(ctx, particles) {
  for (const s of particles.skids) {
    ctx.globalAlpha = Math.min(0.5, s.life / 6);
    ctx.strokeStyle = '#1c1c22';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const p of particles.list) {
    const a = Math.max(0, p.life / p.max);
    if (p.kind === 'dust') {
      ctx.globalAlpha = a * 0.35;
      ctx.fillStyle = '#c9b896';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'smoke') {
      ctx.globalAlpha = a * 0.4;
      ctx.fillStyle = '#555560';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'spark') {
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ffd34d';
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    } else if (p.kind === 'muzzle') {
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffe27a';
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.beginPath();
      ctx.moveTo(0, -4);
      ctx.lineTo(12, 0);
      ctx.lineTo(0, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}
