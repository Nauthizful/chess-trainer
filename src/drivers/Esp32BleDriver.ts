import type {
  BoardDriver,
  DriverIncomingEvent,
  DriverKind,
  DriverOutgoingCommand,
  DriverStatus,
  LedHighlight,
} from './BoardDriver';

// Nordic UART Service (NUS) standard UUIDs commonly used by ESP32 BLE bridges
export const ESP32_BLE_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const ESP32_BLE_RX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
export const ESP32_BLE_TX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

const BLE_MTU_CHUNK_SIZE = 20;

export type Esp32TransportMode = 'ble' | 'ws';

export interface Esp32DriverOptions {
  mode: Esp32TransportMode;
  wsIp?: string;
  wsPort?: number;
}

export class Esp32BleDriver implements BoardDriver {
  readonly kind: DriverKind;
  readonly name: string;

  private _status: DriverStatus = 'disconnected';
  private readonly mode: Esp32TransportMode;
  private readonly wsUrl: string;

  private device: BluetoothDevice | null = null;
  private rxCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private txCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private ws: WebSocket | null = null;

  private rxBuffer = '';
  private writeQueue: Promise<void> = Promise.resolve();
  private readonly encoder = new TextEncoder();
  private readonly decoder = new TextDecoder();

  private selectListeners = new Set<(sq: string) => void>();
  private moveListeners = new Set<(uci: string) => void>();
  private deselectListeners = new Set<(sq: string) => void>();
  private statusListeners = new Set<(status: DriverStatus, error?: string) => void>();

  constructor(options: Esp32DriverOptions = { mode: 'ble' }) {
    this.mode = options.mode;
    this.kind = options.mode === 'ble' ? 'esp32-ble' : 'esp32-ws';
    const ip = (options.wsIp || '192.168.1.50').trim();
    const port = options.wsPort ?? 81;
    this.wsUrl = `ws://${ip}:${port}`;
    this.name =
      options.mode === 'ble'
        ? 'ESP32 BLE (Nordic UART)'
        : `ESP32 WebSocket (${this.wsUrl})`;
  }

  get status(): DriverStatus {
    return this._status;
  }

  private setStatus(status: DriverStatus, error?: string) {
    this._status = status;
    this.statusListeners.forEach((cb) => cb(status, error));
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
    if (this._status === 'connected' || this._status === 'connecting') return;
    this.setStatus('connecting');

    if (this.mode === 'ble') {
      await this.connectBle();
    } else {
      await this.connectWebSocket();
    }
  }

