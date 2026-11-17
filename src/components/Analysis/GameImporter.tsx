import React, { useEffect, useState } from 'react';
import { FileText, Loader2, Search, Sparkles, User, UserCheck } from 'lucide-react';
import type { ImportedGameMeta, PlayerColor } from '../../types';

const MY_USERNAME_STORAGE_KEY = 'chess-trainer-my-username';
const DEFAULT_MY_USERNAME = 'NInow_Ninow';

const SAMPLE_PGN = `[Event "Partie d'exemple tactique"]
[Site "Local"]
[White "NInow_Ninow"]
[Black "Adversaire"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Bd2 Bxd2+ 8. Nbxd2 d5 9. exd5 Nxd5 10. Qb3 Na5 11. Qa4+ Nc6 12. Ne5 O-O 13. Nxc6 bxc6 14. Qxc6 Qe7+ 15. Kf1 Nb6 16. Re1 Qd8 17. Bb3 Qxd4 18. Bxf7+ Kxf7 19. Qxc7+ Kg8 20. Re7 Qd3+ 21. Kg1 Qg6 1-0`;

export function getStoredMyUsername(): string {
  try {
    return localStorage.getItem(MY_USERNAME_STORAGE_KEY) ?? DEFAULT_MY_USERNAME;
  } catch {
    return DEFAULT_MY_USERNAME;
  }
}

export function extractPgnPlayers(pgn: string): {
  white: string | null;
  black: string | null;
} {
  const whiteMatch = /\[White\s+"([^"]+)"\]/i.exec(pgn);
  const blackMatch = /\[Black\s+"([^"]+)"\]/i.exec(pgn);
  return {
    white: whiteMatch ? whiteMatch[1].trim() : null,
    black: blackMatch ? blackMatch[1].trim() : null,
  };
}

interface LichessNdjsonGame {
  id?: string;
  speed?: string;
  createdAt?: number;
  winner?: 'white' | 'black';
  status?: string;
  pgn?: string;
  players?: {
    white?: { user?: { name?: string }; rating?: number };
    black?: { user?: { name?: string }; rating?: number };
  };
}

export interface ImportGameMetadata {
  title?: string;
  whiteName?: string;
  blackName?: string;
  detectedUserSide?: PlayerColor | null;
}

interface GameImporterProps {
  isAnalyzing: boolean;
  myUsername: string;
  onChangeMyUsername: (name: string) => void;
  onImportGame: (
    pgn: string,
    userColor: PlayerColor,
    meta?: ImportGameMetadata
  ) => void;
}

