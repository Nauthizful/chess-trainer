import { Chess, type Color, type PieceSymbol } from 'chess.js';
import type { MoveClassification, PositionEval } from '../types';
import { FILES, parseUci } from './chessHelpers';
import { formatMoveLabel } from './chessFormatting';

const PIECE_FR: Record<PieceSymbol, string> = {
  p: 'pion',
  n: 'cavalier',
  b: 'fou',
  r: 'tour',
  q: 'dame',
  k: 'roi',
};

const PIECE_VALUE: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 100,
};

export function pieceNameFr(piece: PieceSymbol): string {
  return PIECE_FR[piece];
}

export function uciToMove(
  chess: Chess,
  uci: string
): ReturnType<Chess['move']> | null {
  const parsed = parseUci(uci);
  if (!parsed) return null;
  try {
    return chess.move(parsed);
  } catch {
    return null;
  }
}

export function pvUciToSan(
  fen: string,
  pvUci: string[],
  startPly: number,
  maxPlies = 3
): string {
  if (!pvUci || pvUci.length === 0) return '';
  const board = new Chess(fen);
  const parts: string[] = [];

  for (let i = 0; i < Math.min(maxPlies, pvUci.length); i++) {
    const moveRes = uciToMove(board, pvUci[i]);
    if (!moveRes) break;
    const ply = startPly + i;
    if (i === 0 || moveRes.color === 'w') {
      parts.push(formatMoveLabel(moveRes.san, ply));
    } else {
      parts.push(moveRes.san);
    }
  }

  return parts.join(' ');
}

function sqToCoords(sq: string): { f: number; r: number } {
  return {
    f: FILES.indexOf(sq[0] as (typeof FILES)[number]),
    r: 8 - parseInt(sq[1], 10), // 0 = rank 8, 7 = rank 1
  };
}

function coordsToSq(f: number, r: number): string | null {
  if (f < 0 || f > 7 || r < 0 || r > 7) return null;
  return `${FILES[f]}${8 - r}`;
}

type BoardMatrix = ReturnType<Chess['board']>;

/**
 * Returns all squares of pieces of `byColor` attacking `targetSq` on `matrix`.
 */
function getAttackersOfSquare(
  matrix: BoardMatrix,
  targetSq: string,
  byColor: Color
): Array<{ sq: string; type: PieceSymbol }> {
  const { f: tf, r: tr } = sqToCoords(targetSq);
  const attackers: Array<{ sq: string; type: PieceSymbol }> = [];

  // 1. Pawns
  const pawnSourceRank = byColor === 'w' ? tr + 1 : tr - 1;
  for (const df of [-1, 1]) {
    const sf = tf + df;
    const sq = coordsToSq(sf, pawnSourceRank);
    if (sq) {
      const piece = matrix[pawnSourceRank][sf];
      if (piece && piece.color === byColor && piece.type === 'p') {
        attackers.push({ sq, type: 'p' });
      }
    }
  }

  // 2. Knights
  const knightOffsets = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1],
  ];
  for (const [df, dr] of knightOffsets) {
    const nf = tf + df;
    const nr = tr + dr;
    const sq = coordsToSq(nf, nr);
    if (sq) {
      const piece = matrix[nr][nf];
      if (piece && piece.color === byColor && piece.type === 'n') {
        attackers.push({ sq, type: 'n' });
      }
    }
  }

  // 3. Kings
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (df === 0 && dr === 0) continue;
      const kf = tf + df;
      const kr = tr + dr;
      const sq = coordsToSq(kf, kr);
      if (sq) {
        const piece = matrix[kr][kf];
        if (piece && piece.color === byColor && piece.type === 'k') {
          attackers.push({ sq, type: 'k' });
        }
      }
    }
  }

  // 4. Sliding pieces: Bishop/Queen diagonals & Rook/Queen orthogonals
  const diagDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  for (const [df, dr] of diagDirs) {
    let cf = tf + df;
    let cr = tr + dr;
    while (cf >= 0 && cf <= 7 && cr >= 0 && cr <= 7) {
      const piece = matrix[cr][cf];
      if (piece) {
        if (piece.color === byColor && (piece.type === 'b' || piece.type === 'q')) {
          attackers.push({ sq: coordsToSq(cf, cr)!, type: piece.type });
        }
        break;
      }
      cf += df;
      cr += dr;
    }
  }

  const orthoDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [df, dr] of orthoDirs) {
    let cf = tf + df;
    let cr = tr + dr;
    while (cf >= 0 && cf <= 7 && cr >= 0 && cr <= 7) {
      const piece = matrix[cr][cf];
      if (piece) {
        if (piece.color === byColor && (piece.type === 'r' || piece.type === 'q')) {
          attackers.push({ sq: coordsToSq(cf, cr)!, type: piece.type });
        }
        break;
      }
      cf += df;
      cr += dr;
    }
  }

  return attackers;
}

