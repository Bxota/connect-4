import { reactive, computed } from 'vue';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

type PlayerInfo = {
  id: string;
  name: string;
  connected: boolean;
};

type CellCoord = {
  row: number;
  col: number;
};

type LastMove = {
  row: number;
  col: number;
  symbol: string;
};

type GameState = {
  roomCode: string;
  board: string[][];
  turn: string;
  status: string;
  winner: string;
  players: Record<string, PlayerInfo>;
  lastMove: LastMove | null;
  winningCells: CellCoord[];
};

type RoomResponsePayload = {
  room_code?: string;
  player_id?: string;
  symbol?: string;
  role?: string;
  state?: unknown;
};

type IncomingMessage = {
  type?: string;
  payload?: Record<string, unknown>;
};

const defaultWsUrl = (): string => {
  const configured = typeof __VITE_WS_URL__ === 'string' ? __VITE_WS_URL__ : '';
  if (configured) {
    return configured;
  }
  const isSecure = window.location.protocol === 'https:';
  const scheme = isSecure ? 'wss' : 'ws';
  return `${scheme}://${window.location.host}/ws`;
};

const state = reactive({
  serverUrl: defaultWsUrl(),
  connectionStatus: 'disconnected' as ConnectionStatus,
  roomCode: null as string | null,
  playerId: null as string | null,
  symbol: null as string | null,
  role: null as string | null,
  errorMessage: null as string | null,
  roomClosed: false,
  roomClosedReason: null as string | null,
  gameState: null as GameState | null,
});

let socket: WebSocket | null = null;
let manualClose = false;
let pendingMessages: string[] = [];

const isConnected = computed(() => state.connectionStatus === 'connected');
const isSpectator = computed(() => state.role === 'spectator');

const ensureConnected = async (force = false): Promise<void> => {
  if (!force && socket) {
    return;
  }
  await connect();
};

const connect = async (): Promise<void> => {
  closeSocket();
  state.connectionStatus = 'connecting';
  state.errorMessage = null;
  try {
    manualClose = false;
    socket = new WebSocket(state.serverUrl);
    socket.addEventListener('open', () => {
      state.connectionStatus = 'connected';
      pendingMessages.forEach((message) => socket?.send(message));
      pendingMessages = [];
    });
    socket.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') {
        return;
      }
      handleMessage(event.data);
    });
    socket.addEventListener('error', () => {
      state.errorMessage = 'Connexion interrompue.';
      state.connectionStatus = 'error';
    });
    socket.addEventListener('close', () => {
      if (manualClose) {
        return;
      }
      state.connectionStatus = 'disconnected';
    });
  } catch (error) {
    state.errorMessage = 'Impossible de se connecter au serveur.';
    state.connectionStatus = 'error';
  }
};

const closeSocket = (): void => {
  if (!socket) {
    return;
  }
  socket.close();
  socket = null;
  pendingMessages = [];
};

const send = (type: string, payload: Record<string, unknown>): void => {
  if (!socket) {
    return;
  }
  const message = JSON.stringify({ type, payload });
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(message);
    return;
  }
  if (socket.readyState === WebSocket.CONNECTING) {
    pendingMessages.push(message);
  }
};

const normalizeState = (payload: Record<string, unknown>): GameState => {
  const rawBoard = Array.isArray(payload.board) ? payload.board : [];
  const board: string[][] = [];
  for (let row = 0; row < 6; row += 1) {
    const rawRow = Array.isArray(rawBoard[row]) ? rawBoard[row] : [];
    const values = rawRow.map((cell) => (typeof cell === 'string' ? cell : ''));
    while (values.length < 7) {
      values.push('');
    }
    board.push(values.slice(0, 7));
  }
  const players = (payload.players ?? {}) as Record<string, PlayerInfo>;
  const lastMoveRaw = payload.last_move as LastMove | undefined;
  const lastMove = lastMoveRaw && typeof lastMoveRaw.row === 'number' ? lastMoveRaw : null;
  const winningCellsRaw = Array.isArray(payload.winning_cells) ? payload.winning_cells : [];
  const winningCells = winningCellsRaw.filter((cell) =>
    cell && typeof cell.row === 'number' && typeof cell.col === 'number',
  ) as CellCoord[];
  return {
    roomCode: typeof payload.room_code === 'string' ? payload.room_code : '',
    board,
    turn: typeof payload.turn === 'string' ? payload.turn : 'R',
    status: typeof payload.status === 'string' ? payload.status : 'waiting',
    winner: typeof payload.winner === 'string' ? payload.winner : '',
    players,
    lastMove,
    winningCells,
  };
};

