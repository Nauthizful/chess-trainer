import React, { useEffect, useState } from 'react';
import {
  Bluetooth,
  Cpu,
  Power,
  Terminal,
  Wifi,
  X,
} from 'lucide-react';
import { useChessStore } from '../store/useChessStore';
import type { VirtualHardwareSnapshot } from '../drivers/VirtualHardwareDriver';

interface HardwarePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;

export const HardwarePanel: React.FC<HardwarePanelProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    driverKind,
    driverName,
    driverStatus,
    driverError,
    connectDriver,
    disconnectDriver,
    getVirtualDriver,
  } = useChessStore();

  const [wsIp, setWsIp] = useState('192.168.1.50');
  const [simSquare, setSimSquare] = useState('e2');
  const [simUci, setSimUci] = useState('e2e4');
  const [virtualSnap, setVirtualSnap] = useState<VirtualHardwareSnapshot>({
    leds: {},
    errorSq: null,
    logs: [],
  });

  useEffect(() => {
    const vDriver = getVirtualDriver();
    if (!vDriver) return;
    return vDriver.onSnapshotChange((snap) => {
      setVirtualSnap(snap);
    });
  }, [driverKind, driverStatus, getVirtualDriver]);

  if (!isOpen) return null;

  const isConnected = driverStatus === 'connected';
  const isConnecting = driverStatus === 'connecting';
  const vDriver = getVirtualDriver();

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold text-white">
                Échiquier Connecté (ESP32 / WS2812B)
              </h2>
              <p className="text-[11px] text-slate-400">
                {driverName} • Statut :{' '}
                <span
                  className={
                    isConnected
                      ? 'text-emerald-400 font-semibold'
                      : driverStatus === 'error'
                      ? 'text-rose-400 font-semibold'
                      : 'text-slate-300'
                  }
                >
                  {driverStatus}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {driverError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-xs text-rose-200">
              {driverError}
            </div>
          )}

          {/* Connection Modes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* BLE */}
            <button
              type="button"
              disabled={isConnecting}
              onClick={() => void connectDriver('esp32-ble')}
              className={`p-3 rounded-xl border text-left transition-all ${
                driverKind === 'esp32-ble' && isConnected
                  ? 'bg-blue-500/15 border-blue-400 text-blue-100'
                  : 'bg-slate-800/70 border-slate-700 hover:bg-slate-800 text-slate-200'
              }`}
            >
              <Bluetooth className="w-5 h-5 text-blue-400 mb-2" />
              <p className="text-xs font-bold">ESP32 BLE</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Web Bluetooth (chunks 20o)
              </p>
            </button>

            {/* WebSocket */}
            <div
              className={`p-3 rounded-xl border transition-all space-y-2 ${
                driverKind === 'esp32-ws' && isConnected
                  ? 'bg-emerald-500/15 border-emerald-400'
                  : 'bg-slate-800/70 border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-emerald-400" />
                <p className="text-xs font-bold text-slate-100">
                  ESP32 WebSocket
                </p>
              </div>
              <input
                type="text"
                value={wsIp}
                onChange={(e) => setWsIp(e.target.value)}
                placeholder="192.168.1.50"
                className="w-full px-2 py-1 text-[11px] font-mono bg-slate-900 border border-slate-700 rounded-md text-slate-100"
              />
              <button
                type="button"
                disabled={isConnecting}
                onClick={() => void connectDriver('esp32-ws', wsIp)}
                className="w-full py-1 rounded-md text-[11px] font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40"
              >
                ws://{wsIp}:81
              </button>
            </div>

            {/* Virtual Simulator */}
            <button
              type="button"
              disabled={isConnecting}
              onClick={() => void connectDriver('virtual')}
              className={`p-3 rounded-xl border text-left transition-all ${
                driverKind === 'virtual' && isConnected
                  ? 'bg-amber-500/15 border-amber-400 text-amber-100'
                  : 'bg-slate-800/70 border-slate-700 hover:bg-slate-800 text-slate-200'
              }`}
            >
              <Terminal className="w-5 h-5 text-amber-400 mb-2" />
              <p className="text-xs font-bold">Simulateur Matériel</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Tester LEDs & JSON sans ESP32
              </p>
            </button>
          </div>

          {isConnected && (
            <button
              type="button"
              onClick={() => void disconnectDriver()}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border border-rose-500/40 transition-colors"
            >
              <Power className="w-3.5 h-3.5" />
              Déconnecter le driver actif
            </button>
          )}

          {/* Virtual Hardware Simulator Section */}
          {driverKind === 'virtual' && vDriver && isConnected && (
            <div className="border-t border-slate-800 pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Virtual LED Matrix */}
                <div>
                  <p className="text-xs font-semibold text-slate-300 mb-2">
                    Matrice LED WS2812B (8×8)
                  </p>
                  <div className="grid grid-cols-8 gap-0.5 p-1.5 bg-slate-950 rounded-xl border border-slate-800 aspect-square max-w-[240px]">
                    {RANKS.map((rank) =>
                      FILES.map((file) => {
                        const sq = `${file}${rank}`;
                        const ledColor = virtualSnap.leds[sq];
                        const isErr = virtualSnap.errorSq === sq;
                        return (
                          <button
                            key={sq}
                            type="button"
                            onClick={() => vDriver.simulateSelect(sq)}
                            title={`Simuler select(${sq})`}
                            style={{
                              backgroundColor: isErr
                                ? '#FF0000'
                                : ledColor || '#1e293b',
                            }}
                            className="rounded-sm flex items-center justify-center text-[9px] font-mono text-white/80 hover:ring-1 hover:ring-white transition-all"
                          >
                            {sq}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Event Simulation Controls */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-300">
                    Simuler événements ESP32 (TX → App)
                  </p>

                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={simSquare}
                      onChange={(e) => setSimSquare(e.target.value)}
                      placeholder="e2"
                      className="w-20 px-2.5 py-1.5 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => vDriver.simulateSelect(simSquare)}
                      className="flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border border-blue-500/40"
                    >
                      select({simSquare})
                    </button>
                    <button
                      type="button"
                      onClick={() => vDriver.simulateDeselect(simSquare)}
                      className="py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                    >
                      deselect
                    </button>
                  </div>

                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={simUci}
                      onChange={(e) => setSimUci(e.target.value)}
                      placeholder="e2e4"
                      className="w-20 px-2.5 py-1.5 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => vDriver.simulateMove(simUci)}
                      className="flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40"
                    >
                      move({simUci})
                    </button>
                  </div>

                  {/* Live JSON Log */}
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 mb-1">
                      Journal protocole JSON
                    </p>
                    <div className="h-32 overflow-y-auto rounded-lg bg-slate-950 border border-slate-800 p-2 space-y-1 font-mono text-[10px]">
                      {virtualSnap.logs.length === 0 ? (
                        <span className="text-slate-500">
                          Aucune trame échangée pour le moment...
                        </span>
                      ) : (
                        virtualSnap.logs.map((log) => (
                          <div key={log.id} className="break-all">
                            <span className="text-slate-500">{log.timestamp}</span>{' '}
                            <span
                              className={
                                log.direction === 'tx'
                                  ? 'text-emerald-400 font-bold'
                                  : 'text-amber-400 font-bold'
                              }
                            >
                              {log.direction === 'tx' ? 'APP→ESP' : 'ESP→APP'}
                            </span>{' '}
                            <span className="text-slate-200">{log.payload}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