  private async connectBle(): Promise<void> {
    if (!navigator.bluetooth) {
      const msg =
        'Web Bluetooth non supporté par ce navigateur (utilisez Chrome/Edge en HTTPS ou localhost, ou le mode WebSocket).';
      this.setStatus('error', msg);
      throw new Error(msg);
    }

    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [ESP32_BLE_SERVICE_UUID] }],
        optionalServices: [ESP32_BLE_SERVICE_UUID],
      });

      this.device = device;
      device.addEventListener('gattserverdisconnected', this.handleBleDisconnect);

      if (!device.gatt) {
        throw new Error('GATT server indisponible sur cet appareil BLE.');
      }

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(ESP32_BLE_SERVICE_UUID);
      const rxChar = await service.getCharacteristic(ESP32_BLE_RX_CHAR_UUID);
      const txChar = await service.getCharacteristic(ESP32_BLE_TX_CHAR_UUID);

      this.rxCharacteristic = rxChar;
      this.txCharacteristic = txChar;

      await txChar.startNotifications();
      txChar.addEventListener('characteristicvaluechanged', this.handleBleNotify);

      this.setStatus('connected');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Échec de connexion BLE ESP32';
      this.setStatus('error', msg);
      throw err;
    }
  }

  private connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(this.wsUrl);
        this.ws = ws;

        const timeout = setTimeout(() => {
          if (this._status === 'connecting') {
            ws.close();
            const msg = `Timeout de connexion WebSocket vers ${this.wsUrl}`;
            this.setStatus('error', msg);
            reject(new Error(msg));
          }
        }, 5000);

        ws.onopen = () => {
          clearTimeout(timeout);
          this.setStatus('connected');
          resolve();
        };

        ws.onmessage = (event) => {
          if (typeof event.data === 'string') {
            this.processIncomingChunk(event.data.endsWith('\n') ? event.data : `${event.data}\n`);
          }
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          const msg = `Erreur WebSocket (${this.wsUrl})`;
          this.setStatus('error', msg);
          reject(new Error(msg));
        };

        ws.onclose = () => {
          clearTimeout(timeout);
          if (this._status === 'connected') {
            this.setStatus('disconnected');
          }
          this.ws = null;
        };
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Erreur WebSocket ESP32';
        this.setStatus('error', msg);
        reject(err);
      }
    });
  }

  private handleBleDisconnect = () => {
    this.rxCharacteristic = null;
    this.txCharacteristic = null;
    this.setStatus('disconnected');
  };

  private handleBleNotify = (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    if (!target.value) return;
    const text = this.decoder.decode(target.value);
    this.processIncomingChunk(text);
  };

  private processIncomingChunk(chunk: string) {
    this.rxBuffer += chunk;
    let newlineIndex = this.rxBuffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = this.rxBuffer.slice(0, newlineIndex).trim();
      this.rxBuffer = this.rxBuffer.slice(newlineIndex + 1);
      if (line) {
        this.dispatchIncomingLine(line);
      }
      newlineIndex = this.rxBuffer.indexOf('\n');
    }
  }

  private dispatchIncomingLine(line: string) {
    try {
      const parsed = JSON.parse(line) as DriverIncomingEvent;
      if (parsed.event === 'select' && typeof parsed.sq === 'string') {
        this.selectListeners.forEach((cb) => cb(parsed.sq));
      } else if (parsed.event === 'move' && typeof parsed.uci === 'string') {
        this.moveListeners.forEach((cb) => cb(parsed.uci));
      } else if (parsed.event === 'deselect' && typeof parsed.sq === 'string') {
        this.deselectListeners.forEach((cb) => cb(parsed.sq));
      }
    } catch {
      // Ignore malformed JSON frames from hardware buffer
    }
  }

  async disconnect(): Promise<void> {
    if (this.txCharacteristic) {
      this.txCharacteristic.removeEventListener(
        'characteristicvaluechanged',
        this.handleBleNotify
      );
      this.txCharacteristic = null;
    }
    if (this.device) {
      this.device.removeEventListener('gattserverdisconnected', this.handleBleDisconnect);
      if (this.device.gatt?.connected) {
        this.device.gatt.disconnect();
      }
      this.device = null;
    }
    this.rxCharacteristic = null;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.rxBuffer = '';
    this.setStatus('disconnected');
  }

  private sendCommand(command: DriverOutgoingCommand): Promise<void> {
    if (this._status !== 'connected') {
      return Promise.resolve();
    }

    const payload = `${JSON.stringify(command)}\n`;

    if (this.mode === 'ws') {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(payload);
      }
      return Promise.resolve();
    }

    // BLE: split JSON + '\n' into 20-byte MTU chunks and serialize writes
    const bytes = this.encoder.encode(payload);
    this.writeQueue = this.writeQueue.then(async () => {
      if (!this.rxCharacteristic || this._status !== 'connected') return;
      for (let offset = 0; offset < bytes.length; offset += BLE_MTU_CHUNK_SIZE) {
        const chunk = bytes.slice(offset, offset + BLE_MTU_CHUNK_SIZE);
        if (this.rxCharacteristic.properties.writeWithoutResponse && this.rxCharacteristic.writeValueWithoutResponse) {
          await this.rxCharacteristic.writeValueWithoutResponse(chunk);
        } else {
          await this.rxCharacteristic.writeValue(chunk);
        }
      }
    });

    return this.writeQueue;
  }

  async sendHighlight(squares: LedHighlight[], clear = true): Promise<void> {
    await this.sendCommand({ cmd: 'highlight', clear, squares });
  }

  async sendError(sq: string, duration = 600): Promise<void> {
    await this.sendCommand({ cmd: 'error', sq, duration });
  }

  async sendClear(): Promise<void> {
    await this.sendCommand({ cmd: 'clear' });
  }
}
