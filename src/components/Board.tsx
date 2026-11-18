import React, { useMemo } from 'react';
import { Chess } from 'chess.js';
import { useChessStore } from '../store/useChessStore';
import { getTotalGames } from '../services/lichessApi';
import { ChessBoard } from './ChessBoard';
import { FILES } from '../utils/chessHelpers';
import type { BoardArrow, BoardSquareHighlight } from '../types';

export const Board: React.FC = () => {
  const {
    fen,
    turn,
    playerColor,
    history,
    currentPly,
    isBlindMode,
    isOutOfTargetLine,
    expectedBookMoveUci,
    explorerStats,
    isComputerThinking,
    trainingMode,
    quizStatus,
    quizShowSolution,
    quizExpectedMove,
    makeUserMove,
  } = useChessStore();

  const chess = useMemo(() => new Chess(fen), [fen]);
  const boardMatrix = useMemo(() => chess.board(), [chess]);

  const lastEntry = history[currentPly];
  const lastMoveSquares = useMemo(() => {
    if (!lastEntry || !lastEntry.from || !lastEntry.to) return null;
    return { from: lastEntry.from, to: lastEntry.to };
  }, [lastEntry]);

  const kingInCheckSquare = useMemo(() => {
    if (!chess.inCheck()) return null;
    const currentTurn = chess.turn();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = boardMatrix[r][c];
        if (piece && piece.type === 'k' && piece.color === currentTurn) {
          return `${FILES[c]}${8 - r}`;
        }
      }
    }
    return null;
  }, [chess, boardMatrix]);

  const isBotTurnOrThinking =
    chess.turn() !== playerColor || turn !== playerColor || isComputerThinking;

  const arrows: BoardArrow[] = useMemo(() => {
    if (trainingMode === 'quiz') {
      if (quizStatus === 'wrong' && quizShowSolution && quizExpectedMove) {
        return [
          {
            from: quizExpectedMove.from,
            to: quizExpectedMove.to,
            color: 'green',
            label: 'Solution',
            weight: 1,
          },
        ];
      }
      return [];
    }

    if (isBlindMode || isBotTurnOrThinking) return [];
    const list: BoardArrow[] = [];

    if (explorerStats && explorerStats.moves.length > 0) {
      const totalPosGames = Math.max(1, getTotalGames(explorerStats));
      const topMoves = explorerStats.moves.slice(0, 3);
      for (const m of topMoves) {
        if (m.uci.length < 4) continue;
        const from = m.uci.slice(0, 2);
        const to = m.uci.slice(2, 4);
        const moveGames = getTotalGames(m);
        const pct = Math.round((moveGames / totalPosGames) * 100);
        if (pct <= 0 && moveGames === 0) continue;
        list.push({
          from,
          to,
          color: 'blue',
          label: `${pct}%`,
          weight: Math.max(0.25, Math.min(1, moveGames / totalPosGames)),
        });
      }
    }

    if (!isOutOfTargetLine && expectedBookMoveUci) {
      list.push({
        from: expectedBookMoveUci.from,
        to: expectedBookMoveUci.to,
        color: 'green',
        label: 'Théorie',
        weight: 1,
      });
    }

    return list;
  }, [
    trainingMode,
    quizStatus,
    quizShowSolution,
    quizExpectedMove,
    isBlindMode,
    isBotTurnOrThinking,
    explorerStats,
    isOutOfTargetLine,
    expectedBookMoveUci,
  ]);

  const highlightedSquares: BoardSquareHighlight[] = useMemo(() => {
    const list: BoardSquareHighlight[] = [];

    const isQuizSolutionHighlight =
      trainingMode === 'quiz' &&
      quizStatus === 'wrong' &&
      quizShowSolution &&
      quizExpectedMove;

    if (isQuizSolutionHighlight && quizExpectedMove) {
      list.push({ square: quizExpectedMove.from, variant: 'solution' });
      list.push({ square: quizExpectedMove.to, variant: 'solution' });
    } else if (
      trainingMode === 'opening' &&
      !isBlindMode &&
      !isBotTurnOrThinking &&
      !isOutOfTargetLine &&
      expectedBookMoveUci
    ) {
      const variant =
        turn === playerColor ? 'book' : 'book-opponent';
      list.push({ square: expectedBookMoveUci.from, variant });
      list.push({ square: expectedBookMoveUci.to, variant });
    }

    if (kingInCheckSquare) {
      list.push({ square: kingInCheckSquare, variant: 'check' });
    }

    return list;
  }, [
    trainingMode,
    quizStatus,
    quizShowSolution,
    quizExpectedMove,
    isBlindMode,
    isBotTurnOrThinking,
    isOutOfTargetLine,
    expectedBookMoveUci,
    turn,
    playerColor,
    kingInCheckSquare,
  ]);

  return (
    <ChessBoard
      fen={fen}
      orientation={playerColor}
      interactive={!isComputerThinking}
      allowedColor={playerColor}
      lastMove={lastMoveSquares}
      arrows={arrows}
      highlightedSquares={highlightedSquares}
      size="lg"
      maxWidthClass="max-w-none"
      onMove={makeUserMove}
    />
  );
};