/**
 * Returns valuable enemy pieces attacked by the piece currently standing on `attackerSq`.
 */
function getValuableTargetsAttackedFrom(
  matrix: BoardMatrix,
  attackerSq: string,
  attackerColor: Color
): Array<{ sq: string; type: PieceSymbol }> {
  const victimColor: Color = attackerColor === 'w' ? 'b' : 'w';
  const targets: Array<{ sq: string; type: PieceSymbol }> = [];

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = matrix[r][f];
      if (!piece || piece.color !== victimColor || piece.type === 'p') continue;
      const sq = coordsToSq(f, r)!;
      const attackers = getAttackersOfSquare(matrix, sq, attackerColor);
      if (attackers.some((a) => a.sq === attackerSq)) {
        targets.push({ sq, type: piece.type });
      }
    }
  }

  return targets;
}

export interface TacticalExplainInput {
  ply: number;
  fenBefore: string;
  fenAfter: string;
  playedSan: string;
  playedFrom: string;
  playedTo: string;
  playedPiece: PieceSymbol;
  playedColor: Color;
  playedCaptured?: PieceSymbol;
  evalBefore: PositionEval;
  evalAfter: PositionEval;
  winPctLoss: number;
  classification: MoveClassification;
  bookOpening?: { eco: string; name: string } | null;
}

/**
 * Generates a deterministic French pedagogical explanation comparing the played move
 * against Stockfish's best move and principal variation.
 */
