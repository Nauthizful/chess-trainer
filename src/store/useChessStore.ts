import { create } from 'zustand';
import { createExplorerSlice } from './slices/explorerSlice';
import { createHardwareSlice } from './slices/hardwareSlice';
import { createRepertoireSlice } from './slices/repertoireSlice';
import { createTrainingSlice } from './slices/trainingSlice';
import type { ChessTrainerState } from './storeTypes';

export { findRefugeOpenings } from './slices/trainingSlice';
export type {
  AppTab,
  ChessTrainerState,
  QuizStatus,
  TrainingMode,
} from './storeTypes';

export const useChessStore = create<ChessTrainerState>()((...args) => ({
  ...createTrainingSlice(...args),
  ...createExplorerSlice(...args),
  ...createRepertoireSlice(...args),
  ...createHardwareSlice(...args),
}));
