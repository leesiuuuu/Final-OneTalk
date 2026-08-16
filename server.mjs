import http from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getHiveRanks,
  hiveConfig,
  requestHiveMatch,
  submitHiveScore,
  verifyHiveSignature,
} from './hive-server.mjs';

const SOURCE_ROOT = fileURLToPath(new URL('.', import.meta.url));
const DIST_ROOT = join(SOURCE_ROOT, 'dist');
const ROOT = existsSync(join(DIST_ROOT, 'index.html')) ? DIST_ROOT : SOURCE_ROOT;
const PORT = Number(process.env.PORT || 8080);
const hive = hiveConfig();
const rooms = new Map();
const playerRooms = new Map();
const quickQueue = [];
const localRanks = new Map();
const waitingStreams = new Map();
const quickTimers = new Map();
const startedAt = Date.now();

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon',
};

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error('요청 본문이 너무 큽니다.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function safePlayer(input = {}) {
  const playerId = String(input.playerId ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  const nickname = String(input.nickname ?? '지원자').replace(/[<>&"']/g, '').trim().slice(0, 12) || '지원자';
  const difficulty = ['startup', 'sme', 'enterprise'].includes(input.difficulty) ? input.difficulty : 'startup';
  if (!playerId) throw new Error('playerId가 필요합니다.');
  return { playerId, nickname, difficulty, rating: Number(input.rating) || 1000 };
}

function safeRoomSettings(input, fallback) {
  if (!input) return { ...fallback };
  const maxWords = Math.round(Number(input.maxWords));
  const secondsPerWord = Math.round(Number(input.secondsPerWord) * 10) / 10;
  if (!Number.isFinite(maxWords) || maxWords < 5 || maxWords > 25) throw new Error('최대 어절 수는 5~25로 설정해 주세요.');
  if (!Number.isFinite(secondsPerWord) || secondsPerWord < 1 || secondsPerWord > 4) throw new Error('어절당 제한 시간은 1.0~4.0초로 설정해 주세요.');
  return { maxWords, secondsPerWord };
}

function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do code = Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  while (rooms.has(code));
  return code;
}

function publicRoom(room, viewerId) {
  return {
    code: room.code,
    status: room.status,
    difficulty: room.difficulty,
    startAt: room.startAt,
    provider: room.provider,
    kind: room.kind,
    settings: room.settings,
    players: [...room.players.values()].map(player => ({
      playerId: player.playerId,
      nickname: player.nickname,
      round: player.round,
      progress: player.progress,
      score: player.score,
      finished: player.finished,
      ready: player.ready,
      isHost: player.playerId === room.ownerId,
      isMe: player.playerId === viewerId,
    })),
  };
}

function emit(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function openEventStream(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(': connected\n\n');
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15000);
  req.on('close', () => clearInterval(heartbeat));
}

function broadcast(room, event = 'room') {
  for (const [playerId, clients] of room.streams) {
    for (const res of clients) emit(res, event, publicRoom(room, playerId));
  }
}

function createRoom(owner, provider = 'local', requestedCode, kind = 'private', requestedSettings) {
  const code = requestedCode || makeCode();
  const defaults = {
    startup: { maxWords: 8, secondsPerWord: 2.5 },
    sme: { maxWords: 12, secondsPerWord: 2 },
    enterprise: { maxWords: 16, secondsPerWord: 1.5 },
  };
  const room = {
    code, provider, kind, ownerId: owner.playerId, difficulty: owner.difficulty, status: 'waiting', startAt: null,
    settings: safeRoomSettings(requestedSettings, defaults[owner.difficulty]),
    players: new Map(), streams: new Map(), createdAt: Date.now(),
  };
  addPlayer(room, owner);
  rooms.set(code, room);
  return room;
}

function addPlayer(room, input) {
  if (room.players.size >= 4 && !room.players.has(input.playerId)) throw new Error('방이 가득 찼습니다.');
  const player = room.players.get(input.playerId) ?? {
    playerId: input.playerId, nickname: input.nickname, round: 0, progress: 0,
    score: 0, finished: false, ready: false,
  };
  room.players.set(input.playerId, player);
  playerRooms.set(input.playerId, room.code);
  broadcast(room);
  return player;
}

function startRoom(room) {
  if (room.status !== 'waiting' || room.players.size < 2) return;
  room.status = 'starting';
  room.startAt = Date.now() + 4200;
  broadcast(room);
}

function scheduleQuickMatch(difficulty) {
  if (quickTimers.has(difficulty)) return;
  const timer = setTimeout(() => {
    quickTimers.delete(difficulty);
    const candidates = quickQueue.filter(player => player.difficulty === difficulty).slice(0, 4);
    if (candidates.length < 2) {
      if (candidates.length) scheduleQuickMatch(difficulty);
      return;
    }
    for (const player of candidates) quickQueue.splice(quickQueue.indexOf(player), 1);
    const room = createRoom(candidates[0], 'local', undefined, 'quick');
    candidates.slice(1).forEach(player => addPlayer(room, player));
    room.players.forEach(player => { player.ready = true; });
    startRoom(room);
    candidates.forEach(player => notifyWaitingPlayer(player.playerId, room));
    if (quickQueue.some(player => player.difficulty === difficulty)) scheduleQuickMatch(difficulty);
  }, 1800);
  quickTimers.set(difficulty, timer);
}

function notifyWaitingPlayer(playerId, room) {
  const clients = waitingStreams.get(playerId) ?? [];
  for (const res of clients) emit(res, 'matched', publicRoom(room, playerId));
  waitingStreams.delete(playerId);
}

function findRoom(code, playerId) {
  const room = rooms.get(String(code).toUpperCase());
  if (!room) throw new Error('방을 찾을 수 없습니다.');
  if (playerId && !room.players.has(playerId)) throw new Error('이 방의 참가자가 아닙니다.');
  return room;
}

function updatePlayer(room, playerId, input) {
  const player = room.players.get(playerId);
  if (!player) throw new Error('참가자를 찾을 수 없습니다.');
  player.round = Math.max(0, Math.min(10, Math.floor(Number(input.round) || 0)));
  player.progress = Math.max(0, Math.min(1, Number(input.progress) || 0));
  player.score = Math.max(0, Math.min(1100, Number(input.score) || 0));
  if (input.finished) player.finished = true;
  if ([...room.players.values()].every(item => item.finished)) room.status = 'finished';
  broadcast(room, input.finished ? 'finish' : 'progress');
}

function cancelPlayer(playerId) {
  for (let index = quickQueue.length - 1; index >= 0; index -= 1) {
    if (quickQueue[index].playerId === playerId) quickQueue.splice(index, 1);
  }
  const code = playerRooms.get(playerId);
  const room = code ? rooms.get(code) : null;
  if (room?.status === 'waiting') {
    room.players.delete(playerId);
    room.streams.get(playerId)?.forEach(res => res.end());
    room.streams.delete(playerId);
    if (room.players.size === 0) rooms.delete(code);
    else broadcast(room);
  }
  playerRooms.delete(playerId);
}

async function api(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(res, 200, {
      ok: true,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      rooms: rooms.size,
      waitingPlayers: quickQueue.length,
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/config') {
    return sendJson(res, 200, { hiveEnabled: hive.enabled, provider: hive.enabled ? 'hive' : 'local' });
  }

  if (req.method === 'POST' && url.pathname === '/api/rooms') {
    const input = JSON.parse((await readBody(req)).toString() || '{}');
    const owner = safePlayer(input);
    const room = createRoom(owner, 'local', undefined, 'private', input.settings);
    return sendJson(res, 201, publicRoom(room, owner.playerId));
  }

  let match = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)\/join$/i);
  if (req.method === 'POST' && match) {
    const player = safePlayer(JSON.parse((await readBody(req)).toString() || '{}'));
    const room = findRoom(match[1]);
    if (room.status !== 'waiting' && !room.players.has(player.playerId)) throw new Error('이미 시작된 방입니다.');
    if (room.difficulty !== player.difficulty) player.difficulty = room.difficulty;
    addPlayer(room, player);
    return sendJson(res, 200, publicRoom(room, player.playerId));
  }

  if (req.method === 'POST' && url.pathname === '/api/match/quick') {
    const player = safePlayer(JSON.parse((await readBody(req)).toString() || '{}'));
    if (hive.enabled) {
      await requestHiveMatch(player, hive);
      return sendJson(res, 202, { waiting: true, provider: 'hive', playerId: player.playerId });
    }
    if (!quickQueue.some(item => item.playerId === player.playerId)) quickQueue.push({ ...player, queuedAt: Date.now() });
    scheduleQuickMatch(player.difficulty);
    return sendJson(res, 202, { waiting: true, provider: 'local', playerId: player.playerId });
  }

  if (req.method === 'GET' && url.pathname === '/api/match/events') {
    const playerId = url.searchParams.get('playerId');
    openEventStream(req, res);
    const code = playerRooms.get(playerId);
    if (code) emit(res, 'matched', publicRoom(rooms.get(code), playerId));
    else {
      const clients = waitingStreams.get(playerId) ?? new Set();
      clients.add(res); waitingStreams.set(playerId, clients);
      req.on('close', () => clients.delete(res));
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/match/cancel') {
    const input = JSON.parse((await readBody(req)).toString() || '{}');
    cancelPlayer(String(input.playerId ?? ''));
    return sendJson(res, 200, { ok: true });
  }

  match = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)\/events$/i);
  if (req.method === 'GET' && match) {
    const playerId = url.searchParams.get('playerId');
    const room = findRoom(match[1], playerId);
    openEventStream(req, res);
    const clients = room.streams.get(playerId) ?? new Set();
    clients.add(res); room.streams.set(playerId, clients);
    emit(res, 'room', publicRoom(room, playerId));
    req.on('close', () => clients.delete(res));
    return;
  }

  match = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)\/ready$/i);
  if (req.method === 'POST' && match) {
    const input = JSON.parse((await readBody(req)).toString() || '{}');
    const room = findRoom(match[1], input.playerId);
    room.players.get(input.playerId).ready = Boolean(input.ready);
    if (room.players.size >= 2 && [...room.players.values()].every(player => player.ready)) startRoom(room);
    else broadcast(room);
    return sendJson(res, 200, publicRoom(room, input.playerId));
  }

  match = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)\/settings$/i);
  if (req.method === 'POST' && match) {
    const input = JSON.parse((await readBody(req)).toString() || '{}');
    const room = findRoom(match[1], input.playerId);
    if (room.kind !== 'private') throw new Error('친구 방에서만 규칙을 변경할 수 있습니다.');
    if (room.ownerId !== input.playerId) throw new Error('방장만 규칙을 변경할 수 있습니다.');
    if (room.status !== 'waiting') throw new Error('게임 시작 후에는 규칙을 변경할 수 없습니다.');
    room.settings = safeRoomSettings(input, room.settings);
    room.players.forEach(player => { player.ready = false; });
    broadcast(room);
    return sendJson(res, 200, publicRoom(room, input.playerId));
  }

  match = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)\/(progress|finish)$/i);
  if (req.method === 'POST' && match) {
    const input = JSON.parse((await readBody(req)).toString() || '{}');
    const room = findRoom(match[1], input.playerId);
    updatePlayer(room, input.playerId, { ...input, finished: match[2] === 'finish' });
    if (match[2] === 'finish') {
      localRanks.set(input.playerId, { playerId: input.playerId, nickname: room.players.get(input.playerId).nickname, score: room.players.get(input.playerId).score, at: Date.now() });
      if (hive.enabled && hive.leaderboardId) await submitHiveScore(input.playerId, input.score, { difficulty: room.difficulty }, hive);
    }
    return sendJson(res, 200, publicRoom(room, input.playerId));
  }

  if (req.method === 'POST' && url.pathname === '/api/hive/matchmaking/callback') {
    const raw = await readBody(req);
    if (!verifyHiveSignature(raw, req.headers['x-match-signature'], hive.callbackSecret)) return sendJson(res, 401, { error: 'invalid signature' });
    const payload = JSON.parse(raw.toString());
    for (const matching of payload.matchingInfos ?? []) {
      const players = matching.privateInfos ?? matching.teamInfos?.flatMap(team => team.playerInfos ?? []) ?? [];
      if (players.length < 2) continue;
      const parsed = players.slice(0, 4).map(item => {
        let extra = {}; try { extra = JSON.parse(item.extraData ?? '{}'); } catch {}
        return safePlayer({ playerId: item.playerId, nickname: extra.nickname, difficulty: extra.difficulty });
      });
      const room = createRoom(parsed[0], 'hive', undefined, 'quick');
      parsed.slice(1).forEach(player => addPlayer(room, { ...player, difficulty: room.difficulty }));
      room.players.forEach(player => { player.ready = true; });
      startRoom(room);
      parsed.forEach(player => notifyWaitingPlayer(player.playerId, room));
    }
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/leaderboard') {
    if (hive.enabled && hive.leaderboardId) return sendJson(res, 200, await getHiveRanks(url.searchParams.get('playerId'), hive));
    const ranks = [...localRanks.values()].sort((a, b) => b.score - a.score).slice(0, 20).map((item, index) => ({ rank: index + 1, ...item }));
    return sendJson(res, 200, { ranks, provider: 'local' });
  }
  return false;
}

