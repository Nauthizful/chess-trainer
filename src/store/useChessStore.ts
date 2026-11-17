import { create } from 'zustand';
import { Chess, type Square } from 'chess.js';
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import { OPENINGS, OPENING_FAMILIES } from '../data/openings';
import {
  buildFamilyEcoTree,
  computePositionForMoves,
} from '../components/Explorer/ecoTreeBuilder';
import type { OpeningFlowNode } from '../components/Explorer/OpeningMoveNode';
import {
  deleteBranchFromTree,
  findRepertoireNodeById,
  loadRepertoireFromStorage,
  mergeMovesIntoRepertoire,
  mergeRepertoireTrees,
  saveRepertoireToStorage,
  updateNodeNoteInTree,
} from '../components/Repertoire/repertoireUtils';
import {
  extractRepertoireLines,
  pickWeightedOpponentChild,
  recordRepertoireNodeStat,
  type QuizLine,
} from '../utils/quizEngine';
import {
  fetchExplorerStats,
  getExplorerCacheSize,
  getStoredLichessToken,
  LichessApiError,
  pickRealisticLichessMove,
  setStoredLichessToken,
} from '../services/lichessApi';
import type { BoardDriver, DriverKind, DriverStatus, LedHighlight } from '../drivers/BoardDriver';
import { Esp32BleDriver } from '../drivers/Esp32BleDriver';
import { VirtualHardwareDriver } from '../drivers/VirtualHardwareDriver';
import type {
  DatabaseSource,
  HistoryEntry,
  LichessConnectionStatus,
  LichessExplorerResponse,
  Opening,
  OpeningFamily,
  PlayerColor,
  SquarePair,
  UserRepertoire,
} from '../types';

function pickDefaultOpeningFor(playerColor: PlayerColor): Opening {
  const preferredEco = playerColor === 'w' ? 'B90' : 'C50';
  return (
    OPENINGS.find((o) => o.eco === preferredEco && o.playedBy !== playerColor) ??
    OPENINGS.find((o) => o.playedBy !== playerColor) ??
    OPENINGS[0]
  );
}

const DEFAULT_OPENING = pickDefaultOpeningFor('w');

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
let activeDriver: BoardDriver | null = null;
let driverUnsubscribers: Array<() => void> = [];

function clearPendingComputerMove() {
  if (computerTimer !== null) {
    clearTimeout(computerTimer);
    computerTimer = null;
  }
}

function cleanupActiveDriverListeners() {
  for (const unsub of driverUnsubscribers) {
    unsub();
  }
  driverUnsubscribers = [];
}

export type AppTab = 'training' | 'explorer' | 'repertoire' | 'analysis';
export type TrainingMode = 'opening' | 'quiz';
export type QuizStatus =
  | 'idle'
  | 'awaiting_user'
  | 'correct'
  | 'wrong'
  | 'line_completed'
  | 'empty_repertoire';

export interface ChessTrainerState {
  activeTab: AppTab;
  trainingMode: TrainingMode;
  playerColor: PlayerColor;
  selectedOpening: Opening;
  databaseSource: DatabaseSource;
  isBlindMode: boolean;

  lichessToken: string;
  lichessStatus: LichessConnectionStatus;

  history: HistoryEntry[];
  currentPly: number;
  fen: string;
  turn: PlayerColor;

  isOutOfTargetLine: boolean;
  isFreeExploreMode: boolean;
  isBookCompleted: boolean;
  expectedBookMoveSan: string | null;
  expectedBookMoveUci: SquarePair | null;
  lastMoveDeviation: { ply: number; playedSan: string; expectedSan: string } | null;

  explorerStats: LichessExplorerResponse | null;
  isLoadingStats: boolean;
  statsError: string | null;
  cacheCount: number;
  isComputerThinking: boolean;

  driverKind: DriverKind;
  driverName: string;
  driverStatus: DriverStatus;
  driverError: string | null;

