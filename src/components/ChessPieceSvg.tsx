import React from 'react';
import type { PieceSymbol, Color } from 'chess.js';

interface ChessPieceSvgProps {
  type: PieceSymbol;
  color: Color;
  className?: string;
}

/**
 * Renders the local Wikimedia Cburnett SVG chess pieces stored in public/pieces/.
 */
export const ChessPieceSvg: React.FC<ChessPieceSvgProps> = ({
  type,
  color,
  className = 'w-full h-full',
}) => {
  const src = `/pieces/${color}${type.toUpperCase()}.svg`;

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{ filter: 'drop-shadow(0 2px 3px rgba(0, 0, 0, 0.32))' }}
      className={`${className} select-none object-contain`}
    />
  );
};
