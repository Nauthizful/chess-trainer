import type { LichessExplorerResponse } from '../types';

const PUBLIC_LICHESS_EXPLORER_URL = 'https://explorer.lichess.ovh/lichess';
const MAX_CACHE_ENTRIES = 200;

const explorerCache = new Map<string, LichessExplorerResponse>();
const pendingRequests = new Map<string, Promise<LichessExplorerResponse>>();

function normalizeFenKey(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

export async function fetchPublicLichessCandidates(
  fen: string,
  signal?: AbortSignal
): Promise<LichessExplorerResponse> {
  const key = normalizeFenKey(fen);
  const cached = explorerCache.get(key);
  if (cached) {
    return cached;
  }

  const existingPending = pendingRequests.get(key);
  if (existingPending) {
    return existingPending;
  }

  const params = new URLSearchParams({
    variant: 'standard',
    speeds: 'blitz,rapid,classical',
    ratings: '1000,1200,1400',
    moves: '5',
    topGames: '0',
    recentGames: '0',
    fen,
  });

  const url = `${PUBLIC_LICHESS_EXPLORER_URL}?${params.toString()}`;

  const promise = fetch(url, { method: 'GET', signal })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Erreur Lichess Explorer (${res.status})`);
      }
      const data = (await res.json()) as LichessExplorerResponse;
      if (explorerCache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = explorerCache.keys().next().value;
        if (oldestKey) explorerCache.delete(oldestKey);
      }
      explorerCache.set(key, data);
      return data;
    })
    .finally(() => {
      pendingRequests.delete(key);
    });

  pendingRequests.set(key, promise);
  return promise;
}