export const GameImporter: React.FC<GameImporterProps> = ({
  isAnalyzing,
  myUsername,
  onChangeMyUsername,
  onImportGame,
}) => {
  const [importTab, setImportTab] = useState<'lichess' | 'pgn'>('lichess');
  const [username, setUsername] = useState('');
  const [isLoadingLichess, setIsLoadingLichess] = useState(false);
  const [lichessError, setLichessError] = useState<string | null>(null);
  const [lichessGames, setLichessGames] = useState<ImportedGameMeta[]>([]);

  const [pgnText, setPgnText] = useState('');
  const [pgnColor, setPgnColor] = useState<PlayerColor>('w');
  const [pgnAutoDetected, setPgnAutoDetected] = useState<PlayerColor | null>(null);

  // Auto-detect player side whenever PGN text or myUsername changes
  useEffect(() => {
    const cleanMy = myUsername.trim().toLowerCase();
    if (!cleanMy || !pgnText.trim()) {
      setPgnAutoDetected(null);
      return;
    }
    const { white, black } = extractPgnPlayers(pgnText);
    if (white && white.toLowerCase() === cleanMy) {
      setPgnColor('w');
      setPgnAutoDetected('w');
    } else if (black && black.toLowerCase() === cleanMy) {
      setPgnColor('b');
      setPgnAutoDetected('b');
    } else {
      setPgnAutoDetected(null);
    }
  }, [pgnText, myUsername]);

  const handleFetchLichessGames = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim();
    if (!cleanUser) return;

    setIsLoadingLichess(true);
    setLichessError(null);

    try {
      const url = `https://lichess.org/api/games/user/${encodeURIComponent(
        cleanUser
      )}?max=10&pgnInJson=true`;

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/x-ndjson',
        },
      });

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(`Joueur « ${cleanUser} » introuvable sur Lichess.`);
        }
        throw new Error(`Erreur API Lichess (${res.status}).`);
      }

      const text = await res.text();
      const lines = text
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      const parsed: ImportedGameMeta[] = [];
      for (const line of lines) {
        try {
          const g = JSON.parse(line) as LichessNdjsonGame;
          if (!g.pgn) continue;
          const wName = g.players?.white?.user?.name ?? 'Blancs';
          const bName = g.players?.black?.user?.name ?? 'Noirs';
          const userColor: PlayerColor =
            bName.toLowerCase() === cleanUser.toLowerCase() ? 'b' : 'w';
          const result =
            g.winner === 'white'
              ? '1-0'
              : g.winner === 'black'
              ? '0-1'
              : '½-½';
          const dateStr = g.createdAt
            ? new Date(g.createdAt).toLocaleDateString('fr-FR')
            : undefined;

          parsed.push({
            id: g.id ?? `${Date.now()}-${parsed.length}`,
            whiteName: wName,
            blackName: bName,
            whiteRating: g.players?.white?.rating,
            blackRating: g.players?.black?.rating,
            result,
            speed: g.speed,
            date: dateStr,
            pgn: g.pgn,
            userColor,
          });
        } catch {
          // Ignore malformed NDJSON line
        }
      }

      if (parsed.length === 0) {
        setLichessError('Aucune partie récente trouvée pour ce pseudo.');
      }
      setLichessGames(parsed);
    } catch (err) {
      setLichessError(
        err instanceof Error
          ? err.message
          : 'Impossible de récupérer les parties Lichess.'
      );
    } finally {
      setIsLoadingLichess(false);
    }
  };

  const handleAnalyzePgn = () => {
    const clean = pgnText.trim();
    if (!clean) return;
    const { white, black } = extractPgnPlayers(clean);
    const cleanMy = myUsername.trim().toLowerCase();
    let finalColor = pgnColor;
    let detectedUserSide: PlayerColor | null = null;

    if (cleanMy) {
      if (white && white.toLowerCase() === cleanMy) {
        finalColor = 'w';
        detectedUserSide = 'w';
      } else if (black && black.toLowerCase() === cleanMy) {
        finalColor = 'b';
        detectedUserSide = 'b';
      }
    }

    onImportGame(clean, finalColor, {
      title:
        white && black ? `${white} vs ${black}` : 'Partie PGN importée',
      whiteName: white ?? 'Blancs',
      blackName: black ?? 'Noirs',
      detectedUserSide,
    });
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4">
      {/* My Username (for auto-detection in PGN) */}
      <div className="space-y-1.5 pb-3 border-b border-slate-800">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-emerald-400" />
          Mon pseudo (Chess.com / Lichess)
        </label>
        <input
          type="text"
          value={myUsername}
          onChange={(e) => onChangeMyUsername(e.target.value)}
          placeholder="Ex: NInow_Ninow"
          className="w-full px-2.5 py-1.5 text-xs bg-slate-950/70 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-950/70 border border-slate-800">
        <button
          type="button"
          onClick={() => setImportTab('lichess')}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all ${
            importTab === 'lichess'
              ? 'bg-blue-500/20 text-blue-200 border border-blue-500/40'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          Pseudo Lichess
        </button>
        <button
          type="button"
          onClick={() => setImportTab('pgn')}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all ${
            importTab === 'pgn'
              ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Coller un PGN
        </button>
      </div>

      {importTab === 'lichess' ? (
        <div className="space-y-3">
          <form onSubmit={handleFetchLichessGames} className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Pseudo Lichess (ex: DrNykterstein)"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-950/70 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={isLoadingLichess || !username.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500 hover:bg-blue-400 disabled:opacity-45 text-slate-950 transition-colors shrink-0 flex items-center gap-1.5"
            >
              {isLoadingLichess && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Charger
            </button>
          </form>

          {lichessError && (
            <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/35 rounded-lg px-2.5 py-2">
              {lichessError}
            </p>
          )}

          {lichessGames.length > 0 && (
            <div className="max-h-60 overflow-y-auto rounded-xl bg-slate-950/60 border border-slate-800 divide-y divide-slate-800/70">
              {lichessGames.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  disabled={isAnalyzing}
                  onClick={() =>
                    onImportGame(g.pgn, g.userColor, {
                      title: `${g.whiteName} vs ${g.blackName}`,
                      whiteName: g.whiteName,
                      blackName: g.blackName,
                      detectedUserSide: g.userColor,
                    })
                  }
                  className="w-full text-left px-3 py-2 hover:bg-slate-800/80 disabled:opacity-50 transition-colors space-y-0.5"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-100 truncate">
                      {g.whiteName}
                      {g.whiteRating ? ` (${g.whiteRating})` : ''} vs {g.blackName}
                      {g.blackRating ? ` (${g.blackRating})` : ''}
                    </span>
                    <span className="font-mono font-bold text-amber-300 shrink-0">
                      {g.result}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="capitalize">
                      {g.speed ?? 'Standard'} • Vous :{' '}
                      {g.userColor === 'w' ? 'Blancs' : 'Noirs'}
                    </span>
                    <span>{g.date ?? ''}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <textarea
            rows={5}
            value={pgnText}
            onChange={(e) => setPgnText(e.target.value)}
            placeholder="Collez votre PGN ici (Lichess, Chess.com, etc.)..."
            className="w-full px-3 py-2 text-xs font-mono bg-slate-950/70 border border-slate-700 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 resize-y"
          />

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-400">
              Votre camp{' '}
              {pgnAutoDetected && (
                <span className="text-[10px] text-emerald-400 font-semibold">
                  (détecté)
                </span>
              )}{' '}
              :
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setPgnColor('w')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                  pgnColor === 'w'
                    ? 'bg-slate-100 text-slate-950 border-white'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                Blancs
              </button>
              <button
                type="button"
                onClick={() => setPgnColor('b')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                  pgnColor === 'b'
                    ? 'bg-slate-800 text-white border-emerald-400'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700'
                }`}
              >
                Noirs
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isAnalyzing || !pgnText.trim()}
              onClick={handleAnalyzePgn}
              className="py-2 px-3 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 disabled:opacity-45 text-slate-950 transition-colors"
            >
              Analyser ce PGN
            </button>
            <button
              type="button"
              disabled={isAnalyzing}
              onClick={() => {
                setPgnText(SAMPLE_PGN);
                onImportGame(SAMPLE_PGN, 'w', {
                  title: `${myUsername || 'NInow_Ninow'} vs Adversaire`,
                  whiteName: myUsername || 'NInow_Ninow',
                  blackName: 'Adversaire',
                  detectedUserSide: 'w',
                });
              }}
              className="py-2 px-3 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-45 text-slate-200 border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Exemple
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
