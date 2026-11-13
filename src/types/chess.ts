export type PlayerColor = 'w' | 'b';

export type DatabaseSource = 'masters' | 'lichess';

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
  pgn: string;
  moves: string[];
  description: string;
  category: OpeningCategory;
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
