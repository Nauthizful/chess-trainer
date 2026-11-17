export type PlayerColor = 'w' | 'b';

export type DatabaseSource = 'masters' | 'lichess';

export type LichessConnectionStatus =
  | 'idle'
  | 'connected'
  | 'auth_error'
  | 'offline';

export type OpeningCategory =
  | 'Flanc (A)'
  | 'Semi-Ouverte (B)'
  | 'Ouverte (C)'
  | 'Fermée (D)'
  | 'Indienne (E)';

export interface Opening {
  id: string;
  eco: string;
  name: string;
  familyName: string;
  variationName: string | null;
  pgn: string;
  uci?: string;
  moves: string[];
  movesKey?: string;
  description: string;
  category: OpeningCategory;
  playedBy: PlayerColor;
}

export interface OpeningFamily {
  id: string;
  familyName: string;
  playedBy: PlayerColor;
  ecoRange: string;
  openings: Opening[];
  representativeOpening: Opening;
  variantCount: number;
}

export interface RepertoireNodeStats {
  attempts: number;
  successes: number;
  lastReviewed?: number;
}

export interface RepertoireNode {
  id: string;
  fen: string;
  san: string;
  uci: string;
  note?: string;
  eco?: string;
  openingName?: string;
  stats?: RepertoireNodeStats;
  children: RepertoireNode[];
}

export interface UserRepertoire {
  white: RepertoireNode;
  black: RepertoireNode;
}

export type MoveClassification =
  | 'book'
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'missed_win';

export interface PositionEval {
  fen: string;
  cp: number;
  mate: number | null;
  whiteWinPct: number;
  bestMoveUci: string | null;
  bestMoveSan: string | null;
  pvUci: string[];
}

export interface AnalyzedMove {
  ply: number;
  moveNumber: number;
  color: PlayerColor;
  san: string;
  frenchSan: string;
  uci: string;
  from: string;
  to: string;
  fenBefore: string;
  fenAfter: string;
  evalBefore: PositionEval;
  evalAfter: PositionEval;
  winPctBefore: number;
  winPctAfter: number;
  winPctLoss: number;
  classification: MoveClassification;
  scoreLabel: string;
  bestMoveUci: string | null;
  punishmentUci: string | null;
  coachExplanation: string;
}

export interface ImportedGameMeta {
  id: string;
  whiteName: string;
  blackName: string;
  whiteRating?: number;
  blackRating?: number;
  result: string;
  speed?: string;
  date?: string;
  pgn: string;
  userColor: PlayerColor;
}

export interface HistoryEntry {
  ply: number;
  fen: string;
  san: string | null;
  from: string | null;
  to: string | null;
  color: PlayerColor | null;
  isBookMove: boolean;
}

export interface LichessMoveStat {
  uci: string;
  san: string;
  white: number;
  draws: number;
  black: number;
  averageRating?: number;
}

export interface LichessExplorerResponse {
  white: number;
  draws: number;
  black: number;
  moves: LichessMoveStat[];
  opening?: {
    eco: string;
    name: string;
  } | null;
}

export interface BoardArrow {
  from: string;
  to: string;
  color: 'green' | 'amber' | 'blue';
  label?: string;
  weight?: number;
}

export interface SquarePair {
  from: string;
  to: string;
}
