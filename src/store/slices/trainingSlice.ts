import { Chess } from 'chess.js';
import { OPENINGS } from '../../data/openings';
import {
  findRepertoireNodeById,
  saveRepertoireToStorage,
} from '../../components/Repertoire/repertoireUtils';
import {
  extractRepertoireLines,
  pickWeightedOpponentChild,
  recordRepertoireNodeStat,
} from '../../utils/quizEngine';
import {
  fetchExplorerStats,
  getExplorerCacheSize,
  getStoredLichessToken,
  LichessApiError,
  pickRealisticLichessMove,
  setStoredLichessToken,
} from '../../services/lichessApi';
import { INITIAL_FEN } from '../../utils/chessHelpers';
import { formatMovesSequence } from '../../utils/chessFormatting';
import type {
  HistoryEntry,
  LichessConnectionStatus,
  Opening,
  PlayerColor,
  SquarePair,
  UserRepertoire,
} from '../../types';
import type { SliceCreator, TrainingSlice } from '../storeTypes';

function pickDefaultOpeningFor(playerColor: PlayerColor): Opening {
  const preferredEco = playerColor === 'w' ? 'B90' : 'C50';
  return (
    OPENINGS.find((o) => o.eco === preferredEco && o.playedBy !== playerColor) ??
    OPENINGS.find((o) => o.playedBy !== playerColor) ??
    OPENINGS[0]
  );
}

