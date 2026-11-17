import type {
  BoardDriver,
  DriverKind,
  DriverOutgoingCommand,
  DriverProtocolLog,
  DriverStatus,
  LedHighlight,
} from './BoardDriver';

export interface VirtualHardwareSnapshot {
  leds: Record<string, string>;
  errorSq: string | null;
  logs: DriverProtocolLog[];
}

export class VirtualHardwareDriver implements BoardDriver {
  readonly kind: DriverKind = 'virtual';
  readonly name = 'Simulateur Matériel ESP32 (Virtuel)';

  private _status: DriverStatus = 'disconnected';
  private leds: Record<string, string> = {};
  private errorSq: string | null = null;
  private errorTimer: ReturnType<typeof setTimeout> | null = null;
  private logs: DriverProtocolLog[] = [];

  private selectListeners = new Set<(sq: string) => void>();
  private moveListeners = new Set<(uci: string) => void>();
  private deselectListeners = new Set<(sq: string) => void>();
  private statusListeners = new Set<(status: DriverStatus, error?: string) => void>();
  private snapshotListeners = new Set<(snapshot: VirtualHardwareSnapshot) => void>();

  get status(): DriverStatus {
    return this._status;
  }

  getSnapshot(): VirtualHardwareSnapshot {
    return {
      leds: { ...this.leds },
      errorSq: this.errorSq,
      logs: [...this.logs],
    };
  }

  private emitSnapshot() {
    const snap = this.getSnapshot();
    this.snapshotListeners.forEach((cb) => cb(snap));
  }

  private appendLog(direction: 'tx' | 'rx', payload: string) {
    const entry: DriverProtocolLog = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour12: false }),
      direction,
      payload,
    };
    this.logs = [entry, ...this.logs].slice(0, 40);
    this.emitSnapshot();
  }

  private setStatus(status: DriverStatus, error?: string) {
    this._status = status;
    this.statusListeners.forEach((cb) => cb(status, error));
  }

  onSnapshotChange(cb: (snapshot: VirtualHardwareSnapshot) => void): () => void {
    this.snapshotListeners.add(cb);
    cb(this.getSnapshot());
    return () => this.snapshotListeners.delete(cb);
  }

  onSelect(cb: (sq: string) => void): () => void {
    this.selectListeners.add(cb);
    return () => this.selectListeners.delete(cb);
  }

  onMove(cb: (uci: string) => void): () => void {
    this.moveListeners.add(cb);
    return () => this.moveListeners.delete(cb);
  }

  onDeselect(cb: (sq: string) => void): () => void {
    this.deselectListeners.add(cb);
    return () => this.deselectListeners.delete(cb);
  }

  onStatusChange(cb: (status: DriverStatus, error?: string) => void): () => void {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  async connect(): Promise<void> {
    this.leds = {};
    this.errorSq = null;
    this.setStatus('connected');
    this.emitSnapshot();
  }

  async disconnect(): Promise<void> {
    if (this.errorTimer) {
      clearTimeout(this.errorTimer);
      this.errorTimer = null;
    }
    this.leds = {};
    this.errorSq = null;
    this.setStatus('disconnected');
    this.emitSnapshot();
  }

  private recordOutgoing(cmd: DriverOutgoingCommand) {
    this.appendLog('tx', JSON.stringify(cmd));
  }

  async sendHighlight(squares: LedHighlight[], clear = true): Promise<void> {
    if (this._status !== 'connected') return;
    if (clear) {
      this.leds = {};
    }
    for (const item of squares) {
      this.leds[item.sq] = item.color;
    }
    this.recordOutgoing({ cmd: 'highlight', clear, squares });
  }

  async sendError(sq: string, duration = 600): Promise<void> {
    if (this._status !== 'connected') return;
    if (this.errorTimer) clearTimeout(this.errorTimer);
    this.errorSq = sq;
    this.recordOutgoing({ cmd: 'error', sq, duration });
    this.errorTimer = setTimeout(() => {
      this.errorSq = null;
      this.emitSnapshot();
    }, duration);
  }

  async sendClear(): Promise<void> {
    if (this._status !== 'connected') return;
    this.leds = {};
    this.errorSq = null;
    this.recordOutgoing({ cmd: 'clear' });
  }

  // Simulate incoming hardware switch events (TX from ESP32 -> App)
  simulateSelect(sq: string) {
    if (this._status !== 'connected') return;
    const normalized = sq.trim().toLowerCase();
    this.appendLog('rx', JSON.stringify({ event: 'select', sq: normalized }));
    this.selectListeners.forEach((cb) => cb(normalized));
  }

  simulateMove(uci: string) {
    if (this._status !== 'connected') return;
    const normalized = uci.trim().toLowerCase();
    this.appendLog('rx', JSON.stringify({ event: 'move', uci: normalized }));
    this.moveListeners.forEach((cb) => cb(normalized));
  }

  simulateDeselect(sq: string) {
    if (this._status !== 'connected') return;
    const normalized = sq.trim().toLowerCase();
    this.appendLog('rx', JSON.stringify({ event: 'deselect', sq: normalized }));
    this.deselectListeners.forEach((cb) => cb(normalized));
  }
}
