export function formatMoveLabel(san: string, plyIndex: number): string {
  const moveNumber = Math.floor((plyIndex - 1) / 2) + 1;
  const isWhite = plyIndex % 2 === 1;
  return isWhite ? `${moveNumber}. ${san}` : `${moveNumber}... ${san}`;
}

export function formatMovesSequence(moves: string[]): string {
  if (moves.length === 0) return 'Position de départ';
  return moves
    .map((san, idx) =>
      idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}. ${san}` : san
    )
    .join(' ');
}
