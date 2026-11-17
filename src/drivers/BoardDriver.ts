export type DriverStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export type DriverKind = 'none' | 'esp32-ble' | 'esp32-ws' | 'virtual';

export interface LedHighlight {
  sq: string;
  color: string;
}

export interface DriverProtocolLog {
  id: string;
  timestamp: string;
  direction: 'tx' | 'rx';
  payload: string;
}

export type DriverIncomingEvent =
  | { event: 'select'; sq: string }
  | { event: 'move'; uci: string }
  | { event: 'deselect'; sq: string };

export type DriverOutgoingCommand =
  | { cmd: 'highlight'; clear: boolean; squares: LedHighlight[] }
  | { cmd: 'error'; sq: string; duration: number }
  | { cmd: 'clear' };

export interface BoardDriver {
  readonly kind: DriverKind;
  readonly name: string;
  readonly status: DriverStatus;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendHighlight(squares: LedHighlight[], clear?: boolean): Promise<void>;
  sendError(sq: string, duration?: number): Promise<void>;
  sendClear(): Promise<void>;

  onSelect(cb: (sq: string) => void): () => void;
  onMove(cb: (uci: string) => void): () => void;
  onDeselect(cb: (sq: string) => void): () => void;
  onStatusChange(cb: (status: DriverStatus, error?: string) => void): () => void;
}
