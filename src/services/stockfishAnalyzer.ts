import { Chess, type PieceSymbol } from 'chess.js';
import { OPENINGS } from '../data/openings';
import type {
  AnalyzedMove,
  MoveClassification,
  PositionEval,
} from '../types';
import {
  generateTacticalExplanation,
  toFrenchSan,
  uciToMove,
} from '../utils/tacticalExplainer';

let ecoBookPrefixMap: Map<string, { eco: string; name: string }> | null = null;

function getEcoBookPrefixMap(): Map<string, { eco: string; name: string }> {
  if (ecoBookPrefixMap) return ecoBookPrefixMap;
  const map = new Map<string, { eco: string; name: string }>();
  const sorted = [...OPENINGS].sort((a, b) => a.moves.length - b.moves.length);

  for (const op of sorted) {
    const limit = Math.min(12, op.moves.length);
    for (let k = 1; k <= limit; k++) {
      const key = op.moves.slice(0, k).join(' ');
      if (k === op.moves.length || !map.has(key)) {
        map.set(key, { eco: op.eco, name: op.name });
      }
    }
  }

  ecoBookPrefixMap = map;
  return map;
}

const PIECE_CP: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

/**
 * Lichess / WintrChess Win% formula from centipawns (White's perspective).
 */
export function cpToWhiteWinPct(whiteCp: number): number {
  const clamped = Math.max(-4000, Math.min(4000, whiteCp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamped)) - 1);
}

export function formatEvalScore(cp: number, mate: number | null): string {
  if (mate !== null) {
    return mate > 0 ? `#${mate}` : `-#${Math.abs(mate)}`;
  }
  const pawns = cp / 100;
  if (Math.abs(pawns) < 0.05) return '0.0';
  return pawns > 0 ? `+${pawns.toFixed(1)}` : pawns.toFixed(1);
}

function heuristicEvalFallback(fen: string): PositionEval {
  const chess = new Chess(fen);
  if (chess.isCheckmate()) {
    const whiteWins = chess.turn() === 'b';
    return {
      fen,
      cp: whiteWins ? 10000 : -10000,
      mate: whiteWins ? 0 : 0,
      whiteWinPct: whiteWins ? 100 : 0,
      bestMoveUci: null,
      bestMoveSan: null,
      pvUci: [],
    };
  }
  if (chess.isDraw()) {
    return {
      fen,
      cp: 0,
      mate: null,
      whiteWinPct: 50,
      bestMoveUci: null,
      bestMoveSan: null,
      pvUci: [],
    };
  }

  let balance = 0;
  const matrix = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = matrix[r][f];
      if (!piece) continue;
      const val = PIECE_CP[piece.type];
      balance += piece.color === 'w' ? val : -val;
    }
  }
  const legal = chess.moves({ verbose: true });
  const first = legal[0];
  const bestMoveUci = first
    ? `${first.from}${first.to}${first.promotion ?? ''}`
    : null;

  return {
    fen,
    cp: balance,
    mate: null,
    whiteWinPct: cpToWhiteWinPct(balance),
    bestMoveUci,
    bestMoveSan: first?.san ?? null,
    pvUci: bestMoveUci ? [bestMoveUci] : [],
  };
}

class StockfishWorkerEngine {
  private worker: Worker | null = null;
  private isReady = false;
  private messageQueue: Array<(line: string) => void> = [];

  async init(): Promise<boolean> {
    if (this.worker && this.isReady) return true;

    const candidates = [
      '/stockfish/stockfish.wasm.js',
      '/stockfish/stockfish.js',
    ];

    for (const url of candidates) {
      const ok = await this.tryBootWorker(url);
      if (ok) return true;
    }
    return false;
  }

