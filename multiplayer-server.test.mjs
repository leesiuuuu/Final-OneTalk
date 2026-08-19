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

test('개인 방은 최대 4명이 참가하고 게스트 준비 후 방장이 시작한다', async () => {
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

    for (const playerId of ['member2', 'member3']) {
      const ready = await post(base, `/api/rooms/${code}/ready`, { playerId, ready: true });
      assert.equal(ready.data.status, 'waiting');
    }
    const finalReady = await post(base, `/api/rooms/${code}/ready`, { playerId: 'member4', ready: true });
    assert.equal(finalReady.data.status, 'waiting');
    const denied = await post(base, `/api/rooms/${code}/start`, { playerId: 'member2' });
    assert.equal(denied.status, 400);
    const started = await post(base, `/api/rooms/${code}/start`, { playerId: 'owner4' });
    assert.equal(started.data.status, 'starting');
    assert.ok(started.data.startAt > Date.now());
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
    assert.equal(me.score, 2200);
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
    assert.deepEqual(changed.data.settings, { maxWords: 14, secondsPerWord: 1.2, roundCount: 10, useAI: false });
    assert.ok(changed.data.players.filter(player => !player.isHost).every(player => player.ready === false));

    const upperBound = await post(base, `/api/rooms/${code}/settings`, { playerId: 'difficulty-owner', maxWords: 25, secondsPerWord: 1 });
    assert.equal(upperBound.status, 200);
    assert.equal(upperBound.data.settings.maxWords, 25);

    const invalid = await post(base, `/api/rooms/${code}/settings`, { playerId: 'difficulty-owner', maxWords: 30, secondsPerWord: 0.2 });
    assert.equal(invalid.status, 400);
  });
});

test('친구 방 생성 시 선택한 세부 규칙을 바로 적용한다', async () => {
  await withServer(async base => {
    const created = await post(base, '/api/rooms', {
      playerId: 'custom-owner', nickname: '설정방장', difficulty: 'enterprise',
      settings: { maxWords: 21, secondsPerWord: 1.7 },
    });
    assert.equal(created.status, 201);
    assert.deepEqual(created.data.settings, { maxWords: 21, secondsPerWord: 1.7, roundCount: 10, useAI: false });

    const invalid = await post(base, '/api/rooms', {
      playerId: 'invalid-owner', nickname: '오류방', difficulty: 'startup',
      settings: { maxWords: 26, secondsPerWord: 0.5 },
    });
    assert.equal(invalid.status, 400);
  });
});

test('게임 시작 후 나간 참가자는 이탈 상태로 모든 플레이어에게 표시된다', async () => {
  await withServer(async base => {
    const owner = await post(base, '/api/rooms', { playerId: 'leave-owner', nickname: '남은사람', difficulty: 'startup' });
    const code = owner.data.code;
    await post(base, `/api/rooms/${code}/join`, { playerId: 'leave-guest', nickname: '나간사람', difficulty: 'startup' });
    await post(base, `/api/rooms/${code}/ready`, { playerId: 'leave-guest', ready: true });
    await post(base, `/api/rooms/${code}/start`, { playerId: 'leave-owner' });
    await post(base, '/api/match/cancel', { playerId: 'leave-guest' });

    const updated = await post(base, `/api/rooms/${code}/progress`, { playerId: 'leave-owner', round: 2, progress: 0.2, score: 50 });
    const departed = updated.data.players.find(player => player.playerId === 'leave-guest');
    assert.equal(departed.left, true);
    assert.equal(departed.finished, true);
  });
});

test('대기실 방장이 나가면 친구 방이 파괴된다', async () => {
  await withServer(async base => {
    const owner = await post(base, '/api/rooms', { playerId: 'host-leave', nickname: '기존방장', difficulty: 'startup' });
    const code = owner.data.code;
    await post(base, `/api/rooms/${code}/join`, { playerId: 'next-host', nickname: '새방장', difficulty: 'startup' });
    await post(base, '/api/match/cancel', { playerId: 'host-leave' });
    const updated = await post(base, `/api/rooms/${code}/ready`, { playerId: 'next-host', ready: true });
    assert.equal(updated.status, 400);
    assert.match(updated.data.error, /방을 찾을 수 없습니다/);
  });
});

test('라운드 수와 어절 규칙이 모든 참가자에게 동일하게 적용된다', async () => {
  await withServer(async base => {
    const owner = await post(base, '/api/rooms', {
      playerId: 'rule-owner', nickname: '방장', difficulty: 'sme',
      settings: { maxWords: 25, secondsPerWord: 1.3, roundCount: 6, useAI: false },
    });
    const code = owner.data.code;
    const guest = await post(base, `/api/rooms/${code}/join`, { playerId: 'rule-guest', nickname: '손님', difficulty: 'startup' });
    assert.deepEqual(guest.data.settings, { maxWords: 25, secondsPerWord: 1.3, roundCount: 6, useAI: false });
    assert.equal(guest.data.settingsVersion, 1);
    const changed = await post(base, `/api/rooms/${code}/settings`, {
      playerId: 'rule-owner', maxWords: 7, secondsPerWord: 3.2, roundCount: 4, useAI: false,
    });
    assert.equal(changed.data.settingsVersion, 2);
    assert.deepEqual(changed.data.settings, { maxWords: 7, secondsPerWord: 3.2, roundCount: 4, useAI: false });
  });
});

