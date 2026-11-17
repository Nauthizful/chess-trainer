import lichessOpeningsRaw from './lichessOpenings.json';
import type {
  Opening,
  OpeningCategory,
  OpeningFamily,
  PlayerColor,
} from '../types';

function inferCategory(eco: string): OpeningCategory {
  const prefix = eco.charAt(0).toUpperCase();
  switch (prefix) {
    case 'A':
      return 'Flanc (A)';
    case 'B':
      return 'Semi-Ouverte (B)';
    case 'C':
      return 'Ouverte (C)';
    case 'D':
      return 'Fermée (D)';
    case 'E':
    default:
      return 'Indienne (E)';
  }
}

function parsePgnMoves(pgn: string): string[] {
  return pgn
    .replace(/\d+\.(\.\.)?/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function splitOpeningName(name: string): {
  familyName: string;
  variationName: string | null;
} {
  const colonIdx = name.indexOf(':');
  if (colonIdx === -1) {
    return { familyName: name.trim(), variationName: null };
  }
  const familyName = name.slice(0, colonIdx).trim();
  const variationName = name.slice(colonIdx + 1).trim() || null;
  return { familyName, variationName };
}

interface RawLichessOpening {
  id: string;
  eco: string;
  name: string;
  pgn: string;
  uci: string;
  playedBy: PlayerColor;
}

const rawList = lichessOpeningsRaw as RawLichessOpening[];

export const OPENINGS: Opening[] = rawList.map((item) => {
  const moves = parsePgnMoves(item.pgn);
  const { familyName, variationName } = splitOpeningName(item.name);
  return {
    id: item.id,
    eco: item.eco,
    name: item.name,
    familyName,
    variationName,
    pgn: item.pgn,
    uci: item.uci,
    moves,
    movesKey: moves.join(' '),
    description: `${item.eco} — ${item.name} (${moves.length} demi-coups théoriques).`,
    category: inferCategory(item.eco),
    playedBy: item.playedBy,
  };
});

// Group openings by (familyName + playedBy)
const familyGroupMap = new Map<string, Opening[]>();
for (const opening of OPENINGS) {
  const key = `${opening.familyName}::${opening.playedBy}`;
  const existing = familyGroupMap.get(key);
  if (existing) {
    existing.push(opening);
  } else {
    familyGroupMap.set(key, [opening]);
  }
}

export const OPENING_FAMILIES: OpeningFamily[] = Array.from(
  familyGroupMap.entries()
).map(([id, openings]) => {
  const sortedByLen = [...openings].sort(
    (a, b) => a.moves.length - b.moves.length
  );
  const ecos = Array.from(new Set(openings.map((o) => o.eco))).sort();
  const ecoRange =
    ecos.length === 1 ? ecos[0] : `${ecos[0]}–${ecos[ecos.length - 1]}`;

  return {
    id,
    familyName: openings[0].familyName,
    playedBy: openings[0].playedBy,
    ecoRange,
    openings,
    representativeOpening: sortedByLen[0],
    variantCount: openings.length,
  };
});

/**
 * Filter grouped opening families by camp and text query (matches family name, sub-variations, ECO, or PGN).
 */
export function filterOpeningFamilies(options: {
  query?: string;
  playedBy?: 'all' | PlayerColor;
}): OpeningFamily[] {
  const { query = '', playedBy = 'all' } = options;
  const q = query.trim().toLowerCase();

  return OPENING_FAMILIES.filter((family) => {
    if (playedBy !== 'all' && family.playedBy !== playedBy) return false;
    if (!q) return true;

    if (
      family.familyName.toLowerCase().includes(q) ||
      family.ecoRange.toLowerCase().includes(q)
    ) {
      return true;
    }

    return family.openings.some(
      (o) =>
        o.eco.toLowerCase().includes(q) ||
        o.name.toLowerCase().includes(q) ||
        o.pgn.toLowerCase().includes(q)
    );
  });
}

/**
 * Instant prefix & text filter over the indexed 3,865+ Lichess ECO openings.
 */
export function filterOpenings(options: {
  movesPrefix?: string[];
  query?: string;
  playedBy?: 'all' | PlayerColor;
  category?: 'Toutes' | OpeningCategory;
}): Opening[] {
  const {
    movesPrefix = [],
    query = '',
    playedBy = 'all',
    category = 'Toutes',
  } = options;

  const prefixLen = movesPrefix.length;
  const prefixKey = prefixLen > 0 ? movesPrefix.join(' ') : '';
  const q = query.trim().toLowerCase();

  return OPENINGS.filter((opening) => {
    if (playedBy !== 'all' && opening.playedBy !== playedBy) return false;
    if (category !== 'Toutes' && opening.category !== category) return false;

    if (prefixLen > 0) {
      if (opening.moves.length < prefixLen) return false;
      const key = opening.movesKey ?? opening.moves.join(' ');
      if (key !== prefixKey && !key.startsWith(`${prefixKey} `)) {
        return false;
      }
    }

    if (q) {
      return (
        opening.eco.toLowerCase().includes(q) ||
        opening.name.toLowerCase().includes(q) ||
        opening.pgn.toLowerCase().includes(q)
      );
    }

    return true;
  });
}
