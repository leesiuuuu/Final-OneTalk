import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { createAppServer } from './server.mjs';
import { verifyHiveSignature } from './hive-server.mjs';

async function withServer(run) {
  const server = createAppServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try { await run(`http://127.0.0.1:${port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

async function post(base, path, body) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}

test('개인 방은 최대 4명이 참가하고 전원 준비 후 시작한다', async () => {
  await withServer(async base => {
    const owner = await post(base, '/api/rooms', { playerId: 'owner4', nickname: '방장', difficulty: 'startup' });
    assert.equal(owner.status, 201);
    const code = owner.data.code;
    for (let index = 2; index <= 4; index += 1) {
      const joined = await post(base, `/api/rooms/${code}/join`, { playerId: `member${index}`, nickname: `지원자${index}`, difficulty: 'startup' });
      assert.equal(joined.status, 200);
      assert.equal(joined.data.players.length, index);
    }
    const overflow = await post(base, `/api/rooms/${code}/join`, { playerId: 'member5', nickname: '초과', difficulty: 'startup' });
    assert.equal(overflow.status, 400);

    for (const playerId of ['owner4', 'member2', 'member3']) {
      const ready = await post(base, `/api/rooms/${code}/ready`, { playerId, ready: true });
      assert.equal(ready.data.status, 'waiting');
    }
    const finalReady = await post(base, `/api/rooms/${code}/ready`, { playerId: 'member4', ready: true });
    assert.equal(finalReady.data.status, 'starting');
    assert.ok(finalReady.data.startAt > Date.now());
  });
});

test('진행도와 점수는 허용 범위로 제한된다', async () => {
  await withServer(async base => {
    const owner = await post(base, '/api/rooms', { playerId: 'score-owner', nickname: '점수', difficulty: 'sme' });
    const code = owner.data.code;
    const updated = await post(base, `/api/rooms/${code}/progress`, { playerId: 'score-owner', round: 99, progress: 9, score: 9999 });
    const me = updated.data.players.find(player => player.isMe);
    assert.equal(me.round, 10);
    assert.equal(me.progress, 1);
    assert.equal(me.score, 1100);
  });
});

test('친구 방 세부 규칙은 방장만 시작 전에 변경할 수 있다', async () => {
  await withServer(async base => {
    const owner = await post(base, '/api/rooms', { playerId: 'difficulty-owner', nickname: '방장', difficulty: 'startup' });
    const code = owner.data.code;
    await post(base, `/api/rooms/${code}/join`, { playerId: 'difficulty-guest', nickname: '손님', difficulty: 'startup' });
    await post(base, `/api/rooms/${code}/ready`, { playerId: 'difficulty-guest', ready: true });

    const denied = await post(base, `/api/rooms/${code}/settings`, { playerId: 'difficulty-guest', maxWords: 14, secondsPerWord: 1.2 });
    assert.equal(denied.status, 400);
    const changed = await post(base, `/api/rooms/${code}/settings`, { playerId: 'difficulty-owner', maxWords: 14, secondsPerWord: 1.2 });
    assert.equal(changed.status, 200);
    assert.deepEqual(changed.data.settings, { maxWords: 14, secondsPerWord: 1.2 });
    assert.ok(changed.data.players.every(player => player.ready === false));

    const upperBound = await post(base, `/api/rooms/${code}/settings`, { playerId: 'difficulty-owner', maxWords: 25, secondsPerWord: 1 });
    assert.equal(upperBound.status, 200);
    assert.equal(upperBound.data.settings.maxWords, 25);

    const invalid = await post(base, `/api/rooms/${code}/settings`, { playerId: 'difficulty-owner', maxWords: 30, secondsPerWord: 0.2 });
    assert.equal(invalid.status, 400);
  });
});

test('Hive 콜백 HMAC-SHA256 서명을 검증한다', () => {
  const body = Buffer.from('{"matchingInfos":[]}');
  const secret = 'callback-secret';
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64');
  assert.equal(verifyHiveSignature(body, signature, secret), true);
  assert.equal(verifyHiveSignature(body, 'wrong', secret), false);
});

test('Railway 상태 확인 API가 서버 상태를 반환한다', async () => {
  await withServer(async base => {
    const response = await fetch(`${base}/api/health`);
    const health = await response.json();
    assert.equal(response.status, 200);
    assert.equal(health.ok, true);
    assert.equal(typeof health.uptimeSeconds, 'number');
  });
});
