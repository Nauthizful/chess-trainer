import type { StateCreator } from 'zustand';
import type {
  Edge,
  EdgeChange,
  NodeChange,
} from '@xyflow/react';
import type { OpeningFlowNode } from '../components/Explorer/OpeningMoveNode';
import type { DriverKind, DriverStatus, LedHighlight } from '../drivers/BoardDriver';
import type { VirtualHardwareDriver } from '../drivers/VirtualHardwareDriver';
import type { QuizLine } from '../utils/quizEngine';
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

export type AppTab = 'training' | 'explorer' | 'repertoire' | 'analysis';
export type TrainingMode = 'opening' | 'quiz';
export type QuizStatus =
  | 'idle'
  | 'awaiting_user'
  | 'correct'
  | 'wrong'
  | 'line_completed'
  | 'empty_repertoire';

export interface TrainingSlice {
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
}

export interface ExplorerSlice {
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

  setExplorerSearchQuery: (query: string) => void;
  setExplorerCampFilter: (camp: 'all' | PlayerColor) => void;
  selectExplorerFamily: (family: OpeningFamily) => void;
  selectExplorerNode: (nodeId: string) => void;
  onExplorerNodesChange: (changes: NodeChange<OpeningFlowNode>[]) => void;
  onExplorerEdgesChange: (changes: EdgeChange[]) => void;
}

export interface RepertoireSlice {
  userRepertoire: UserRepertoire;
  repertoireColor: PlayerColor;
  repertoireSelectedNodeId: string;

  setRepertoireColor: (color: PlayerColor) => void;
  selectRepertoireNode: (nodeId: string) => void;
  addExplorerLineToRepertoire: (
    targetColor: PlayerColor,
    movesSan: string[],
    meta?: { eco?: string; openingName?: string }
  ) => void;
  addManualMoveToRepertoire: (san: string) => void;
  addVariationAtNode: (nodeId: string, san: string) => void;
  stepBackRepertoireNode: () => void;
  updateRepertoireNodeNote: (nodeId: string, note: string) => void;
  deleteRepertoireBranch: (nodeId: string) => void;
  importRepertoireJson: (
    imported: UserRepertoire,
    mode: 'merge' | 'replace'
  ) => void;
}

export interface HardwareSlice {
  driverKind: DriverKind;
  driverName: string;
  driverStatus: DriverStatus;
  driverError: string | null;

  connectDriver: (kind: 'esp32-ble' | 'esp32-ws' | 'virtual', wsIp?: string) => Promise<void>;
  disconnectDriver: () => Promise<void>;
  getVirtualDriver: () => VirtualHardwareDriver | null;
  syncDriverLeds: () => void;
  flashDriverSquares: (squares: LedHighlight[]) => void;
  flashDriverError: (sq: string, duration?: number) => void;
  clearDriverLeds: () => void;
}

export type ChessTrainerState = TrainingSlice &
  ExplorerSlice &
  RepertoireSlice &
  HardwareSlice;

export type SliceCreator<T> = StateCreator<ChessTrainerState, [], [], T>;
