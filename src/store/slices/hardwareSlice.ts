import { Chess, type Square } from 'chess.js';
import type { BoardDriver, LedHighlight } from '../../drivers/BoardDriver';
import { Esp32BleDriver } from '../../drivers/Esp32BleDriver';
import { VirtualHardwareDriver } from '../../drivers/VirtualHardwareDriver';
import type { HardwareSlice, SliceCreator } from '../storeTypes';

let activeDriver: BoardDriver | null = null;
let driverUnsubscribers: Array<() => void> = [];

function cleanupActiveDriverListeners() {
  for (const unsub of driverUnsubscribers) {
    unsub();
  }
  driverUnsubscribers = [];
}

export const createHardwareSlice: SliceCreator<HardwareSlice> = (set, get) => ({
  driverKind: 'none',
  driverName: 'Aucun matériel',
  driverStatus: 'disconnected',
  driverError: null,

  syncDriverLeds: () => {
    if (!activeDriver || activeDriver.status !== 'connected') return;
    const state = get();

    // In Quiz mode, LEDs are driven explicitly by quiz events (green on good/solution, red on wrong)
    if (state.trainingMode === 'quiz') {
      return;
    }

    if (
      state.isBlindMode ||
      state.turn !== state.playerColor ||
      state.isComputerThinking
    ) {
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
      if (
        lastEntry?.from &&
        lastEntry?.to &&
        lastEntry.color !== state.playerColor
      ) {
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
  },

  flashDriverSquares: (squares) => {
    if (activeDriver && activeDriver.status === 'connected') {
      void activeDriver.sendHighlight(squares, true);
    }
  },

  flashDriverError: (sq, duration = 800) => {
    if (activeDriver && activeDriver.status === 'connected') {
      void activeDriver.sendError(sq, duration);
    }
  },

  clearDriverLeds: () => {
    if (activeDriver && activeDriver.status === 'connected') {
      void activeDriver.sendClear();
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
          get().syncDriverLeds();
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
        get().syncDriverLeds();
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
      get().syncDriverLeds();
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
});
