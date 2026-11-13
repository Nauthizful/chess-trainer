import { create } from 'zustand';
import { Chess } from 'chess.js';
import { OPENINGS } from '../data/openings';
import {
  fetchExplorerStats,
  getExplorerCacheSize,
  pickRealisticLichessMove,
} from '../services/lichessApi';
import type {
  DatabaseSource,
  HistoryEntry,
  LichessExplorerResponse,
  Opening,
  PlayerColor,
  SquarePair,
} from '../types';

const DEFAULT_OPENING =
  OPENINGS.find((o) => o.eco === 'C50') ?? OPENINGS[0];

const INITIAL_CHESS = new Chess();
const INITIAL_FEN = INITIAL_CHESS.fen();

function createInitialHistory(): HistoryEntry[] {
  return [
    {
      ply: 0,
      fen: INITIAL_FEN,
      san: null,
      from: null,
      to: null,
      color: null,
      isBookMove: true,
    },
  ];
}

function computeExpectedMove(
  fen: string,
  opening: Opening,
  ply: number,
  isOutOfBook: boolean
): {
  expectedBookMoveSan: string | null;
  expectedBookMoveUci: SquarePair | null;
  isBookCompleted: boolean;
} {
  if (isOutOfBook) {
    return {
      expectedBookMoveSan: null,
      expectedBookMoveUci: null,
      isBookCompleted: false,
    };
  }

  if (ply >= opening.moves.length) {
    return {
      expectedBookMoveSan: null,
      expectedBookMoveUci: null,
      isBookCompleted: true,
    };
  }

  const expectedSan = opening.moves[ply];
  try {
    const chess = new Chess(fen);
    const move = chess.move(expectedSan);
    if (!move) {
      return {
        expectedBookMoveSan: null,
        expectedBookMoveUci: null,
        isBookCompleted: false,
      };
    }
    return {
      expectedBookMoveSan: move.san,
      expectedBookMoveUci: { from: move.from, to: move.to },
      isBookCompleted: false,
    };
  } catch {
    return {
      expectedBookMoveSan: null,
      expectedBookMoveUci: null,
      isBookCompleted: false,
    };
  }
}

function computeBookStateForHistory(
  history: HistoryEntry[],
  ply: number,
  opening: Opening
): {
  isOutOfBook: boolean;
  deviationInfo: { ply: number; playedSan: string; expectedSan: string } | null;
} {
  for (let i = 1; i <= ply; i++) {
    const entry = history[i];
    const expected = opening.moves[i - 1];
    if (!expected || entry.san !== expected) {
      if (expected && entry.san) {
        return {
          isOutOfBook: true,
          deviationInfo: {
            ply: i,
            playedSan: entry.san,
            expectedSan: expected,
          },
        };
      }
      return { isOutOfBook: false, deviationInfo: null };
    }
  }
  return { isOutOfBook: false, deviationInfo: null };
}

let activeSessionId = 1;
let computerTimer: ReturnType<typeof setTimeout> | null = null;

function clearPendingComputerMove() {
  if (computerTimer !== null) {
    clearTimeout(computerTimer);
    computerTimer = null;
  }
}

export interface ChessTrainerState {
  playerColor: PlayerColor;
  selectedOpening: Opening;
  databaseSource: DatabaseSource;
  isBlindMode: boolean;

  history: HistoryEntry[];
  currentPly: number;
  fen: string;
  turn: PlayerColor;

  isOutOfBook: boolean;
  isBookCompleted: boolean;
  expectedBookMoveSan: string | null;
  expectedBookMoveUci: SquarePair | null;
  lastMoveDeviation: { ply: number; playedSan: string; expectedSan: string } | null;

  explorerStats: LichessExplorerResponse | null;
  isLoadingStats: boolean;
  statsError: string | null;
  cacheCount: number;
  isComputerThinking: boolean;

  init: () => void;
  setPlayerColor: (color: PlayerColor) => void;
  setSelectedOpening: (opening: Opening) => void;
  setDatabaseSource: (source: DatabaseSource) => void;
  toggleBlindMode: () => void;
  resetGame: () => void;
  makeUserMove: (from: string, to: string, promotion?: string) => boolean;
  makeSanMove: (san: string) => boolean;
  jumpToPly: (ply: number) => void;
  triggerComputerMove: () => void;
}