  private tryBootWorker(scriptUrl: string): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        if (!ok && this.worker) {
          this.worker.terminate();
          this.worker = null;
        }
        resolve(ok);
      };

      const timeout = setTimeout(() => finish(false), 4000);

      try {
        const w = new Worker(scriptUrl);
        this.worker = w;
        this.isReady = false;

        w.onerror = () => {
          clearTimeout(timeout);
          finish(false);
        };

        w.onmessage = (e: MessageEvent<string>) => {
          const line = typeof e.data === 'string' ? e.data : String(e.data);
          if (line === 'uciok') {
            w.postMessage('isready');
          } else if (line === 'readyok') {
            clearTimeout(timeout);
            this.isReady = true;
            finish(true);
          }
          for (const listener of [...this.messageQueue]) {
            listener(line);
          }
        };

        w.postMessage('uci');
      } catch {
        clearTimeout(timeout);
        finish(false);
      }
    });
  }

  evaluateFen(fen: string, depth: number): Promise<PositionEval> {
    const chess = new Chess(fen);
    if (chess.isCheckmate()) {
      const whiteWins = chess.turn() === 'b';
      return Promise.resolve({
        fen,
        cp: whiteWins ? 10000 : -10000,
        mate: whiteWins ? 0 : 0,
        whiteWinPct: whiteWins ? 100 : 0,
        bestMoveUci: null,
        bestMoveSan: null,
        pvUci: [],
      });
    }
    if (chess.isDraw()) {
      return Promise.resolve({
        fen,
        cp: 0,
        mate: null,
        whiteWinPct: 50,
        bestMoveUci: null,
        bestMoveSan: null,
        pvUci: [],
      });
    }

    if (!this.worker || !this.isReady) {
      return Promise.resolve(heuristicEvalFallback(fen));
    }

    const turnSign = chess.turn() === 'w' ? 1 : -1;

    return new Promise((resolve) => {
      let latestCp = 0;
      let latestMate: number | null = null;
      let latestPv: string[] = [];
      let latestDepth = 0;
      let resolved = false;

      const cleanup = () => {
        this.messageQueue = this.messageQueue.filter((fn) => fn !== onLine);
      };

      const finish = (bestMoveUci: string | null) => {
        if (resolved) return;
        resolved = true;
        cleanup();

        const effectiveBestUci = bestMoveUci ?? latestPv[0] ?? null;
        let bestMoveSan: string | null = null;
        if (effectiveBestUci) {
          const tmp = new Chess(fen);
          const m = uciToMove(tmp, effectiveBestUci);
          bestMoveSan = m?.san ?? null;
        }

        const whiteCp =
          latestMate !== null
            ? latestMate > 0
              ? 10000
              : -10000
            : latestCp;

        const whiteWinPct =
          latestMate !== null
            ? latestMate > 0
              ? 100
              : 0
            : cpToWhiteWinPct(whiteCp);

        resolve({
          fen,
          cp: whiteCp,
          mate: latestMate,
          whiteWinPct,
          bestMoveUci: effectiveBestUci,
          bestMoveSan,
          pvUci:
            latestPv.length > 0
              ? latestPv.slice(0, 4)
              : effectiveBestUci
              ? [effectiveBestUci]
              : [],
        });
      };

      const timeout = setTimeout(() => {
        this.worker?.postMessage('stop');
        finish(latestPv[0] ?? null);
      }, 6500);

      const onLine = (line: string) => {
        if (line.startsWith('info ')) {
          const depthMatch = /\bdepth (\d+)/.exec(line);
          const curDepth = depthMatch ? parseInt(depthMatch[1], 10) : 0;
          if (curDepth >= latestDepth) {
            const scoreMatch = /\bscore (cp|mate) (-?\d+)/.exec(line);
            if (scoreMatch) {
              latestDepth = curDepth;
              const rawVal = parseInt(scoreMatch[2], 10) * turnSign;
              if (scoreMatch[1] === 'cp') {
                latestCp = rawVal;
                latestMate = null;
              } else {
                latestMate = rawVal;
                latestCp = rawVal > 0 ? 10000 : -10000;
              }
            }
            const pvMatch = /\bpv (.+)$/.exec(line);
            if (pvMatch) {
              latestPv = pvMatch[1].trim().split(/\s+/).filter(Boolean);
            }
          }
        } else if (line.startsWith('bestmove ')) {
          clearTimeout(timeout);
          const parts = line.split(/\s+/);
          const bm = parts[1] && parts[1] !== '(none)' ? parts[1] : null;
          finish(bm);
        }
      };

      this.messageQueue.push(onLine);
      this.worker!.postMessage(`position fen ${fen}`);
      this.worker!.postMessage(`go depth ${depth}`);
    });
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
    }
    this.messageQueue = [];
  }
}

export async function evaluateSingleFen(
  fen: string,
  depth = 12
): Promise<PositionEval> {
  const engine = new StockfishWorkerEngine();
  try {
    await engine.init();
    return await engine.evaluateFen(fen, depth);
  } finally {
    engine.terminate();
  }
}

export interface AnalyzeGameOptions {
  depth?: number;
  onProgress?: (completed: number, total: number) => void;
  signal?: AbortSignal;
}

export interface AnalyzedGameResult {
  moves: AnalyzedMove[];
  evals: PositionEval[];
  headers: Record<string, string>;
}

/**
 * Parses a PGN, runs Stockfish WASM in a Web Worker over every position,
 * classifies moves via Win% loss, and generates French Coach explanations.
 */