const applyRoomResponse = (payload: RoomResponsePayload): void => {
  state.roomCode = payload.room_code ?? state.roomCode;
  state.playerId = payload.player_id ?? state.playerId;
  const incomingSymbol = payload.symbol;
  if (incomingSymbol) {
    state.symbol = incomingSymbol;
  }
  state.role = payload.role ?? state.role;
  if (state.role === 'spectator') {
    state.symbol = null;
  }
  if (payload.state && typeof payload.state === 'object') {
    state.gameState = normalizeState(payload.state as Record<string, unknown>);
  }
};

const applyState = (payload: Record<string, unknown>): void => {
  state.gameState = normalizeState(payload);
};

const handleMessage = (raw: string): void => {
  let decoded: IncomingMessage | null = null;
  try {
    decoded = JSON.parse(raw) as IncomingMessage;
  } catch (error) {
    return;
  }
  const type = decoded?.type ?? '';
  const payload = (decoded?.payload ?? {}) as Record<string, unknown>;
  switch (type) {
    case 'room_created':
    case 'room_joined':
      applyRoomResponse(payload as RoomResponsePayload);
      break;
    case 'state':
      applyState(payload);
      break;
    case 'player_left':
      state.errorMessage = isSpectator.value
        ? 'Joueur deconnecte. Il a 1 minute pour revenir.'
        : 'Adversaire deconnecte. Il a 1 minute pour revenir.';
      break;
    case 'room_closed':
      state.roomClosed = true;
      state.roomClosedReason = typeof payload.reason === 'string' ? payload.reason : 'room_closed';
      state.connectionStatus = 'disconnected';
      break;
    case 'error':
      state.errorMessage = typeof payload.message === 'string' ? payload.message : 'Erreur inconnue.';
      break;
    default:
      break;
  }
};

const createRoom = async (name: string): Promise<void> => {
  state.roomClosed = false;
  state.roomClosedReason = null;
  state.errorMessage = null;
  await ensureConnected();
  send('create_room', { name });
};

const joinRoom = async (code: string, name: string, spectator = false): Promise<void> => {
  state.roomClosed = false;
  state.roomClosedReason = null;
  state.errorMessage = null;
  await ensureConnected();
  send('join_room', { room_code: code.toUpperCase(), name, spectator });
};

const reconnect = async (): Promise<void> => {
  if (!state.roomCode || !state.playerId) {
    state.errorMessage = 'Aucune session a reconnecter.';
    return;
  }
  state.roomClosed = false;
  state.roomClosedReason = null;
  state.errorMessage = null;
  await ensureConnected(true);
  send('join_room', {
    room_code: state.roomCode,
    player_id: state.playerId,
    spectator: isSpectator.value,
  });
};

const sendMove = (column: number): void => {
  if (!state.roomCode || !state.playerId) {
    return;
  }
  if (isSpectator.value || !isConnected.value) {
    return;
  }
  send('move', { room_code: state.roomCode, player_id: state.playerId, column });
};

const requestRematch = (): void => {
  if (!state.roomCode || !state.playerId) {
    return;
  }
  if (isSpectator.value || !isConnected.value) {
    return;
  }
  send('rematch', { room_code: state.roomCode, player_id: state.playerId });
};

const leaveRoom = (): void => {
  manualClose = true;
  closeSocket();
  state.roomCode = null;
  state.playerId = null;
  state.symbol = null;
  state.role = null;
  state.gameState = null;
  state.roomClosed = false;
  state.roomClosedReason = null;
  state.errorMessage = null;
  state.connectionStatus = 'disconnected';
};

export const useGame = () => ({
  state,
  isConnected,
  isSpectator,
  createRoom,
  joinRoom,
  reconnect,
  sendMove,
  requestRematch,
  leaveRoom,
});