export const useChessStore = create<ChessTrainerState>((set, get) => {
  const loadStatsForPosition = async (fen: string, sessionId: number) => {
    const { databaseSource } = get();
    set({ isLoadingStats: true, statsError: null });
    try {
      const stats = await fetchExplorerStats(fen, databaseSource);
      if (sessionId !== activeSessionId) return;
      // Only apply if FEN still matches current position
      if (get().fen === fen) {
        set({
          explorerStats: stats,
          isLoadingStats: false,
          statsError: null,
          cacheCount: getExplorerCacheSize(),
        });
      }
    } catch (err) {
      if (sessionId !== activeSessionId) return;
      if (get().fen === fen) {
        set({
          isLoadingStats: false,
          statsError:
            err instanceof Error
              ? err.message
              : 'Impossible de joindre explorer.lichess.ovh',
          cacheCount: getExplorerCacheSize(),
        });
      }
    }
  };

  const scheduleComputerMove = (sessionId: number, delayMs = 350) => {
    clearPendingComputerMove();
    const state = get();
    if (state.turn === state.playerColor) return;

    const chess = new Chess(state.fen);
    if (chess.isGameOver()) return;

    set({ isComputerThinking: true });

    computerTimer = setTimeout(async () => {
      computerTimer = null;
      if (sessionId !== activeSessionId) return;

      const current = get();
      if (current.turn === current.playerColor) {
        set({ isComputerThinking: false });
        return;
      }

      const board = new Chess(current.fen);
      if (board.isGameOver()) {
        set({ isComputerThinking: false });
        return;
      }

      let chosenSan: string | null = null;
      let isBook = false;

      // 1. If still in target opening book and moves remain, play the exact opening line
      if (
        !current.isOutOfBook &&
        current.currentPly < current.selectedOpening.moves.length
      ) {
        const bookMove = current.selectedOpening.moves[current.currentPly];
        try {
          const testBoard = new Chess(current.fen);
          const result = testBoard.move(bookMove);
          if (result) {
            chosenSan = result.san;
            isBook = true;
          }
        } catch {
          chosenSan = null;
        }
      }

      // 2. Otherwise (deviated out of book OR book line completed), pick realistic Lichess move
      if (!chosenSan) {
        const legalMoves = board.moves();
        let stats = current.explorerStats;
        try {
          stats = await fetchExplorerStats(current.fen, current.databaseSource);
          if (sessionId !== activeSessionId) return;
          set({ cacheCount: getExplorerCacheSize() });
        } catch {
          // Use existing stats or fallback to legal move
        }

        chosenSan = pickRealisticLichessMove(stats, legalMoves);

        if (!chosenSan && legalMoves.length > 0) {
          chosenSan = legalMoves[Math.floor(Math.random() * legalMoves.length)];
        }
      }

      if (!chosenSan || sessionId !== activeSessionId) {
        set({ isComputerThinking: false });
        return;
      }

      const moveResult = board.move(chosenSan);
      if (!moveResult) {
        set({ isComputerThinking: false });
        return;
      }

      const newFen = board.fen();
      const nextPly = current.currentPly + 1;
      const truncatedHistory = current.history.slice(0, current.currentPly + 1);
      const newEntry: HistoryEntry = {
        ply: nextPly,
        fen: newFen,
        san: moveResult.san,
        from: moveResult.from,
        to: moveResult.to,
        color: moveResult.color,
        isBookMove: isBook && !current.isOutOfBook,
      };
      const nextHistory = [...truncatedHistory, newEntry];

      const { isOutOfBook, deviationInfo } = computeBookStateForHistory(
        nextHistory,
        nextPly,
        current.selectedOpening
      );
      const expected = computeExpectedMove(
        newFen,
        current.selectedOpening,
        nextPly,
        isOutOfBook
      );

      set({
        history: nextHistory,
        currentPly: nextPly,
        fen: newFen,
        turn: board.turn(),
        isOutOfBook,
        lastMoveDeviation: deviationInfo,
        isBookCompleted: expected.isBookCompleted,
        expectedBookMoveSan: expected.expectedBookMoveSan,
        expectedBookMoveUci: expected.expectedBookMoveUci,
        isComputerThinking: false,
      });

      void loadStatsForPosition(newFen, sessionId);
    }, delayMs);
  };

  const applyPlayerMove = (moveInput: { from: string; to: string; promotion?: string } | string): boolean => {
    const state = get();
    if (state.isComputerThinking || state.turn !== state.playerColor) {
      return false;
    }

    const board = new Chess(state.fen);
    if (board.isGameOver()) return false;

    let moveResult;
    try {
      moveResult = board.move(moveInput);
    } catch {
      return false;
    }
    if (!moveResult) return false;

    activeSessionId += 1;
    const sessionId = activeSessionId;
    clearPendingComputerMove();

    const newFen = board.fen();
    const nextPly = state.currentPly + 1;
    const truncatedHistory = state.history.slice(0, state.currentPly + 1);

    const expectedBookSan =
      !state.isOutOfBook && state.currentPly < state.selectedOpening.moves.length
        ? state.selectedOpening.moves[state.currentPly]
        : null;

    const matchesBook =
      !state.isOutOfBook &&
      expectedBookSan !== null &&
      moveResult.san === expectedBookSan;

    const newEntry: HistoryEntry = {
      ply: nextPly,
      fen: newFen,
      san: moveResult.san,
      from: moveResult.from,
      to: moveResult.to,
      color: moveResult.color,
      isBookMove: matchesBook,
    };

    const nextHistory = [...truncatedHistory, newEntry];
    const { isOutOfBook, deviationInfo } = computeBookStateForHistory(
      nextHistory,
      nextPly,
      state.selectedOpening
    );
    const expected = computeExpectedMove(
      newFen,
      state.selectedOpening,
      nextPly,
      isOutOfBook
    );

    set({
      history: nextHistory,
      currentPly: nextPly,
      fen: newFen,
      turn: board.turn(),
      isOutOfBook,
      lastMoveDeviation: deviationInfo,
      isBookCompleted: expected.isBookCompleted,
      expectedBookMoveSan: expected.expectedBookMoveSan,
      expectedBookMoveUci: expected.expectedBookMoveUci,
    });

    void loadStatsForPosition(newFen, sessionId);

    if (!board.isGameOver() && board.turn() !== state.playerColor) {
      scheduleComputerMove(sessionId);
    }

    return true;
  };

  const initialExpected = computeExpectedMove(
    INITIAL_FEN,
    DEFAULT_OPENING,
    0,
    false
  );

  return {
    playerColor: 'w',
    selectedOpening: DEFAULT_OPENING,
    databaseSource: 'masters',
    isBlindMode: false,

    history: createInitialHistory(),
    currentPly: 0,
    fen: INITIAL_FEN,
    turn: 'w',

    isOutOfBook: false,
    isBookCompleted: initialExpected.isBookCompleted,
    expectedBookMoveSan: initialExpected.expectedBookMoveSan,
    expectedBookMoveUci: initialExpected.expectedBookMoveUci,
    lastMoveDeviation: null,

    explorerStats: null,
    isLoadingStats: false,
    statsError: null,
    cacheCount: 0,
    isComputerThinking: false,

    init: () => {
      const state = get();
      void loadStatsForPosition(state.fen, activeSessionId);
      if (state.turn !== state.playerColor) {
        scheduleComputerMove(activeSessionId, 300);
      }
    },

    setPlayerColor: (color) => {
      set({ playerColor: color });
      get().resetGame();
    },

    setSelectedOpening: (opening) => {
      set({ selectedOpening: opening });
      get().resetGame();
    },

    setDatabaseSource: (source) => {
      set({ databaseSource: source });
      void loadStatsForPosition(get().fen, activeSessionId);
    },

    toggleBlindMode: () => {
      set((state) => ({ isBlindMode: !state.isBlindMode }));
    },

    resetGame: () => {
      activeSessionId += 1;
      const sessionId = activeSessionId;
      clearPendingComputerMove();

      const { selectedOpening, playerColor } = get();
      const expected = computeExpectedMove(
        INITIAL_FEN,
        selectedOpening,
        0,
        false
      );

      set({
        history: createInitialHistory(),
        currentPly: 0,
        fen: INITIAL_FEN,
        turn: 'w',
        isOutOfBook: false,
        lastMoveDeviation: null,
        isBookCompleted: expected.isBookCompleted,
        expectedBookMoveSan: expected.expectedBookMoveSan,
        expectedBookMoveUci: expected.expectedBookMoveUci,
        isComputerThinking: false,
        explorerStats: null,
        statsError: null,
      });

      void loadStatsForPosition(INITIAL_FEN, sessionId);

      if (playerColor === 'b') {
        scheduleComputerMove(sessionId, 320);
      }
    },

    makeUserMove: (from, to, promotion) => {
      return applyPlayerMove({ from, to, promotion });
    },

    makeSanMove: (san) => {
      return applyPlayerMove(san);
    },

    jumpToPly: (ply) => {
      const state = get();
      if (ply < 0 || ply >= state.history.length) return;

      activeSessionId += 1;
      const sessionId = activeSessionId;
      clearPendingComputerMove();

      const targetEntry = state.history[ply];
      const board = new Chess(targetEntry.fen);
      const { isOutOfBook, deviationInfo } = computeBookStateForHistory(
        state.history,
        ply,
        state.selectedOpening
      );
      const expected = computeExpectedMove(
        targetEntry.fen,
        state.selectedOpening,
        ply,
        isOutOfBook
      );

      set({
        currentPly: ply,
        fen: targetEntry.fen,
        turn: board.turn(),
        isOutOfBook,
        lastMoveDeviation: deviationInfo,
        isBookCompleted: expected.isBookCompleted,
        expectedBookMoveSan: expected.expectedBookMoveSan,
        expectedBookMoveUci: expected.expectedBookMoveUci,
        isComputerThinking: false,
      });

      void loadStatsForPosition(targetEntry.fen, sessionId);
    },

    triggerComputerMove: () => {
      const state = get();
      if (state.turn !== state.playerColor && !state.isComputerThinking) {
        scheduleComputerMove(activeSessionId, 150);
      }
    },
  };
});