async function serveStatic(req, res, url) {
  const requested = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const resolved = normalize(join(ROOT, requested));
  if (!resolved.startsWith(normalize(ROOT))) return sendJson(res, 403, { error: 'forbidden' });
  try {
    const data = await readFile(resolved);
    res.writeHead(200, { 'Content-Type': MIME[extname(resolved)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: 'not found' });
  }
}

export function createAppServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    try {
      if (url.pathname.startsWith('/api/')) {
        const handled = await api(req, res, url);
        if (handled === false) sendJson(res, 404, { error: 'API를 찾을 수 없습니다.' });
      } else await serveStatic(req, res, url);
    } catch (error) {
      if (!res.headersSent) sendJson(res, 400, { error: error.message });
      else res.end();
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createAppServer().listen(PORT, '0.0.0.0', () => {
    console.log(`Intalk: 최종 한마디 서버: http://localhost:${PORT}`);
    console.log(`멀티플레이 제공자: ${hive.enabled ? `Hive ${hive.mode}` : '로컬 테스트'}`);
  });
}

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const maxAge = room.status === 'finished' ? 30 * 60 * 1000 : 2 * 60 * 60 * 1000;
    if (now - room.createdAt <= maxAge) continue;
    room.streams.forEach(clients => clients.forEach(res => res.end()));
    room.players.forEach(player => playerRooms.delete(player.playerId));
    rooms.delete(code);
  }
  for (let index = quickQueue.length - 1; index >= 0; index -= 1) {
    if (now - (quickQueue[index].queuedAt ?? now) > 10 * 60 * 1000) quickQueue.splice(index, 1);
  }
}, 5 * 60 * 1000);
cleanupTimer.unref();