const DEFAULT_OPENING = pickDefaultOpeningFor('w');

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
  isOutOfTargetLine: boolean
): {
  expectedBookMoveSan: string | null;
  expectedBookMoveUci: SquarePair | null;
  isBookCompleted: boolean;
} {
  if (isOutOfTargetLine) {
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
  isOutOfTargetLine: boolean;
  deviationInfo: { ply: number; playedSan: string; expectedSan: string } | null;
} {
  for (let i = 1; i <= ply; i++) {
    const entry = history[i];
    const expected = opening.moves[i - 1];
    if (!expected || entry.san !== expected) {
      if (expected && entry.san) {
        return {
          isOutOfTargetLine: true,
          deviationInfo: {
            ply: i,
            playedSan: entry.san,
            expectedSan: expected,
          },
        };
      }
      return { isOutOfTargetLine: false, deviationInfo: null };
    }
  }
  return { isOutOfTargetLine: false, deviationInfo: null };
}

export function findRefugeOpenings(
  history: HistoryEntry[],
  currentPly: number,
  playerColor: PlayerColor,
  currentOpeningId: string
): Opening[] {
  const playedMoves = history
    .slice(1, currentPly + 1)
    .map((h) => h.san)
    .filter((s): s is string => Boolean(s));

  return OPENINGS.filter((opening) => {
    if (opening.playedBy === playerColor) return false;
    if (opening.id === currentOpeningId) return false;
    if (opening.moves.length <= currentPly) return false;
    for (let i = 0; i < playedMoves.length; i++) {
      if (opening.moves[i] !== playedMoves[i]) return false;
    }
    return true;
  });
}

let activeSessionId = 1;
let computerTimer: ReturnType<typeof setTimeout> | null = null;

function clearPendingComputerMove() {
  if (computerTimer !== null) {
    clearTimeout(computerTimer);
    computerTimer = null;
  }
}

export const createTrainingSlice: SliceCreator<TrainingSlice> = (set, get) => {
  const loadStatsForPosition = async (fen: string, sessionId: number) => {
    const { databaseSource, lichessToken } = get();
    set({ isLoadingStats: true, statsError: null });
    try {
      const stats = await fetchExplorerStats(fen, databaseSource, lichessToken);
      if (sessionId !== activeSessionId) return;
      if (get().fen === fen) {
        set({
          explorerStats: stats,
          isLoadingStats: false,
          statsError: null,
          lichessStatus: 'connected',
          cacheCount: getExplorerCacheSize(),
        });
        get().syncDriverLeds();
      }
    } catch (err) {
      if (sessionId !== activeSessionId) return;
      if (get().fen === fen) {
        const status: LichessConnectionStatus =
          err instanceof LichessApiError ? err.kind : 'offline';
        set({
          isLoadingStats: false,
          statsError:
            err instanceof Error
              ? err.message
              : 'Hors-ligne : impossible de joindre explorer.lichess.org',
          lichessStatus: status,
          cacheCount: getExplorerCacheSize(),
        });
      }
    }
  };

  const scheduleComputerMove = (
    sessionId: number,
    delayMs = 350,
    preferMostPopular = false
  ) => {
    clearPendingComputerMove();
    const state = get();
    if (state.turn === state.playerColor) return;
    if (state.isOutOfTargetLine && !state.isFreeExploreMode) return;

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
      if (current.isOutOfTargetLine && !current.isFreeExploreMode) {
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

      if (
        !current.isOutOfTargetLine &&
        !current.isFreeExploreMode &&
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

      if (!chosenSan) {
        const legalMoves = board.moves();
        let stats = current.explorerStats;
        try {
          stats = await fetchExplorerStats(
            current.fen,
            current.databaseSource,
            current.lichessToken
          );
          if (sessionId !== activeSessionId) return;
          set({
            cacheCount: getExplorerCacheSize(),
            lichessStatus: 'connected',
          });
        } catch (err) {
          if (err instanceof LichessApiError) {
            set({ lichessStatus: err.kind });
          }
        }

        chosenSan = pickRealisticLichessMove(
          stats,
          legalMoves,
          preferMostPopular
        );

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
        isBookMove:
          isBook && !current.isOutOfTargetLine && !current.isFreeExploreMode,
      };
      const nextHistory = [...truncatedHistory, newEntry];

      const bookState = current.isFreeExploreMode
        ? { isOutOfTargetLine: false, deviationInfo: current.lastMoveDeviation }
        : computeBookStateForHistory(
            nextHistory,
            nextPly,
            current.selectedOpening
          );

      const expected = computeExpectedMove(
        newFen,
        current.selectedOpening,
        nextPly,
        bookState.isOutOfTargetLine || current.isFreeExploreMode
      );

      set({
        history: nextHistory,
        currentPly: nextPly,
        fen: newFen,
        turn: board.turn(),
        isOutOfTargetLine: bookState.isOutOfTargetLine,
        lastMoveDeviation: bookState.deviationInfo,
        isBookCompleted: expected.isBookCompleted,
        expectedBookMoveSan: expected.expectedBookMoveSan,
        expectedBookMoveUci: expected.expectedBookMoveUci,
        isComputerThinking: false,
      });

      get().syncDriverLeds();
      void loadStatsForPosition(newFen, sessionId);
    }, delayMs);
  };

  const scheduleQuizOpponentMove = (sessionId: number, delayMs = 450) => {
    clearPendingComputerMove();
    const state = get();
    if (state.trainingMode !== 'quiz' || state.turn === state.playerColor) {
      return;
    }

    const repKey = state.playerColor === 'w' ? 'white' : 'black';
    const root = state.userRepertoire[repKey];
    const found = findRepertoireNodeById(root, state.quizActiveNodeId);
    if (!found || found.node.children.length === 0) {
      set({ quizStatus: 'line_completed', isComputerThinking: false });
      return;
    }

    set({ isComputerThinking: true });

    computerTimer = setTimeout(() => {
      computerTimer = null;
      if (sessionId !== activeSessionId) return;

      const current = get();
      if (
        current.trainingMode !== 'quiz' ||
        current.turn === current.playerColor
      ) {
        set({ isComputerThinking: false });
        return;
      }

      const key = current.playerColor === 'w' ? 'white' : 'black';
      const activeFound = findRepertoireNodeById(
        current.userRepertoire[key],
        current.quizActiveNodeId
      );
      if (!activeFound || activeFound.node.children.length === 0) {
        set({ quizStatus: 'line_completed', isComputerThinking: false });
        return;
      }

      const nextOnTarget = current.quizTargetLine?.nodes[current.currentPly];
      const chosenChild =
        activeFound.node.children.length === 1
          ? activeFound.node.children[0]
          : nextOnTarget &&
            activeFound.node.children.some((c) => c.id === nextOnTarget.id)
          ? nextOnTarget
          : pickWeightedOpponentChild(activeFound.node.children);

      if (!chosenChild) {
        set({ quizStatus: 'line_completed', isComputerThinking: false });
        return;
      }

      const board = new Chess(current.fen);
      let moveRes;
      try {
        moveRes = board.move(chosenChild.san);
      } catch {
        set({ isComputerThinking: false });
        return;
      }
      if (!moveRes) {
        set({ isComputerThinking: false });
        return;
      }

      const newFen = board.fen();
      const nextPly = current.currentPly + 1;
      const newEntry: HistoryEntry = {
        ply: nextPly,
        fen: newFen,
        san: moveRes.san,
        from: moveRes.from,
        to: moveRes.to,
        color: moveRes.color,
        isBookMove: true,
      };

      const isLineDone =
        chosenChild.children.length === 0 || board.isGameOver();

      set({
        history: [...current.history, newEntry],
        currentPly: nextPly,
        fen: newFen,
        turn: board.turn(),
        quizActiveNodeId: chosenChild.id,
        quizStatus: isLineDone ? 'line_completed' : 'awaiting_user',
        quizShowSolution: false,
        quizWrongMovePlayed: null,
        isComputerThinking: false,
      });

      get().flashDriverSquares([
        { sq: moveRes.from, color: '#00FF00' },
        { sq: moveRes.to, color: '#00FF00' },
      ]);
    }, delayMs);
  };

  const applyPlayerMove = (
    moveInput: { from: string; to: string; promotion?: string } | string
  ): boolean => {
    const state = get();
    if (state.isComputerThinking || state.turn !== state.playerColor) {
      return false;
    }

    if (state.trainingMode === 'quiz') {
      if (
        state.quizStatus === 'line_completed' ||
        state.quizStatus === 'empty_repertoire'
      ) {
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

      const repKey = state.playerColor === 'w' ? 'white' : 'black';
      const currentRepRoot = state.userRepertoire[repKey];
      const activeFound = findRepertoireNodeById(
        currentRepRoot,
        state.quizActiveNodeId
      );

      if (!activeFound || activeFound.node.children.length === 0) {
        return false;
      }

      const matchedChild = activeFound.node.children.find(
        (c) => c.san === moveResult.san
      );

      if (matchedChild) {
        activeSessionId += 1;
        const sessionId = activeSessionId;
        clearPendingComputerMove();

        const updatedRepRoot = recordRepertoireNodeStat(
          currentRepRoot,
          matchedChild.id,
          true
        );
        const nextRepertoire: UserRepertoire = {
          ...state.userRepertoire,
          [repKey]: updatedRepRoot,
        };
        saveRepertoireToStorage(nextRepertoire);

        const newFen = board.fen();
        const nextPly = state.currentPly + 1;
        const newEntry: HistoryEntry = {
          ply: nextPly,
          fen: newFen,
          san: moveResult.san,
          from: moveResult.from,
          to: moveResult.to,
          color: moveResult.color,
          isBookMove: true,
        };

        const isLineDone =
          matchedChild.children.length === 0 || board.isGameOver();

        set({
          userRepertoire: nextRepertoire,
          history: [...state.history, newEntry],
          currentPly: nextPly,
          fen: newFen,
          turn: board.turn(),
          quizActiveNodeId: matchedChild.id,
          quizStatus: isLineDone ? 'line_completed' : 'correct',
          quizLastNote: matchedChild.note?.trim() || null,
          quizShowSolution: false,
          quizExpectedMove: null,
          quizWrongMovePlayed: null,
        });

        get().flashDriverSquares([{ sq: moveResult.to, color: '#00FF00' }]);

        if (!isLineDone) {
          scheduleQuizOpponentMove(sessionId, 500);
        }

        return true;
      }

      const targetLineNode = state.quizTargetLine?.nodes[state.currentPly];
      const expectedChild =
        targetLineNode &&
        activeFound.node.children.some((c) => c.id === targetLineNode.id)
          ? targetLineNode
          : activeFound.node.children[0];

      const updatedRepRoot = recordRepertoireNodeStat(
        currentRepRoot,
        expectedChild.id,
        false
      );
      const nextRepertoire: UserRepertoire = {
        ...state.userRepertoire,
        [repKey]: updatedRepRoot,
      };
      saveRepertoireToStorage(nextRepertoire);

      const expectedFrom = expectedChild.uci.slice(0, 2);
      const expectedTo = expectedChild.uci.slice(2, 4);

      set({
        userRepertoire: nextRepertoire,
        quizStatus: 'wrong',
        quizShowSolution: false,
        quizWrongMovePlayed: moveResult.san,
        quizExpectedMove: {
          san: expectedChild.san,
          from: expectedFrom,
          to: expectedTo,
          nodeId: expectedChild.id,
        },
      });

      get().flashDriverError(moveResult.to, 800);

      return true;
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
      !state.isOutOfTargetLine &&
      !state.isFreeExploreMode &&
      state.currentPly < state.selectedOpening.moves.length
        ? state.selectedOpening.moves[state.currentPly]
        : null;

    const matchesBook =
      !state.isOutOfTargetLine &&
      !state.isFreeExploreMode &&
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
    const bookState = state.isFreeExploreMode
      ? { isOutOfTargetLine: false, deviationInfo: state.lastMoveDeviation }
      : computeBookStateForHistory(nextHistory, nextPly, state.selectedOpening);

    const expected = computeExpectedMove(
      newFen,
      state.selectedOpening,
      nextPly,
      bookState.isOutOfTargetLine || state.isFreeExploreMode
    );

    set({
      history: nextHistory,
      currentPly: nextPly,
      fen: newFen,
      turn: board.turn(),
      isOutOfTargetLine: bookState.isOutOfTargetLine,
      lastMoveDeviation: bookState.deviationInfo,
      isBookCompleted: expected.isBookCompleted,
      expectedBookMoveSan: expected.expectedBookMoveSan,
      expectedBookMoveUci: expected.expectedBookMoveUci,
    });

    get().syncDriverLeds();
    void loadStatsForPosition(newFen, sessionId);

    if (
      !board.isGameOver() &&
      board.turn() !== state.playerColor &&
      (!bookState.isOutOfTargetLine || state.isFreeExploreMode)
    ) {
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
    activeTab: 'training',
    trainingMode: 'opening',
    playerColor: 'w',
    selectedOpening: DEFAULT_OPENING,
    databaseSource: 'masters',
    isBlindMode: false,

    lichessToken: getStoredLichessToken(),
    lichessStatus: 'idle',

    history: createInitialHistory(),
    currentPly: 0,
    fen: INITIAL_FEN,
    turn: 'w',

    isOutOfTargetLine: false,
    isFreeExploreMode: false,
    isBookCompleted: initialExpected.isBookCompleted,
    expectedBookMoveSan: initialExpected.expectedBookMoveSan,
    expectedBookMoveUci: initialExpected.expectedBookMoveUci,
    lastMoveDeviation: null,

    explorerStats: null,
    isLoadingStats: false,
    statsError: null,
    cacheCount: 0,
    isComputerThinking: false,

    quizLines: [],
    quizLineIndex: 0,
    quizActiveNodeId: 'root',
    quizTargetLine: null,
    quizStatus: 'idle',
    quizShowSolution: false,
    quizLastNote: null,
    quizExpectedMove: null,
    quizWrongMovePlayed: null,

    init: () => {
      const state = get();
      void loadStatsForPosition(state.fen, activeSessionId);
      if (state.turn !== state.playerColor) {
        scheduleComputerMove(activeSessionId, 300);
      }
    },

    setActiveTab: (tab) => {
      set({ activeTab: tab });
    },

    setTrainingMode: (mode) => {
      if (mode === 'opening') {
        set({ trainingMode: 'opening', quizStatus: 'idle' });
        get().resetGame();
      } else {
        get().startQuizSession(get().playerColor);
      }
    },

    startQuizSession: (color) => {
      activeSessionId += 1;
      const sessionId = activeSessionId;
      clearPendingComputerMove();

      const targetColor = color ?? get().playerColor;
      const repKey = targetColor === 'w' ? 'white' : 'black';
      const lines = extractRepertoireLines(get().userRepertoire[repKey]);

      if (lines.length === 0) {
        set({
          activeTab: 'training',
          trainingMode: 'quiz',
          playerColor: targetColor,
          history: createInitialHistory(),
          currentPly: 0,
          fen: INITIAL_FEN,
          turn: 'w',
          quizLines: [],
          quizLineIndex: 0,
          quizActiveNodeId: 'root',
          quizTargetLine: null,
          quizStatus: 'empty_repertoire',
          quizShowSolution: false,
          quizLastNote: null,
          quizExpectedMove: null,
          quizWrongMovePlayed: null,
          isComputerThinking: false,
        });
        get().clearDriverLeds();
        return;
      }

      set({
        activeTab: 'training',
        trainingMode: 'quiz',
        playerColor: targetColor,
        history: createInitialHistory(),
        currentPly: 0,
        fen: INITIAL_FEN,
        turn: 'w',
        quizLines: lines,
        quizLineIndex: 0,
        quizActiveNodeId: 'root',
        quizTargetLine: lines[0],
        quizStatus: 'awaiting_user',
        quizShowSolution: false,
        quizLastNote: null,
        quizExpectedMove: null,
        quizWrongMovePlayed: null,
        isComputerThinking: false,
      });

      get().clearDriverLeds();

      if (targetColor === 'b') {
        scheduleQuizOpponentMove(sessionId, 320);
      }
    },

    nextQuizLine: () => {
      const state = get();
      const repKey = state.playerColor === 'w' ? 'white' : 'black';
      const nextIdx = state.quizLineIndex + 1;

      if (nextIdx >= state.quizLines.length) {
        get().startQuizSession(state.playerColor);
        return;
      }

      activeSessionId += 1;
      const sessionId = activeSessionId;
      clearPendingComputerMove();

      const targetLine = state.quizLines[nextIdx];
      const root = state.userRepertoire[repKey];
      if (!root.children.length) {
        get().startQuizSession(state.playerColor);
        return;
      }

      set({
        history: createInitialHistory(),
        currentPly: 0,
        fen: INITIAL_FEN,
        turn: 'w',
        quizLineIndex: nextIdx,
        quizActiveNodeId: 'root',
        quizTargetLine: targetLine,
        quizStatus: 'awaiting_user',
        quizShowSolution: false,
        quizLastNote: null,
        quizExpectedMove: null,
        quizWrongMovePlayed: null,
        isComputerThinking: false,
      });

      get().clearDriverLeds();

      if (state.playerColor === 'b') {
        scheduleQuizOpponentMove(sessionId, 320);
      }
    },

    revealQuizSolution: () => {
      const state = get();
      if (!state.quizExpectedMove) return;
      set({ quizShowSolution: true });

      get().flashDriverSquares([
        { sq: state.quizExpectedMove.from, color: '#00FF00' },
        { sq: state.quizExpectedMove.to, color: '#00FF00' },
      ]);
    },

    retryQuizMove: () => {
      set({
        quizStatus: 'awaiting_user',
        quizShowSolution: false,
        quizWrongMovePlayed: null,
      });
      get().clearDriverLeds();
    },

    setPlayerColor: (color) => {
      if (get().trainingMode === 'quiz') {
        get().startQuizSession(color);
        return;
      }
      const current = get().selectedOpening;
      const nextOpening =
        current.playedBy === color ? pickDefaultOpeningFor(color) : current;
      set({ playerColor: color, selectedOpening: nextOpening });
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

    setLichessToken: (token) => {
      setStoredLichessToken(token);
      set({ lichessToken: token.trim(), statsError: null });
      void loadStatsForPosition(get().fen, activeSessionId);
    },

    toggleBlindMode: () => {
      set((state) => ({ isBlindMode: !state.isBlindMode }));
      get().syncDriverLeds();
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
        isOutOfTargetLine: false,
        isFreeExploreMode: false,
        lastMoveDeviation: null,
        isBookCompleted: expected.isBookCompleted,
        expectedBookMoveSan: expected.expectedBookMoveSan,
        expectedBookMoveUci: expected.expectedBookMoveUci,
        isComputerThinking: false,
        explorerStats: null,
        statsError: null,
      });

      get().syncDriverLeds();
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
      const bookState = computeBookStateForHistory(
        state.history,
        ply,
        state.selectedOpening
      );
      const expected = computeExpectedMove(
        targetEntry.fen,
        state.selectedOpening,
        ply,
        bookState.isOutOfTargetLine
      );

      set({
        currentPly: ply,
        fen: targetEntry.fen,
        turn: board.turn(),
        isOutOfTargetLine: bookState.isOutOfTargetLine,
        isFreeExploreMode: false,
        lastMoveDeviation: bookState.deviationInfo,
        isBookCompleted: expected.isBookCompleted,
        expectedBookMoveSan: expected.expectedBookMoveSan,
        expectedBookMoveUci: expected.expectedBookMoveUci,
        isComputerThinking: false,
      });

      get().syncDriverLeds();
      void loadStatsForPosition(targetEntry.fen, sessionId);
    },

    triggerComputerMove: () => {
      const state = get();
      if (
        state.turn !== state.playerColor &&
        !state.isComputerThinking &&
        (!state.isOutOfTargetLine || state.isFreeExploreMode)
      ) {
        scheduleComputerMove(activeSessionId, 150);
      }
    },

    switchToRefugeOpening: (opening) => {
      const state = get();
      activeSessionId += 1;
      const sessionId = activeSessionId;
      clearPendingComputerMove();

      const updatedHistory = state.history.map((entry, idx) =>
        idx <= state.currentPly ? { ...entry, isBookMove: true } : entry
      );

      const expected = computeExpectedMove(
        state.fen,
        opening,
        state.currentPly,
        false
      );

      set({
        selectedOpening: opening,
        history: updatedHistory,
        isOutOfTargetLine: false,
        isFreeExploreMode: false,
        lastMoveDeviation: null,
        isBookCompleted: expected.isBookCompleted,
        expectedBookMoveSan: expected.expectedBookMoveSan,
        expectedBookMoveUci: expected.expectedBookMoveUci,
      });

      get().syncDriverLeds();

      if (state.turn !== state.playerColor) {
        scheduleComputerMove(sessionId, 200);
      }
    },

    continueWithPopularMoves: () => {
      const state = get();
      activeSessionId += 1;
      const sessionId = activeSessionId;
      clearPendingComputerMove();

      set({
        isFreeExploreMode: true,
        isOutOfTargetLine: false,
        expectedBookMoveSan: null,
        expectedBookMoveUci: null,
      });

      if (state.turn !== state.playerColor) {
        scheduleComputerMove(sessionId, 150, true);
      }
    },

    trainVariantFromTree: (baseOpening, movesSan) => {
      activeSessionId += 1;
      const sessionId = activeSessionId;
      clearPendingComputerMove();

      const board = new Chess();
      const nextHistory = createInitialHistory();

      for (let i = 0; i < movesSan.length; i++) {
        const res = board.move(movesSan[i]);
        if (!res) break;
        nextHistory.push({
          ply: i + 1,
          fen: board.fen(),
          san: res.san,
          from: res.from,
          to: res.to,
          color: res.color,
          isBookMove: true,
        });
      }

      const formattedPgn =
        movesSan.length > 0 ? formatMovesSequence(movesSan) : baseOpening.pgn;

      const variantOpening: Opening = {
        ...baseOpening,
        pgn: formattedPgn,
        moves: [...movesSan],
        movesKey: movesSan.join(' '),
      };

      const targetPlayerColor: PlayerColor =
        baseOpening.playedBy === 'w' ? 'b' : 'w';
      const currentPly = nextHistory.length - 1;
      const currentFen = board.fen();
      const expected = computeExpectedMove(
        currentFen,
        variantOpening,
        currentPly,
        false
      );

      set({
        activeTab: 'training',
        trainingMode: 'opening',
        playerColor: targetPlayerColor,
        selectedOpening: variantOpening,
        history: nextHistory,
        currentPly,
        fen: currentFen,
        turn: board.turn(),
        isOutOfTargetLine: false,
        isFreeExploreMode: false,
        lastMoveDeviation: null,
        isBookCompleted: expected.isBookCompleted,
        expectedBookMoveSan: expected.expectedBookMoveSan,
        expectedBookMoveUci: expected.expectedBookMoveUci,
        isComputerThinking: false,
      });

      get().syncDriverLeds();
      void loadStatsForPosition(currentFen, sessionId);

      if (!board.isGameOver() && board.turn() !== targetPlayerColor) {
        scheduleComputerMove(sessionId, 300, true);
      }
    },
  };
};