export async function analyzePgnGame(
  pgn: string,
  options: AnalyzeGameOptions = {}
): Promise<AnalyzedGameResult> {
  const depth = options.depth ?? 13;
  const chess = new Chess();
  chess.loadPgn(pgn);

  const headers = chess.getHeaders();
  const verboseMoves = chess.history({ verbose: true });

  if (verboseMoves.length === 0) {
    throw new Error('Aucun coup valide trouvé dans ce PGN.');
  }

  const replay = new Chess();
  const fens: string[] = [replay.fen()];
  for (const mv of verboseMoves) {
    replay.move(mv.san);
    fens.push(replay.fen());
  }

  const engine = new StockfishWorkerEngine();
  const evals: PositionEval[] = [];

  try {
    await engine.init();
    const total = fens.length;

    for (let i = 0; i < total; i++) {
      if (options.signal?.aborted) {
        throw new Error('Analyse annulée.');
      }
      const posEval = await engine.evaluateFen(fens[i], depth);
      evals.push(posEval);
      options.onProgress?.(i + 1, total);
    }
  } finally {
    engine.terminate();
  }

  const analyzedMoves: AnalyzedMove[] = [];
  const bookMap = getEcoBookPrefixMap();
  const movesSoFar: string[] = [];
  let prevOpponentBlundered = false;

  for (let i = 0; i < verboseMoves.length; i++) {
    const mv = verboseMoves[i];
    const evalBefore = evals[i];
    const evalAfter = evals[i + 1];
    const ply = i + 1;
    const moveNumber = Math.floor(i / 2) + 1;
    const uci = `${mv.from}${mv.to}${mv.promotion ?? ''}`;
    movesSoFar.push(mv.san);

    const winPctBefore =
      mv.color === 'w'
        ? evalBefore.whiteWinPct
        : 100 - evalBefore.whiteWinPct;
    const winPctAfter =
      mv.color === 'w'
        ? evalAfter.whiteWinPct
        : 100 - evalAfter.whiteWinPct;

    const winPctLoss = Math.max(0, winPctBefore - winPctAfter);

    const mateOffered =
      evalAfter.mate !== null &&
      ((mv.color === 'w' && evalAfter.mate < 0) ||
        (mv.color === 'b' && evalAfter.mate > 0)) &&
      !(
        evalBefore.mate !== null &&
        ((mv.color === 'w' && evalBefore.mate < 0) ||
          (mv.color === 'b' && evalBefore.mate > 0))
      );

    const bookOpening =
      ply <= 12 && !mateOffered
        ? bookMap.get(movesSoFar.join(' ')) ?? null
        : null;

    let classification: MoveClassification;
    if (bookOpening) {
      classification = 'book';
    } else if (
      prevOpponentBlundered &&
      winPctBefore >= 68 &&
      uci !== evalBefore.bestMoveUci &&
      winPctLoss > 13
    ) {
      classification = 'missed_win';
    } else if (mateOffered || winPctLoss > 22) {
      classification = 'blunder';
    } else if (winPctLoss > 13) {
      classification = 'mistake';
    } else if (winPctLoss > 7.5) {
      classification = 'inaccuracy';
    } else if (uci === evalBefore.bestMoveUci || winPctLoss <= 1.5) {
      classification = 'best';
    } else if (winPctLoss <= 3.5) {
      classification = 'excellent';
    } else {
      classification = 'good';
    }

    prevOpponentBlundered =
      classification === 'blunder' || classification === 'mistake';

    const showPunishment =
      classification === 'inaccuracy' ||
      classification === 'mistake' ||
      classification === 'blunder' ||
      classification === 'missed_win';

    const punishmentUci = showPunishment ? evalAfter.bestMoveUci : null;

    const coachExplanation = generateTacticalExplanation({
      ply,
      fenBefore: fens[i],
      fenAfter: fens[i + 1],
      playedSan: mv.san,
      playedFrom: mv.from,
      playedTo: mv.to,
      playedPiece: mv.piece,
      playedColor: mv.color,
      playedCaptured: mv.captured,
      evalBefore,
      evalAfter,
      winPctLoss,
      classification,
      bookOpening,
    });

    analyzedMoves.push({
      ply,
      moveNumber,
      color: mv.color,
      san: mv.san,
      frenchSan: toFrenchSan(mv.san),
      uci,
      from: mv.from,
      to: mv.to,
      fenBefore: fens[i],
      fenAfter: fens[i + 1],
      evalBefore,
      evalAfter,
      winPctBefore,
      winPctAfter,
      winPctLoss,
      classification,
      scoreLabel: formatEvalScore(evalAfter.cp, evalAfter.mate),
      bestMoveUci: evalBefore.bestMoveUci,
      punishmentUci,
      coachExplanation,
    });
  }

  return { moves: analyzedMoves, evals, headers };
}
