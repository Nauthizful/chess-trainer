import fs from 'node:fs';
import path from 'node:path';
import { Chess } from 'chess.js';

const VOLUMES = ['a', 'b', 'c', 'd', 'e'];
const BASE_URL = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master';

async function fetchVolume(vol) {
  const url = `${BASE_URL}/${vol}.tsv`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  return res.text();
}

function parsePgnMoves(pgn) {
  return pgn
    .replace(/\d+\.(\.\.)?/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

async function main() {
  const openings = [];
  const seenIds = new Set();

  for (const vol of VOLUMES) {
    console.log(`Fetching ${vol}.tsv...`);
    const tsv = await fetchVolume(vol);
    const lines = tsv.split(/\r?\n/).filter(Boolean);

    // Skip header: eco\tname\tpgn
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split('\t');
      if (parts.length < 3) continue;
      const [eco, name, pgn] = parts.map((s) => s.trim());
      if (!eco || !name || !pgn) continue;

      const moves = parsePgnMoves(pgn);
      if (moves.length === 0) continue;

      const chess = new Chess();
      const uciParts = [];
      let valid = true;
      for (const mv of moves) {
        try {
          const res = chess.move(mv);
          uciParts.push(`${res.from}${res.to}${res.promotion ?? ''}`);
        } catch {
          valid = false;
          break;
        }
      }
      if (!valid) continue;

      // Odd number of plies -> last move was White ('w'); Even -> Black ('b')
      const playedBy = moves.length % 2 === 1 ? 'w' : 'b';

      let baseId = `${eco.toLowerCase()}-${name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')}`.slice(0, 64);
      let id = baseId;
      let suffix = 2;
      while (seenIds.has(id)) {
        id = `${baseId}-${suffix++}`;
      }
      seenIds.add(id);

      openings.push({
        id,
        eco,
        name,
        pgn,
        uci: uciParts.join(' '),
        playedBy,
      });
    }
  }

  const outPath = path.resolve('src/data/lichessOpenings.json');
  fs.writeFileSync(outPath, JSON.stringify(openings), 'utf8');
  console.log(`Wrote ${openings.length} openings to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
