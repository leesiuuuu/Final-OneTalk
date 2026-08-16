const state = {
  playerId: localStorage.getItem('interview-player-id') || `p_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`,
  nickname: '', room: null, roomStream: null, matchStream: null, callbacks: {}, startedRoom: null,
  lastProgressAt: 0, pendingProgress: null, progressTimer: 0,
};
localStorage.setItem('interview-player-id', state.playerId);

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '멀티플레이 서버에 연결할 수 없습니다.');
  return data;
}

function playerData(nickname, difficulty) {
  state.nickname = nickname.trim().slice(0, 12) || '지원자';
  return { playerId: state.playerId, nickname: state.nickname, difficulty };
}

function closeStreams() {
  state.roomStream?.close();
  state.matchStream?.close();
  state.roomStream = null;
  state.matchStream = null;
}

function handleRoom(room) {
  state.room = room;
  state.callbacks.onRoom?.(room);
  if (room.status === 'starting' && state.startedRoom !== room.code) {
    state.startedRoom = room.code;
    state.callbacks.onMatchStart?.(room);
  }
}

function connectRoom(room) {
  state.matchStream?.close();
  state.matchStream = null;
  state.roomStream?.close();
  state.room = room;
  const stream = new EventSource(`/api/rooms/${room.code}/events?playerId=${encodeURIComponent(state.playerId)}`);
  state.roomStream = stream;
  ['room', 'progress', 'finish'].forEach(eventName => stream.addEventListener(eventName, event => handleRoom(JSON.parse(event.data))));
  stream.onerror = () => state.callbacks.onConnection?.('reconnecting');
  handleRoom(room);
}

function waitForMatch() {
  state.matchStream?.close();
  const stream = new EventSource(`/api/match/events?playerId=${encodeURIComponent(state.playerId)}`);
  state.matchStream = stream;
  stream.addEventListener('matched', event => connectRoom(JSON.parse(event.data)));
  stream.onerror = () => state.callbacks.onConnection?.('reconnecting');
}

export function configureMultiplayer(callbacks) {
  state.callbacks = callbacks;
}

export async function quickMatch(nickname, difficulty) {
  closeStreams();
  state.startedRoom = null;
  const result = await request('/api/match/quick', { method: 'POST', body: JSON.stringify(playerData(nickname, difficulty)) });
  if (result.code) connectRoom(result);
  else waitForMatch();
  return result;
}

export async function createPrivateRoom(nickname, difficulty) {
  closeStreams();
  state.startedRoom = null;
  const room = await request('/api/rooms', { method: 'POST', body: JSON.stringify(playerData(nickname, difficulty)) });
  connectRoom(room);
  return room;
}

export async function joinPrivateRoom(code, nickname, difficulty) {
  closeStreams();
  state.startedRoom = null;
  const room = await request(`/api/rooms/${encodeURIComponent(code.trim().toUpperCase())}/join`, {
    method: 'POST', body: JSON.stringify(playerData(nickname, difficulty)),
  });
  connectRoom(room);
  return room;
}

export async function setReady(ready = true) {
  if (!state.room) return null;
  return request(`/api/rooms/${state.room.code}/ready`, {
    method: 'POST', body: JSON.stringify({ playerId: state.playerId, ready }),
  });
}

export async function setRoomSettings(settings) {
  if (!state.room) return null;
  return request(`/api/rooms/${state.room.code}/settings`, {
    method: 'POST', body: JSON.stringify({ playerId: state.playerId, ...settings }),
  });
}

async function flushProgress() {
  state.progressTimer = 0;
  const payload = state.pendingProgress;
  state.pendingProgress = null;
  if (!state.room || !payload) return;
  state.lastProgressAt = performance.now();
  try {
    await request(`/api/rooms/${state.room.code}/progress`, {
      method: 'POST', body: JSON.stringify({ playerId: state.playerId, ...payload }),
    });
  } catch (error) {
    state.callbacks.onError?.(error.message);
  }
}

export function sendProgress(payload) {
  if (!state.room) return;
  state.pendingProgress = payload;
  const delay = Math.max(0, 120 - (performance.now() - state.lastProgressAt));
  if (!state.progressTimer) state.progressTimer = window.setTimeout(flushProgress, delay);
}

export async function finishMatch(payload) {
  if (!state.room) return null;
  return request(`/api/rooms/${state.room.code}/finish`, {
    method: 'POST', body: JSON.stringify({ playerId: state.playerId, ...payload }),
  });
}

export function leaveMultiplayer() {
  fetch('/api/match/cancel', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: state.playerId }), keepalive: true,
  }).catch(() => {});
  closeStreams();
  clearTimeout(state.progressTimer);
  state.room = null;
  state.startedRoom = null;
  state.pendingProgress = null;
}

export function multiplayerRoom() { return state.room; }
export function myPlayerId() { return state.playerId; }
