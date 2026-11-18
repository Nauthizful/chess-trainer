import {
  deleteBranchFromTree,
  findParentRepertoireNodeId,
  findRepertoireNodeById,
  loadRepertoireFromStorage,
  mergeMovesIntoRepertoire,
  mergeRepertoireTrees,
  saveRepertoireToStorage,
  updateNodeNoteInTree,
} from '../../components/Repertoire/repertoireUtils';
import type { UserRepertoire } from '../../types';
import type { RepertoireSlice, SliceCreator } from '../storeTypes';

export const createRepertoireSlice: SliceCreator<RepertoireSlice> = (set, get) => ({
  userRepertoire: loadRepertoireFromStorage(),
  repertoireColor: 'w',
  repertoireSelectedNodeId: 'root',

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

  addVariationAtNode: (nodeId, san) => {
    const state = get();
    const key = state.repertoireColor === 'w' ? 'white' : 'black';
    const currentTree = state.userRepertoire[key];
    const found = findRepertoireNodeById(currentTree, nodeId);
    const basePath = found ? found.movesPath : [];
    const { updatedRoot } = mergeMovesIntoRepertoire(currentTree, [
      ...basePath,
      san,
    ]);
    const nextRepertoire: UserRepertoire = {
      ...state.userRepertoire,
      [key]: updatedRoot,
    };
    saveRepertoireToStorage(nextRepertoire);
    set({ userRepertoire: nextRepertoire });
  },

  stepBackRepertoireNode: () => {
    const state = get();
    if (state.repertoireSelectedNodeId === 'root') return;
    const key = state.repertoireColor === 'w' ? 'white' : 'black';
    const parentId = findParentRepertoireNodeId(
      state.userRepertoire[key],
      state.repertoireSelectedNodeId
    );
    set({ repertoireSelectedNodeId: parentId ?? 'root' });
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
    const updatedRoot = deleteBranchFromTree(state.userRepertoire[key], nodeId);
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
});
