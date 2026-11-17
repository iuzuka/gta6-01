// Solmar Bay — the HUD, the minimap and every menu: title screen, pause,
// game over, mission log and the dialogue box. All drawn on the canvas so
// the game needs no DOM beyond the canvas itself.

import { clamp, clockString, money } from './util.js';
import { WORLD_W, WORLD_H, districtAt } from './city.js';
import { missionObjective, currentDialogue, MISSIONS } from './missions.js';

export function drawStars(ctx, stars, x, y) {
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? '#ffd34d' : 'rgba(255,255,255,0.25)';
    drawStarShape(ctx, x + i * 26, y, 10, i < stars);
  }
}

function drawStarShape(ctx, cx, cy, r, lit) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const px = cx + Math.cos(a) * rr;
    const py = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  if (lit) {
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function panel(ctx, x, y, w, h, alpha = 0.55) {
  ctx.fillStyle = `rgba(10,14,22,${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
}

export function drawHud(ctx, G, W, H) {
  const p = G.player;
  const police = G.police;
  ctx.textBaseline = 'alphabetic';

  // Top right: cash, clock, district.
  panel(ctx, W - 232, 12, 220, 66);
  ctx.fillStyle = '#7dff9a';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(money(p.cash), W - 24, 40);
  ctx.fillStyle = '#fff';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText(clockString(G.clock) + '  •  ' + districtAt(p.x, p.y).name, W - 24, 62);

  // Top left: wanted stars.
  panel(ctx, 12, 12, 168, 46);
  drawStars(ctx, police.stars, 34, 36);
  if (police.stars > 0 && police.hiddenTimer > 4) {
    ctx.fillStyle = '#9fd8ff';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('HIDDEN — stay out of sight', 12, 74);
  }

  // Bottom left: health bar and weapon.
  panel(ctx, 12, H - 66, 300, 54);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('MILO REYES', 24, H - 46);
  ctx.fillStyle = '#222';
  ctx.fillRect(24, H - 38, 150, 10);
  ctx.fillStyle = p.health > 40 ? '#4ade80' : '#e63946';
  ctx.fillRect(24, H - 38, 150 * clamp(p.health / 100, 0, 1), 10);
  ctx.fillStyle = '#fff';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(p.weapon === 'pistol' ? 'Pistol  •  ' + p.ammo + ' rounds  [click to fire]' : 'Fists  [click to punch]', 24, H - 18);

  // Bottom right: speed when driving, or a hint on foot.
  if (p.inCar) {
    panel(ctx, W - 172, H - 66, 160, 54);
    const kmh = Math.round(Math.abs(p.inCar.speed) * 0.32);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(kmh + ' km/h', W - 24, H - 34);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#cfe3ff';
    ctx.fillText(p.inCar.name + '  •  E to exit', W - 24, H - 18);
  } else {
    panel(ctx, W - 232, H - 66, 220, 54);
    ctx.fillStyle = '#cfe3ff';
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('WASD move • Shift run • E enter car', W - 24, H - 42);
    ctx.fillText('Click shoot • M mission • Esc pause', W - 24, H - 22);
  }

  // Mission objective tracker, under the stars.
  const obj = missionObjective(G.missions);
  if (obj) {
    const lines = [obj.label];
    if (obj.timer > 0) lines.push('Time left: ' + Math.ceil(obj.timer) + 's');
    panel(ctx, 12, 66, 300, 22 + lines.length * 20);
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('MISSION: ' + G.missions.active.def.name, 22, 88);
    ctx.fillStyle = '#fff';
    ctx.font = '13px system-ui, sans-serif';
    lines.forEach((l, i) => ctx.fillText(l, 22, 108 + i * 20));
  } else if (G.missions.index < 5) {
    panel(ctx, 12, 66, 300, 44);
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('NEXT: ' + MISSIONS[G.missions.index].name, 22, 88);
    ctx.fillStyle = '#fff';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('Press M or drive to the yellow marker', 22, 106);
  }

  // Dialogue box.
  const dlg = currentDialogue(G.missions);
  if (dlg) {
    const bw = Math.min(640, W - 80);
    panel(ctx, (W - bw) / 2, H - 150, bw, 62, 0.72);
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(dlg.who.toUpperCase(), (W - bw) / 2 + 16, H - 126);
    ctx.fillStyle = '#fff';
    ctx.font = '15px system-ui, sans-serif';
    wrapText(ctx, dlg.text, (W - bw) / 2 + 16, H - 104, bw - 32, 19);
  }

  // Toast message, below the mission tracker so the two never overlap.
  if (G.missions.messageTimer > 0 && G.missions.message) {
    ctx.globalAlpha = clamp(G.missions.messageTimer, 0, 1);
    ctx.font = 'bold 17px system-ui, sans-serif';
    const tw = ctx.measureText(G.missions.message).width;
    panel(ctx, (W - tw) / 2 - 14, 150, tw + 28, 34, 0.7);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(G.missions.message, W / 2, 173);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  // "Press E" prompt near a car.
  if (G.nearCar && !p.inCar) {
    ctx.font = 'bold 15px system-ui, sans-serif';
    const t = 'Press E to get in the ' + G.nearCar.name;
    const tw = ctx.measureText(t).width;
    panel(ctx, (W - tw) / 2 - 12, H - 210, tw + 24, 30, 0.7);
    ctx.fillStyle = '#ffe27a';
    ctx.textAlign = 'center';
    ctx.fillText(t, W / 2, H - 190);
    ctx.textAlign = 'left';
  }

  drawMinimap(ctx, G, W, H);
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, yy);
}

export function drawMinimap(ctx, G, W, H) {
  const size = 190;
  const x0 = W - size - 14;
  const y0 = H - size - 86;
  const scale = size / Math.max(WORLD_W, WORLD_H);
  panel(ctx, x0 - 6, y0 - 6, size + 12, size + 12, 0.6);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  // Sea and sand.
  ctx.fillStyle = '#274b5e';
  ctx.fillRect(x0, y0, size, size);
  ctx.fillStyle = '#c9a86a';
  ctx.fillRect(x0, y0 + size * 0.88, size, size * 0.12);
  // City ground.
  ctx.fillStyle = '#3a4a3a';
  ctx.fillRect(x0, y0, size, size * 0.88);
  // Roads.
  ctx.strokeStyle = '#8a8f96';
  ctx.lineWidth = 3;
  for (const rx of G.cityRoadXs) {
    ctx.beginPath();
    ctx.moveTo(x0 + rx * scale, y0);
    ctx.lineTo(x0 + rx * scale, y0 + size * 0.88);
    ctx.stroke();
  }
  for (const ry of G.cityRoadYs) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + ry * scale);
    ctx.lineTo(x0 + size, y0 + ry * scale);
    ctx.stroke();
  }
  // Escape radius.
  if (G.police.stars > 0 && G.police.lastSeen) {
    ctx.strokeStyle = 'rgba(255,80,80,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x0 + G.police.lastSeen.x * scale, y0 + G.police.lastSeen.y * scale, G.escapeRadius * scale, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Mission waypoint.
  if (G.waypoint) {
    const wx = x0 + G.waypoint.x * scale;
    const wy = y0 + G.waypoint.y * scale;
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.arc(wx, wy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Police.
  ctx.fillStyle = '#3b82f6';
  for (const car of G.police.cars) {
    ctx.beginPath();
    ctx.arc(x0 + car.x * scale, y0 + car.y * scale, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player.
  const px = x0 + G.player.x * scale;
  const py = y0 + G.player.y * scale;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(px, py, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0e7c7b';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#cfe3ff';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SOLMAR BAY', x0, y0 + size + 8);
}

// ---- Menus ----

function menuBackdrop(ctx, W, H) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0b1020');
  grad.addColorStop(0.6, '#274b5e');
  grad.addColorStop(1, '#c96f2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

export function drawTitle(ctx, W, H, hasSave, missionIndex) {
  menuBackdrop(ctx, W, H);
  // Sun.
  ctx.fillStyle = '#ffcf5e';
  ctx.beginPath();
  ctx.arc(W * 0.78, H * 0.3, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,207,94,0.25)';
  ctx.beginPath();
  ctx.arc(W * 0.78, H * 0.3, 110, 0, Math.PI * 2);
  ctx.fill();
  // Skyline silhouette.
  ctx.fillStyle = '#101826';
  let x = 0;
  const heights = [120, 200, 150, 260, 180, 230, 140, 300, 170, 210, 130];
  heights.forEach((h, i) => {
    const bw = W / heights.length;
    ctx.fillRect(x, H - 220 - h * 0.4, bw - 6, 220 + h * 0.4);
    x += bw;
  });
  ctx.fillStyle = '#0a0f1a';
  ctx.fillRect(0, H - 60, W, 60);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('SOLMAR BAY', W / 2, H * 0.3);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('An open-world crime story', W / 2, H * 0.3 + 34);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = '#cfe3ff';
  ctx.fillText('Milo Reyes is back in town — and the town has not forgiven him.', W / 2, H * 0.3 + 62);
  ctx.textAlign = 'left';
  const bx = W / 2 - 150;
  const by = H * 0.52;
  panel(ctx, bx - 60, by - 30, 420, hasSave ? 150 : 116, 0.7);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText('▶  NEW GAME', bx - 40, by);
  if (hasSave) {
    ctx.fillText('▶  CONTINUE  (mission ' + (missionIndex + 1) + ' of 5)', bx - 40, by + 34);
  }
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = '#cfe3ff';
  ctx.fillText('Click or press Enter to start', bx - 40, by + (hasSave ? 76 : 42));
  ctx.fillText('WASD move/drive • E enter car • Mouse aim • Click shoot', bx - 40, by + (hasSave ? 104 : 70));
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('A 100% original game. Solmar Bay, Milo Reyes and Rosa Vega are invented — no Rockstar content.', W / 2, H - 18);
  ctx.textAlign = 'left';
}

export function drawPause(ctx, W, H, G) {
  ctx.fillStyle = 'rgba(5,8,14,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillText('PAUSED', W / 2, H * 0.3);
  ctx.fillStyle = '#fff';
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('Esc resume  •  S save game  •  M mission log  •  Q quit to title', W / 2, H * 0.3 + 36);
  ctx.fillText('Cash ' + money(G.player.cash) + '   •   Missions done ' + G.missions.done.length + ' / 5', W / 2, H * 0.3 + 66);
  ctx.textAlign = 'left';
}

export function drawMissionLog(ctx, W, H, G) {
  ctx.fillStyle = 'rgba(5,8,14,0.8)';
  ctx.fillRect(0, 0, W, H);
  const bw = Math.min(680, W - 80);
  const bx = (W - bw) / 2;
  panel(ctx, bx, 60, bw, H - 160, 0.9);
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('MISSION LOG — MILO REYES', bx + 24, 104);
  ctx.font = '15px system-ui, sans-serif';
  let y = 140;
  MISSIONS.forEach((m, i) => {
    const done = G.missions.done.includes(m.id);
    const active = G.missions.active && G.missions.active.def.id === m.id;
    const next = i === G.missions.index && !G.missions.active;
    ctx.fillStyle = done ? '#4ade80' : active ? '#ffd34d' : next ? '#9fd8ff' : '#8a8f96';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText((done ? '✓ ' : active ? '▶ ' : '· ') + (i + 1) + '. ' + m.name + ' — ' + m.giver + ' — ' + money(m.reward), bx + 24, y);
    ctx.fillStyle = '#dfe6ee';
    ctx.font = '14px system-ui, sans-serif';
    wrapText(ctx, m.brief, bx + 44, y + 20, bw - 88, 18);
    y += 76;
  });
  ctx.fillStyle = '#cfe3ff';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('Press M or Esc to close.', bx + 24, H - 120);
  ctx.textAlign = 'left';
}

export function drawGameOver(ctx, W, H, reason) {
  ctx.fillStyle = 'rgba(20,4,6,0.82)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff6b6b';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText('WASTED', W / 2, H * 0.38);
  ctx.fillStyle = '#fff';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText(reason, W / 2, H * 0.38 + 36);
  ctx.fillStyle = '#cfe3ff';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Milo wakes up at Solmar General Hospital, $200 lighter.', W / 2, H * 0.38 + 66);
  ctx.fillText('Press Enter to get back on your feet.', W / 2, H * 0.38 + 96);
  ctx.textAlign = 'left';
}