test('대기실 채팅과 게임 중 선점 어절을 서버가 최초 1명만 인정한다', async () => {
  await withServer(async base => {
    const owner = await post(base, '/api/rooms', { playerId: 'battle-owner', nickname: '방장', difficulty: 'startup' });
    const code = owner.data.code;
    await post(base, `/api/rooms/${code}/join`, { playerId: 'battle-guest', nickname: '상대', difficulty: 'startup' });
    const chat = await post(base, `/api/rooms/${code}/chat`, { playerId: 'battle-guest', message: '준비됐어요!' });
    assert.equal(chat.data.latestChat.message, '준비됐어요!');
    assert.equal('messages' in chat.data, false);
    const ready = await post(base, `/api/rooms/${code}/ready`, { playerId: 'battle-guest', ready: true });
    assert.equal(ready.data.latestChat, null);
    await post(base, `/api/rooms/${code}/start`, { playerId: 'battle-owner' });
    const sprint = await post(base, `/api/rooms/${code}/sprint-claim`, { playerId: 'battle-owner', round: 0, wordIndex: 2 });
    assert.equal(sprint.status, 200);
    assert.equal(sprint.data.latestSprint.penaltyMs, 2000);
    assert.equal(sprint.data.latestSprint.winnerId, 'battle-owner');
    const late = await post(base, `/api/rooms/${code}/sprint-claim`, { playerId: 'battle-guest', round: 0, wordIndex: 2 });
    assert.equal(late.status, 200);
    assert.equal(late.data.latestSprint.winnerId, 'battle-owner');

    await post(base, `/api/rooms/${code}/finish`, { playerId: 'battle-owner', round: 10, progress: 1, score: 100 });
    const resultChat = await post(base, `/api/rooms/${code}/chat`, { playerId: 'battle-owner', message: '수고하셨습니다!' });
    assert.equal(resultChat.status, 200);
    assert.equal(resultChat.data.latestChat.message, '수고하셨습니다!');
  });
});

test('모든 참가자가 답변을 마쳐야 라운드 중간 점검으로 전환된다', async () => {
  await withServer(async base => {
    const owner = await post(base, '/api/rooms', {
      playerId: 'round-owner', nickname: '방장', difficulty: 'startup',
      settings: { maxWords: 8, secondsPerWord: 2.5, roundCount: 3, useAI: false },
    });
    const code = owner.data.code;
    await post(base, `/api/rooms/${code}/join`, { playerId: 'round-guest', nickname: '상대', difficulty: 'startup' });
    await post(base, `/api/rooms/${code}/ready`, { playerId: 'round-guest', ready: true });
    await post(base, `/api/rooms/${code}/start`, { playerId: 'round-owner' });

    const first = await post(base, `/api/rooms/${code}/round-complete`, {
      playerId: 'round-owner', round: 0, roundScore: 91.5, score: 91.5,
    });
    assert.equal(first.data.roundState.phase, 'playing');
    assert.equal(first.data.players.find(player => player.isMe).completedRound, 0);

    const second = await post(base, `/api/rooms/${code}/round-complete`, {
      playerId: 'round-guest', round: 0, roundScore: 82, score: 82,
    });
    assert.equal(second.data.roundState.phase, 'review');
    assert.ok(second.data.roundState.nextRoundAt > Date.now());
    assert.equal(second.data.players.find(player => player.playerId === 'round-guest').roundScore, 82);

    const earlyNextRound = await post(base, `/api/rooms/${code}/round-complete`, {
      playerId: 'round-owner', round: 1, roundScore: 90, score: 181.5,
    });
    assert.equal(earlyNextRound.status, 400);
  });
});

test('빠른 매칭은 서로 다른 두 참가자를 같은 방에 연결한다', async () => {
  await withServer(async base => {
    const first = await post(base, '/api/match/quick', { playerId: 'quick-one', nickname: '빠른1', difficulty: 'sme' });
    const second = await post(base, '/api/match/quick', { playerId: 'quick-two', nickname: '빠른2', difficulty: 'sme' });
    assert.equal(first.status, 202);
    assert.equal(first.data.waitingCount, 1);
    assert.equal(second.data.waitingCount, 2);
    await new Promise(resolve => setTimeout(resolve, 1900));

    const eventResponse = await fetch(`${base}/api/match/events?playerId=quick-one`);
    const reader = eventResponse.body.getReader();
    const { value } = await reader.read();
    await reader.cancel();
    const event = new TextDecoder().decode(value);
    assert.match(event, /event: matched/);
    const payload = JSON.parse(event.match(/data: (.+)/)[1]);
    assert.equal(payload.kind, 'quick');
    assert.equal(payload.status, 'starting');
    assert.equal(payload.players.length, 2);
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