  // Persistent Explorer & Tree state
  explorerFamily: OpeningFamily;
  explorerExpandedBranchIds: string[];
  explorerSearchQuery: string;
  explorerCampFilter: 'all' | PlayerColor;
  explorerNodes: OpeningFlowNode[];
  explorerEdges: Edge[];
  explorerSelectedNodeId: string | null;
  explorerPreviewFen: string;
  explorerPreviewLastMove: SquarePair | null;
  explorerPreviewMovesLabel: string;

  // Persistent Personal Repertoire state
  userRepertoire: UserRepertoire;
  repertoireColor: PlayerColor;
  repertoireSelectedNodeId: string;

  // Quiz / Spaced Repetition state
  quizLines: QuizLine[];
  quizLineIndex: number;
  quizActiveNodeId: string;
  quizTargetLine: QuizLine | null;
  quizStatus: QuizStatus;
  quizShowSolution: boolean;
  quizLastNote: string | null;
  quizExpectedMove: { san: string; from: string; to: string; nodeId: string } | null;
  quizWrongMovePlayed: string | null;

  init: () => void;
  setActiveTab: (tab: AppTab) => void;
  setTrainingMode: (mode: TrainingMode) => void;
  startQuizSession: (color?: PlayerColor) => void;
  nextQuizLine: () => void;
  revealQuizSolution: () => void;
  retryQuizMove: () => void;
  setPlayerColor: (color: PlayerColor) => void;
  setSelectedOpening: (opening: Opening) => void;
  setDatabaseSource: (source: DatabaseSource) => void;
  setLichessToken: (token: string) => void;
  toggleBlindMode: () => void;
  resetGame: () => void;
  makeUserMove: (from: string, to: string, promotion?: string) => boolean;
  makeSanMove: (san: string) => boolean;
  jumpToPly: (ply: number) => void;
  triggerComputerMove: () => void;
  switchToRefugeOpening: (opening: Opening) => void;
  continueWithPopularMoves: () => void;
  trainVariantFromTree: (baseOpening: Opening, movesSan: string[]) => void;

  connectDriver: (kind: 'esp32-ble' | 'esp32-ws' | 'virtual', wsIp?: string) => Promise<void>;
  disconnectDriver: () => Promise<void>;
  getVirtualDriver: () => VirtualHardwareDriver | null;

  setExplorerSearchQuery: (query: string) => void;
  setExplorerCampFilter: (camp: 'all' | PlayerColor) => void;
  selectExplorerFamily: (family: OpeningFamily) => void;
  selectExplorerNode: (nodeId: string) => void;
  onExplorerNodesChange: (changes: NodeChange<OpeningFlowNode>[]) => void;
  onExplorerEdgesChange: (changes: EdgeChange[]) => void;

  setRepertoireColor: (color: PlayerColor) => void;
  selectRepertoireNode: (nodeId: string) => void;
  addExplorerLineToRepertoire: (
    targetColor: PlayerColor,
    movesSan: string[],
    meta?: { eco?: string; openingName?: string }
  ) => void;
  addManualMoveToRepertoire: (san: string) => void;
  updateRepertoireNodeNote: (nodeId: string, note: string) => void;
  deleteRepertoireBranch: (nodeId: string) => void;
  importRepertoireJson: (
    imported: UserRepertoire,
    mode: 'merge' | 'replace'
  ) => void;
}

