import type { DatabaseSource, LichessExplorerResponse } from '../types';

const ENDPOINTS: Record<DatabaseSource, string> = {
  masters: 'https://explorer.lichess.ovh/masters',
  lichess: 'https://explorer.lichess.ovh/lichess',
};

const explorerCache = new Map<string, LichessExplorerResponse>();
const pendingRequests = new Map<string, Promise<LichessExplorerResponse>>();

function buildCacheKey(fen: string, source: DatabaseSource): string {
  // Normalize FEN to board + turn + castling + en-passant (first 4 fields)
  // so transpositions or halfmove clock differences share cached explorer stats.
  const normalizedFen = fen.split(' ').slice(0, 4).join(' ');
  return `${source}::${normalizedFen}`;
}

function buildUrl(fen: string, source: DatabaseSource): string {
  const params = new URLSearchParams({
    fen,
    moves: '12',
    topGames: '0',
  });

  if (source === 'lichess') {
    params.set('ratings', '1000,1200,1400');
    params.set('speeds', 'blitz,rapid,classical');
  }

  return `${ENDPOINTS[source]}?${params.toString()}`;
}

export async function fetchExplorerStats(
  fen: string,
  source: DatabaseSource
): Promise<LichessExplorerResponse> {
  const key = buildCacheKey(fen, source);

  const cached = explorerCache.get(key);
  if (cached) {
    return cached;
  }

  const pending = pendingRequests.get(key);
  if (pending) {
    return pending;
  }

  const url = buildUrl(fen, source);

  // Simple GET request with no custom headers to avoid CORS preflight
  const requestPromise = fetch(url, { method: 'GET' })
    .then(async (response) => {
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Limite de requêtes Lichess atteinte (429). Veuillez patienter.');
        }
        throw new Error(`Erreur API Lichess (${response.status})`);
      }
      const data = (await response.json()) as LichessExplorerResponse;
      explorerCache.set(key, data);
      return data;
    })
    .finally(() => {
      pendingRequests.delete(key);
    });

  pendingRequests.set(key, requestPromise);
  return requestPromise;
}

export function getExplorerCacheSize(): number {
  return explorerCache.size;
}

export function clearExplorerCache(): void {
  explorerCache.clear();
}

export function getTotalGames(stats: {
  white: number;
  draws: number;
  black: number;
}): number {
  return stats.white + stats.draws + stats.black;
}

/**
 * Picks a realistic opponent move based on Lichess Explorer frequency.
 * Weighted random selection among the top 3 legal moves in the explorer response.
 */
export function pickRealisticLichessMove(
  stats: LichessExplorerResponse | null,
  legalSanMoves: string[]
): string | null {
  if (!stats || stats.moves.length === 0 || legalSanMoves.length === 0) {
    return null;
  }

  const legalSet = new Set(legalSanMoves);
  const candidates = stats.moves
    .filter((m) => legalSet.has(m.san))
    .map((m) => ({
      san: m.san,
      games: getTotalGames(m),
    }))
    .filter((m) => m.games > 0)
    .slice(0, 3);

  if (candidates.length === 0) {
    return null;
  }

  const totalWeight = candidates.reduce((acc, item) => acc + item.games, 0);
  let roll = Math.random() * totalWeight;

  for (const candidate of candidates) {
    roll -= candidate.games;
    if (roll <= 0) {
      return candidate.san;
    }
  }

  return candidates[0].san;
}
