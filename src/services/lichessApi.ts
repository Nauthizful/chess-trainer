import type { DatabaseSource, LichessExplorerResponse } from '../types';

const ENDPOINTS: Record<DatabaseSource, string> = {
  masters: 'https://explorer.lichess.org/masters',
  lichess: 'https://explorer.lichess.org/lichess',
};

const TOKEN_STORAGE_KEY = 'chess-trainer-lichess-token';

const explorerCache = new Map<string, LichessExplorerResponse>();
const pendingRequests = new Map<string, Promise<LichessExplorerResponse>>();

export class LichessApiError extends Error {
  status: number | null;
  kind: 'auth_error' | 'offline';

  constructor(
    message: string,
    kind: 'auth_error' | 'offline',
    status: number | null = null
  ) {
    super(message);
    this.name = 'LichessApiError';
    this.kind = kind;
    this.status = status;
  }
}

export function getStoredLichessToken(): string {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setStoredLichessToken(token: string): void {
  try {
    const trimmed = token.trim();
    if (trimmed) {
      localStorage.setItem(TOKEN_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota / private mode errors
  }
}

function buildCacheKey(fen: string, source: DatabaseSource): string {
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
  source: DatabaseSource,
  token?: string
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
  const effectiveToken = (token ?? getStoredLichessToken()).trim();
  const headers: Record<string, string> = {};
  if (effectiveToken) {
    headers.Authorization = `Bearer ${effectiveToken}`;
  }

  const requestPromise = fetch(url, {
    method: 'GET',
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  })
    .then(async (response) => {
      if (!response.ok) {
        if (response.status === 401 || response.status === 403 || response.status === 429) {
          throw new LichessApiError(
            `Erreur ${response.status} - Token requis ou limite atteinte`,
            'auth_error',
            response.status
          );
        }
        throw new LichessApiError(
          `Erreur API Lichess (${response.status})`,
          'offline',
          response.status
        );
      }
      const data = (await response.json()) as LichessExplorerResponse;
      explorerCache.set(key, data);
      return data;
    })
    .catch((err) => {
      if (err instanceof LichessApiError) {
        throw err;
      }
      throw new LichessApiError(
        'Hors-ligne : impossible de joindre explorer.lichess.org',
        'offline',
        null
      );
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
 * Picks the most popular or weighted realistic move from Lichess Explorer.
 */
export function pickRealisticLichessMove(
  stats: LichessExplorerResponse | null,
  legalSanMoves: string[],
  preferMostPopular = false
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

  if (preferMostPopular) {
    return candidates[0].san;
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
