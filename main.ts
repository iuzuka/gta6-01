// Solmar Bay — the entry program (Node 22, standard library only).
//
// It hands the game in: it copies this repository's game/ and screenshots/
// beside this file into the output directory (MAKEFUN_OUTPUT_DIR, or
// /output in the grader) and writes /output/dossier.json, the summary the
// judge reads, using the vendored make.fun library. Nothing is installed,
// nothing is fetched, nothing is built — the game is plain static files.
// v2 (Nov 2026): eight missions, Solmar Arms gun shop (SMG + kevlar),
// twelve hidden stashes, the SBPD helicopter, night streetlights and
// headlight cones — the same entry program, the game got bigger.
//
// Run it locally to check the entry before submitting:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// v2 systems that must ship with the entry — fail fast if one is missing,
// rather than handing the judge a game with a broken shop or a missing heli.
for (const required of ['game/src/shop.js', 'game/src/collectibles.js']) {
  if (!existsSync(join(repoRoot, required))) {
    throw new Error(`Solmar Bay entry is missing ${required}`);
  }
}

// Start from a clean output directory so stale files never leak into an entry.
mkdirSync(outDir, { recursive: true });
rmSync(join(outDir, 'game'), { recursive: true, force: true });
rmSync(join(outDir, 'screenshots'), { recursive: true, force: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The scorer's own caps: only text_max_bytes shapes the dossier's bytes; the
// rest refuse an entry the scorer would refuse (more than 4 screenshots or
// one over 256 KiB; game/ over 993 entries or 48 MiB, or a path over 1000
// bytes — game/ counts beside /output's own 1000-entry cap).
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`Solmar Bay entry written to ${outDir}`);
