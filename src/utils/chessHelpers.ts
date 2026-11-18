import { Chess, type PieceSymbol } from 'chess.js';
import type { PlayerColor, SquarePair } from '../types';

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;

export const INITIAL_FEN = new Chess().fen();

export function squareToCoords(
  square: string,
  orientation: PlayerColor
): { x: number; y: number } {
  const fileIndex = FILES.indexOf(square[0] as (typeof FILES)[number]);
  const rankNum = parseInt(square[1], 10);
  const rankIndex = 8 - rankNum; // 0 for rank 8, 7 for rank 1

  const col = orientation === 'w' ? fileIndex : 7 - fileIndex;
  const row = orientation === 'w' ? rankIndex : 7 - rankIndex;

  return {
    x: col * 100 + 50,
    y: row * 100 + 50,
  };
}

export function parseUci(
  uci: string | null | undefined
): { from: string; to: string; promotion?: string } | null {
  if (!uci) return null;
  const clean = uci.trim().toLowerCase();
  if (clean.length < 4) return null;
  return {
    from: clean.slice(0, 2),
    to: clean.slice(2, 4),
    promotion: clean.length > 4 ? clean[4] : undefined,
  };
}

export function replaySanMoves(movesSan: string[]): {
  fen: string;
  lastMove: SquarePair | null;
  moves: string[];
} {
  const chess = new Chess();
  let lastMove: SquarePair | null = null;
  const played: string[] = [];

  for (const san of movesSan) {
    try {
      const res = chess.move(san);
      if (!res) break;
      lastMove = { from: res.from, to: res.to };
      played.push(res.san);
    } catch {
      break;
    }
  }

  return {
    fen: chess.fen(),
    lastMove,
    moves: played,
  };
}

const STARTING_COUNTS: Record<Exclude<PieceSymbol, 'k'>, number> = {
  q: 1,
  r: 2,
  b: 2,
  n: 2,
  p: 8,
};

const CAPTURE_ORDER: Array<Exclude<PieceSymbol, 'k'>> = ['q', 'r', 'b', 'n', 'p'];

const PIECE_VALUES: Record<Exclude<PieceSymbol, 'k'>, number> = {
  q: 9,
  r: 5,
  b: 3,
  n: 3,
  p: 1,
};

export interface MaterialSummary {
  capturedByWhite: Array<Exclude<PieceSymbol, 'k'>>;
  capturedByBlack: Array<Exclude<PieceSymbol, 'k'>>;
  whiteAdvantage: number;
}

export function computeMaterialAndCaptures(fen: string): MaterialSummary {
  const chess = new Chess(fen);
  const matrix = chess.board();

  const onBoard: Record<PlayerColor, Record<Exclude<PieceSymbol, 'k'>, number>> = {
    w: { q: 0, r: 0, b: 0, n: 0, p: 0 },
    b: { q: 0, r: 0, b: 0, n: 0, p: 0 },
  };

  let whiteMat = 0;
  let blackMat = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = matrix[r][c];
      if (!piece || piece.type === 'k') continue;
      onBoard[piece.color][piece.type] += 1;
      const val = PIECE_VALUES[piece.type];
      if (piece.color === 'w') whiteMat += val;
      else blackMat += val;
    }
  }

  const capturedByWhite: Array<Exclude<PieceSymbol, 'k'>> = [];
  const capturedByBlack: Array<Exclude<PieceSymbol, 'k'>> = [];

  for (const type of CAPTURE_ORDER) {
    const missingBlack = Math.max(0, STARTING_COUNTS[type] - onBoard.b[type]);
    for (let i = 0; i < missingBlack; i++) capturedByWhite.push(type);

    const missingWhite = Math.max(0, STARTING_COUNTS[type] - onBoard.w[type]);
    for (let i = 0; i < missingWhite; i++) capturedByBlack.push(type);
  }

  return {
    capturedByWhite,
    capturedByBlack,
    whiteAdvantage: whiteMat - blackMat,
  };
}