export function generateTacticalExplanation(input: TacticalExplainInput): string {
  const {
    ply,
    fenBefore,
    fenAfter,
    playedSan,
    playedTo,
    playedPiece,
    playedColor,
    playedCaptured,
    evalBefore,
    evalAfter,
    winPctLoss,
    classification,
    bookOpening,
  } = input;

  const frPlayed = playedSan;
  const opponentColor: Color = playedColor === 'w' ? 'b' : 'w';
  const reasons: string[] = [];

  if (classification === 'book') {
    if (bookOpening) {
      return `${frPlayed} est un coup théorique connu de l’ouverture (${bookOpening.eco} — ${bookOpening.name}).`;
    }
    return `${frPlayed} est un coup théorique standard de l’ouverture.`;
  }

  // Positive feedback for strong moves
  if (
    classification === 'best' ||
    classification === 'excellent' ||
    classification === 'good'
  ) {
    if (evalAfter.mate !== null) {
      const mateForMover =
        (playedColor === 'w' && evalAfter.mate > 0) ||
        (playedColor === 'b' && evalAfter.mate < 0);
      if (mateForMover) {
        const n = Math.abs(evalAfter.mate);
        reasons.push(
          `${frPlayed} force un mat imparable en ${n} coup${n > 1 ? 's' : ''}.`
        );
      }
    } else if (classification === 'best') {
      reasons.push(
        `${frPlayed} est le meilleur coup de la position et maintient un contrôle optimal.`
      );
    } else if (classification === 'excellent') {
      reasons.push(
        `${frPlayed} est un excellent coup très proche du choix optimal de Stockfish (${winPctLoss.toFixed(1)} % de perte).`
      );
    } else {
      reasons.push(
        `${frPlayed} est un coup solide qui maintient l’équilibre (${winPctLoss.toFixed(1)} % de perte de chances de gain).`
      );
    }

    const bestLine = pvUciToSan(fenBefore, evalBefore.pvUci, ply, 3);
    if (bestLine && classification !== 'best') {
      reasons.push(`Stockfish préférait légèrement : ${bestLine}.`);
    } else if (bestLine) {
      reasons.push(`Suite logique : ${bestLine}.`);
    }
    return reasons.join(' ');
  }

  // Rule 1: Forced Mate detection (mate offered or mate missed)
  const mateAgainstMoverAfter =
    evalAfter.mate !== null &&
    ((playedColor === 'w' && evalAfter.mate < 0) ||
      (playedColor === 'b' && evalAfter.mate > 0));
  const mateForMoverBefore =
    evalBefore.mate !== null &&
    ((playedColor === 'w' && evalBefore.mate > 0) ||
      (playedColor === 'b' && evalBefore.mate < 0));
  const mateForMoverAfter =
    evalAfter.mate !== null &&
    ((playedColor === 'w' && evalAfter.mate > 0) ||
      (playedColor === 'b' && evalAfter.mate < 0));

  if (mateAgainstMoverAfter && evalAfter.mate !== null) {
    const n = Math.abs(evalAfter.mate);
    reasons.push(
      `Attention : ${frPlayed} permet un mat forcé adverse en ${n} coup${n > 1 ? 's' : ''}.`
    );
  } else if (mateForMoverBefore && !mateForMoverAfter && evalBefore.mate !== null) {
    const n = Math.abs(evalBefore.mate);
    reasons.push(
      `${frPlayed} laisse échapper un mat forcé en ${n} coup${n > 1 ? 's' : ''}.`
    );
  }

  // Simulate opponent's direct reply from fenAfter
  const boardAfter = new Chess(fenAfter);
  const boardAfterMatrix = boardAfter.board();
  const oppReply = evalAfter.bestMoveUci
    ? uciToMove(boardAfter, evalAfter.bestMoveUci)
    : null;

  // Rule 2: Piece left hanging / en prise
  if (oppReply && oppReply.captured) {
    const defenders = getAttackersOfSquare(
      boardAfterMatrix,
      oppReply.to,
      playedColor
    );
    const attackerVal = PIECE_VALUE[oppReply.piece];
    const victimVal = PIECE_VALUE[oppReply.captured];
    const targetName = pieceNameFr(oppReply.captured);
    const oppPieceName = pieceNameFr(oppReply.piece);

    if (defenders.length === 0) {
      reasons.push(
        `Votre ${targetName} en ${oppReply.to} est laissé sans défense et peut être capturé gratuitement par ${oppReply.san}.`
      );
    } else if (victimVal > attackerVal) {
      reasons.push(
        `Votre ${targetName} en ${oppReply.to} se retrouve en prise face à une pièce de moindre valeur (${oppPieceName}) après ${oppReply.san}.`
      );
    }
  } else {
    // Also check directly if the moved piece itself stands attacked by a lesser piece or undefended
    const attackersOnMoved = getAttackersOfSquare(
      boardAfterMatrix,
      playedTo,
      opponentColor
    );
    if (attackersOnMoved.length > 0 && playedPiece !== 'p') {
      const defendersOnMoved = getAttackersOfSquare(
        boardAfterMatrix,
        playedTo,
        playedColor
      );
      const lesserAttacker = attackersOnMoved.find(
        (a) => PIECE_VALUE[a.type] < PIECE_VALUE[playedPiece]
      );
      if (lesserAttacker) {
        reasons.push(
          `Votre ${pieceNameFr(playedPiece)} en ${playedTo} est exposé à l’attaque d’un ${pieceNameFr(lesserAttacker.type)} adverse en ${lesserAttacker.sq}.`
        );
      } else if (defendersOnMoved.length === 0 && !playedCaptured) {
        reasons.push(
          `Votre ${pieceNameFr(playedPiece)} déplacé en ${playedTo} manque de soutien défensif.`
        );
      }
    }
  }

  // Rule 3: Fork / Double attack in opponent's reply
  if (oppReply) {
    const matrixAfterReply = boardAfter.board();
    const forkedTargets = getValuableTargetsAttackedFrom(
      matrixAfterReply,
      oppReply.to,
      opponentColor
    );
    if (forkedTargets.length >= 2) {
      const t1 = forkedTargets[0];
      const t2 = forkedTargets[1];
      reasons.push(
        `La réplique ${oppReply.san} crée une attaque double (fourchette) visant simultanément votre ${pieceNameFr(t1.type)} en ${t1.sq} et votre ${pieceNameFr(t2.type)} en ${t2.sq}.`
      );
    }
  }

  // Rule 4: Missed material gain (best move was a winning capture or tactic)
  if (evalBefore.bestMoveUci) {
    const boardBefore = new Chess(fenBefore);
    const bestMove = uciToMove(boardBefore, evalBefore.bestMoveUci);
    if (bestMove && bestMove.captured) {
      const victimName = pieceNameFr(bestMove.captured);
      if (classification === 'missed_win') {
        reasons.push(
          `Gain matériel manqué : vous pouviez exploiter l’imprécision adverse pour capturer le ${victimName} en ${bestMove.to} avec ${bestMove.san}.`
        );
      } else if (PIECE_VALUE[bestMove.captured] >= PIECE_VALUE[bestMove.piece]) {
        reasons.push(
          `Vous avez manqué la capture avantageuse du ${victimName} en ${bestMove.to} par ${bestMove.san}.`
        );
      }
    } else if (classification === 'missed_win') {
      reasons.push(
        `Gain manqué : votre adversaire venait de commettre une faute, mais ${frPlayed} laisse passer l’avantage décisif.`
      );
    }
  }

  // Rule 5: Opening development & King safety advice (first 10 full moves = 20 plies)
  if (ply <= 20 && reasons.length === 0 && winPctLoss > 5) {
    const beforeBoard = new Chess(fenBefore);
    const castlingBefore = beforeBoard.getCastlingRights(playedColor);
    const lostCastling =
      playedPiece === 'k' &&
      playedSan !== 'O-O' &&
      playedSan !== 'O-O-O' &&
      (castlingBefore.k || castlingBefore.q);

    if (lostCastling) {
      reasons.push(
        `En déplaçant le Roi si tôt avec ${frPlayed}, vous perdez le droit de roquer et laissez le Roi vulnérable au centre.`
      );
    } else if (
      playedPiece === 'q' ||
      playedSan.startsWith('a') ||
      playedSan.startsWith('h')
    ) {
      reasons.push(
        `Dans l’ouverture, ${frPlayed} néglige le développement des pièces mineures et le contrôle des cases centrales.`
      );
    } else {
      reasons.push(
        `${frPlayed} ralentit votre développement et concède l’initiative à l’adversaire (${winPctLoss.toFixed(1)} % de perte de gain).`
      );
    }
  }

  // Generic tactical fallback if no specific pattern matched
  if (reasons.length === 0) {
    const label =
      classification === 'blunder'
        ? 'gaffe'
        : classification === 'mistake'
        ? 'erreur'
        : 'imprécision';
    reasons.push(
      `${frPlayed} est une ${label} qui dégrade votre position (${winPctLoss.toFixed(1)} % de chances de gain perdues).`
    );
  }

  // Mandatory conclusion: best move recommended by Stockfish + 2-3 half-moves PV
  const bestSan = evalBefore.bestMoveSan ?? '';
  const pvSan = pvUciToSan(fenBefore, evalBefore.pvUci, ply, 3);
  if (bestSan && pvSan) {
    reasons.push(
      `Meilleur coup recommandé : ${bestSan} (suite : ${pvSan}).`
    );
  } else if (bestSan) {
    reasons.push(`Meilleur coup recommandé : ${bestSan}.`);
  }

  return reasons.join(' ');
}