export const useChessStore = create<ChessTrainerState>((set, get) => {
  const syncDriverLeds = () => {
    if (!activeDriver || activeDriver.status !== 'connected') return;
    const state = get();

    // In Quiz mode, LEDs are driven explicitly by quiz events (green on good/solution, red on wrong)
    if (state.trainingMode === 'quiz') {
      return;
    }

    if (state.isBlindMode || state.turn !== state.playerColor || state.isComputerThinking) {
      void activeDriver.sendClear();
      return;
    }

    const highlights: LedHighlight[] = [];
    const usedSquares = new Set<string>();

    // Highlight expected theoretical move or computer's last move in green (#00FF00)
    if (!state.isOutOfTargetLine && state.expectedBookMoveUci) {
      highlights.push({ sq: state.expectedBookMoveUci.from, color: '#00FF00' });
      highlights.push({ sq: state.expectedBookMoveUci.to, color: '#00FF00' });
      usedSquares.add(state.expectedBookMoveUci.from);
      usedSquares.add(state.expectedBookMoveUci.to);
    } else {
      const lastEntry = state.history[state.currentPly];
      if (lastEntry?.from && lastEntry?.to && lastEntry.color !== state.playerColor) {
        highlights.push({ sq: lastEntry.from, color: '#00FF00' });
        highlights.push({ sq: lastEntry.to, color: '#00FF00' });
        usedSquares.add(lastEntry.from);
        usedSquares.add(lastEntry.to);
      }
    }

    // Highlight top alternative Lichess variants in blue (#0088FF)
    if (state.explorerStats && state.explorerStats.moves.length > 0) {
      for (const m of state.explorerStats.moves.slice(0, 3)) {
        if (m.uci.length < 4) continue;
        const toSq = m.uci.slice(2, 4);
        if (!usedSquares.has(toSq)) {
          highlights.push({ sq: toSq, color: '#0088FF' });
          usedSquares.add(toSq);
        }
      }
    }

    if (highlights.length === 0) {
      void activeDriver.sendClear();
    } else {
      void activeDriver.sendHighlight(highlights, true);
    }
  };

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
        syncDriverLeds();
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

        chosenSan = pickRealisticLichessMove(stats, legalMoves, preferMostPopular);

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
        isBookMove: isBook && !current.isOutOfTargetLine && !current.isFreeExploreMode,
      };
      const nextHistory = [...truncatedHistory, newEntry];

      const bookState = current.isFreeExploreMode
        ? { isOutOfTargetLine: false, deviationInfo: current.lastMoveDeviation }
        : computeBookStateForHistory(nextHistory, nextPly, current.selectedOpening);

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

      syncDriverLeds();
      void loadStatsForPosition(newFen, sessionId);
    }, delayMs);
  };

  const scheduleQuizOpponentMove = (sessionId: number, delayMs = 450) => {
    clearPendingComputerMove();
    const state = get();
    if (state.trainingMode !== 'quiz' || state.turn === state.playerColor) return;

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
      if (current.trainingMode !== 'quiz' || current.turn === current.playerColor) {
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

      // If target line continues through this node, prefer it; if multiple replies exist, weighted pick
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

      const isLineDone = chosenChild.children.length === 0 || board.isGameOver();

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

      if (activeDriver && activeDriver.status === 'connected') {
        void activeDriver.sendHighlight(
          [
            { sq: moveRes.from, color: '#00FF00' },
            { sq: moveRes.to, color: '#00FF00' },
          ],
          true
        );
      }
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
        // Good move!
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

        if (activeDriver && activeDriver.status === 'connected') {
          void activeDriver.sendHighlight(
            [{ sq: moveResult.to, color: '#00FF00' }],
            true
          );
        }

        if (!isLineDone) {
          scheduleQuizOpponentMove(sessionId, 500);
        }

        return true;
      }

      // Wrong move (off-repertoire): record failure on expected node & block progression
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

      if (activeDriver && activeDriver.status === 'connected') {
        void activeDriver.sendError(moveResult.to, 800);
      }

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

    syncDriverLeds();
    void loadStatsForPosition(newFen, sessionId);

    // Block automatic computer response if user just deviated and isn't in free explore mode
    if (
      !board.isGameOver() &&
      board.turn() !== state.playerColor &&
      (!bookState.isOutOfTargetLine || state.isFreeExploreMode)
    ) {
      scheduleComputerMove(sessionId);
    }

    return true;
  };

  const initialExpected = computeExpectedMove(INITIAL_FEN, DEFAULT_OPENING, 0, false);

  const defaultExplorerFamily =
    OPENING_FAMILIES.find((f) => f.representativeOpening.eco === 'C50') ??
    OPENING_FAMILIES[0];
  const initialTree = buildFamilyEcoTree(defaultExplorerFamily);
  const initialSelectedTreeNode =
    initialTree.nodes.find((n) => n.id === initialTree.initialSelectedNodeId) ??
    initialTree.nodes[0];
  const initialPreview = computePositionForMoves(
    initialSelectedTreeNode?.data.movesPath ?? []
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

    driverKind: 'none',
    driverName: 'Aucun matériel',
    driverStatus: 'disconnected',
    driverError: null,

    explorerFamily: defaultExplorerFamily,
    explorerExpandedBranchIds: [],
    explorerSearchQuery: '',
    explorerCampFilter: 'all',
    explorerNodes: initialTree.nodes,
    explorerEdges: initialTree.edges,
    explorerSelectedNodeId: initialTree.initialSelectedNodeId,
    explorerPreviewFen: initialPreview.fen,
    explorerPreviewLastMove: initialPreview.lastMove,
    explorerPreviewMovesLabel: initialPreview.movesLabel,

    userRepertoire: loadRepertoireFromStorage(),
    repertoireColor: 'w',
    repertoireSelectedNodeId: 'root',

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
        if (activeDriver && activeDriver.status === 'connected') {
          void activeDriver.sendClear();
        }
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

      if (activeDriver && activeDriver.status === 'connected') {
        void activeDriver.sendClear();
      }

      if (targetColor === 'b') {
        scheduleQuizOpponentMove(sessionId, 320);
      }
    },

    nextQuizLine: () => {
      const state = get();
      const repKey = state.playerColor === 'w' ? 'white' : 'black';
      const nextIdx = state.quizLineIndex + 1;

      if (nextIdx >= state.quizLines.length) {
        // Re-extract and re-sort lines by updated spaced-repetition stats
        get().startQuizSession(state.playerColor);
        return;
      }

      activeSessionId += 1;
      const sessionId = activeSessionId;
      clearPendingComputerMove();

      const targetLine = state.quizLines[nextIdx];
      // Verify line still exists
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

      if (activeDriver && activeDriver.status === 'connected') {
        void activeDriver.sendClear();
      }

      if (state.playerColor === 'b') {
        scheduleQuizOpponentMove(sessionId, 320);
      }
    },

    revealQuizSolution: () => {
      const state = get();
      if (!state.quizExpectedMove) return;
      set({ quizShowSolution: true });

      if (activeDriver && activeDriver.status === 'connected') {
        void activeDriver.sendHighlight(
          [
            { sq: state.quizExpectedMove.from, color: '#00FF00' },
            { sq: state.quizExpectedMove.to, color: '#00FF00' },
          ],
          true
        );
      }
    },

    retryQuizMove: () => {
      set({
        quizStatus: 'awaiting_user',
        quizShowSolution: false,
        quizWrongMovePlayed: null,
      });
      if (activeDriver && activeDriver.status === 'connected') {
        void activeDriver.sendClear();
      }
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
      syncDriverLeds();
    },

    resetGame: () => {
      activeSessionId += 1;
      const sessionId = activeSessionId;
      clearPendingComputerMove();

      const { selectedOpening, playerColor } = get();
      const expected = computeExpectedMove(INITIAL_FEN, selectedOpening, 0, false);

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

      syncDriverLeds();
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

      syncDriverLeds();
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
        idx <= state.currentPly
          ? { ...entry, isBookMove: true }
          : entry
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

      syncDriverLeds();

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

      const formattedPgn = movesSan
        .map((san, idx) =>
          idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}. ${san}` : san
        )
        .join(' ');

      const variantOpening: Opening = {
        ...baseOpening,
        pgn: formattedPgn || baseOpening.pgn,
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

      syncDriverLeds();
      void loadStatsForPosition(currentFen, sessionId);

      if (!board.isGameOver() && board.turn() !== targetPlayerColor) {
        scheduleComputerMove(sessionId, 300, true);
      }
    },

    connectDriver: async (kind, wsIp) => {
      if (activeDriver) {
        cleanupActiveDriverListeners();
        await activeDriver.disconnect();
        activeDriver = null;
      }

      let driver: BoardDriver;
      if (kind === 'virtual') {
        driver = new VirtualHardwareDriver();
      } else if (kind === 'esp32-ws') {
        driver = new Esp32BleDriver({ mode: 'ws', wsIp });
      } else {
        driver = new Esp32BleDriver({ mode: 'ble' });
      }

      activeDriver = driver;
      set({
        driverKind: driver.kind,
        driverName: driver.name,
        driverStatus: 'connecting',
        driverError: null,
      });

      driverUnsubscribers.push(
        driver.onStatusChange((status, error) => {
          set({
            driverStatus: status,
            driverError: error ?? null,
          });
          if (status === 'connected') {
            syncDriverLeds();
          }
        })
      );

      driverUnsubscribers.push(
        driver.onSelect((sq) => {
          const state = get();
          if (state.turn !== state.playerColor || state.isComputerThinking) {
            void driver.sendError(sq, 400);
            return;
          }
          try {
            const chess = new Chess(state.fen);
            const moves = chess.moves({ square: sq as Square, verbose: true });
            if (moves.length === 0) {
              void driver.sendError(sq, 400);
              return;
            }
            const highlights: LedHighlight[] = [
              { sq, color: '#00FF00' },
              ...moves.map((m) => ({ sq: m.to, color: '#0088FF' })),
            ];
            void driver.sendHighlight(highlights, true);
          } catch {
            void driver.sendError(sq, 400);
          }
        })
      );

      driverUnsubscribers.push(
        driver.onDeselect(() => {
          syncDriverLeds();
        })
      );

      driverUnsubscribers.push(
        driver.onMove((uci) => {
          const clean = uci.trim().toLowerCase();
          if (clean.length < 4) return;
          const from = clean.slice(0, 2);
          const to = clean.slice(2, 4);
          const promotion = clean.length > 4 ? clean[4] : undefined;

          const ok = get().makeUserMove(from, to, promotion);
          if (!ok) {
            void driver.sendError(to || from, 600);
          }
        })
      );

      try {
        await driver.connect();
        syncDriverLeds();
      } catch (err) {
        set({
          driverStatus: 'error',
          driverError:
            err instanceof Error ? err.message : 'Erreur de connexion matériel',
        });
      }
    },

    disconnectDriver: async () => {
      if (activeDriver) {
        cleanupActiveDriverListeners();
        await activeDriver.disconnect();
        activeDriver = null;
      }
      set({
        driverKind: 'none',
        driverName: 'Aucun matériel',
        driverStatus: 'disconnected',
        driverError: null,
      });
    },

    getVirtualDriver: () => {
      if (activeDriver instanceof VirtualHardwareDriver) {
        return activeDriver;
      }
      return null;
    },

    setExplorerSearchQuery: (query) => {
      set({ explorerSearchQuery: query });
    },

    setExplorerCampFilter: (camp) => {
      set({ explorerCampFilter: camp });
    },

    selectExplorerFamily: (family) => {
      const built = buildFamilyEcoTree(family);
      const selectedNode =
        built.nodes.find((n) => n.id === built.initialSelectedNodeId) ??
        built.nodes[0];
      const preview = computePositionForMoves(
        selectedNode?.data.movesPath ?? []
      );
      set({
        explorerFamily: family,
        explorerExpandedBranchIds: [],
        explorerNodes: built.nodes,
        explorerEdges: built.edges,
        explorerSelectedNodeId: built.initialSelectedNodeId,
        explorerPreviewFen: preview.fen,
        explorerPreviewLastMove: preview.lastMove,
        explorerPreviewMovesLabel: preview.movesLabel,
      });
    },

    selectExplorerNode: (nodeId) => {
      const state = get();
      const node = state.explorerNodes.find((n) => n.id === nodeId);
      if (!node) return;

      const preview = computePositionForMoves(node.data.movesPath);

      if (
        node.data.hiddenVariantsCount > 0 &&
        !state.explorerExpandedBranchIds.includes(nodeId)
      ) {
        const nextExpanded = [...state.explorerExpandedBranchIds, nodeId];
        const rebuilt = buildFamilyEcoTree(
          state.explorerFamily,
          new Set(nextExpanded)
        );
        set({
          explorerExpandedBranchIds: nextExpanded,
          explorerNodes: rebuilt.nodes,
          explorerEdges: rebuilt.edges,
          explorerSelectedNodeId: nodeId,
          explorerPreviewFen: preview.fen,
          explorerPreviewLastMove: preview.lastMove,
          explorerPreviewMovesLabel: preview.movesLabel,
        });
        return;
      }

      set({
        explorerSelectedNodeId: nodeId,
        explorerPreviewFen: preview.fen,
        explorerPreviewLastMove: preview.lastMove,
        explorerPreviewMovesLabel: preview.movesLabel,
      });
    },

    onExplorerNodesChange: (changes) => {
      set((state) => ({
        explorerNodes: applyNodeChanges(changes, state.explorerNodes),
      }));
    },

    onExplorerEdgesChange: (changes) => {
      set((state) => ({
        explorerEdges: applyEdgeChanges(changes, state.explorerEdges),
      }));
    },

    setRepertoireColor: (color) => {
      set({ repertoireColor: color, repertoireSelectedNodeId: 'root' });
    },

    selectRepertoireNode: (nodeId) => {
      set({ repertoireSelectedNodeId: nodeId });
    },

    addExplorerLineToRepertoire: (targetColor, movesSan, meta) => {
      const state = get();
      const key = targetColor === 'w' ? 'white' : 'black';
      const { updatedRoot } = mergeMovesIntoRepertoire(
        state.userRepertoire[key],
        movesSan,
        meta
      );
      const nextRepertoire: UserRepertoire = {
        ...state.userRepertoire,
        [key]: updatedRoot,
      };
      saveRepertoireToStorage(nextRepertoire);
      set({ userRepertoire: nextRepertoire });
    },

    addManualMoveToRepertoire: (san) => {
      const state = get();
      const key = state.repertoireColor === 'w' ? 'white' : 'black';
      const currentTree = state.userRepertoire[key];
      const found = findRepertoireNodeById(
        currentTree,
        state.repertoireSelectedNodeId
      );
      const basePath = found ? found.movesPath : [];
      const { updatedRoot, targetNodeId } = mergeMovesIntoRepertoire(
        currentTree,
        [...basePath, san]
      );
      const nextRepertoire: UserRepertoire = {
        ...state.userRepertoire,
        [key]: updatedRoot,
      };
      saveRepertoireToStorage(nextRepertoire);
      set({
        userRepertoire: nextRepertoire,
        repertoireSelectedNodeId: targetNodeId,
      });
    },

    updateRepertoireNodeNote: (nodeId, note) => {
      const state = get();
      const key = state.repertoireColor === 'w' ? 'white' : 'black';
      const updatedRoot = updateNodeNoteInTree(
        state.userRepertoire[key],
        nodeId,
        note
      );
      const nextRepertoire: UserRepertoire = {
        ...state.userRepertoire,
        [key]: updatedRoot,
      };
      saveRepertoireToStorage(nextRepertoire);
      set({ userRepertoire: nextRepertoire });
    },

    deleteRepertoireBranch: (nodeId) => {
      if (nodeId === 'root') return;
      const state = get();
      const key = state.repertoireColor === 'w' ? 'white' : 'black';
      const updatedRoot = deleteBranchFromTree(
        state.userRepertoire[key],
        nodeId
      );
      const nextRepertoire: UserRepertoire = {
        ...state.userRepertoire,
        [key]: updatedRoot,
      };
      saveRepertoireToStorage(nextRepertoire);
      set({
        userRepertoire: nextRepertoire,
        repertoireSelectedNodeId: 'root',
      });
    },

    importRepertoireJson: (imported, mode) => {
      const state = get();
      const nextRepertoire: UserRepertoire =
        mode === 'replace'
          ? imported
          : {
              white: mergeRepertoireTrees(
                state.userRepertoire.white,
                imported.white
              ),
              black: mergeRepertoireTrees(
                state.userRepertoire.black,
                imported.black
              ),
            };
      saveRepertoireToStorage(nextRepertoire);
      set({
        userRepertoire: nextRepertoire,
        repertoireSelectedNodeId: 'root',
      });
    },
  };
});
