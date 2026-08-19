import { splitWords, evaluateAnswer, updateCombo } from './scoring.mjs';
import { interviewStage } from './src/interview-stage.ts';
import { audioSystem } from './src/audio-system.ts';
import {
  claimSprintWord, completeMultiplayerRound, configureMultiplayer, createPrivateRoom, finishMatch, joinPrivateRoom,
  leaveMultiplayer, multiplayerRoom, quickMatch, returnToLobby, sendLobbyChat, sendProgress, serverDelayUntil, setReady,
  setRoomSettings, signalMultiplayerExit, startPrivateRoom,
} from './multiplayer.mjs';

const CONFIG = {
  startup: { label: '스타트업', seconds: 2.5, pass: 0.6 },
  sme: { label: '중소기업', seconds: 2, pass: 0.7 },
  enterprise: { label: '대기업', seconds: 1.5, pass: 0.8 },
};

const QUESTIONS = {
  startup: [
    ['본인을 한 문장으로 소개해 주세요.', '저는 문제를 끝까지 해결하는 끈기 있는 지원자입니다'],
    ['우리 회사에 지원한 이유는 무엇인가요?', '빠르게 성장하며 새로운 가치를 함께 만들고 싶습니다'],
    ['본인의 가장 큰 강점은 무엇인가요?', '낯선 상황에서도 차분하게 해결책을 찾아 실행합니다'],
    ['협업할 때 중요하게 생각하는 것은?', '서로의 의견을 듣고 목표를 분명하게 맞추는 것입니다'],
    ['실패했던 경험을 말씀해 주세요.', '실패의 원인을 기록하고 다음 도전에 반드시 반영했습니다'],
    ['스트레스는 어떻게 관리하나요?', '할 일을 나누고 산책하며 생각을 다시 정리합니다'],
    ['입사 후 이루고 싶은 목표는?', '팀이 믿고 맡길 수 있는 동료가 되겠습니다'],
    ['갈등을 해결했던 경험이 있나요?', '상대의 관점을 먼저 듣고 공통 목표를 확인했습니다'],
    ['새로운 업무를 어떻게 배우나요?', '작게 실행하고 피드백을 받아 빠르게 개선합니다'],
    ['마지막으로 하고 싶은 말이 있나요?', '오늘의 떨림을 내일의 성과로 증명하겠습니다'],
  ],
  sme: [
    ['지원 직무에 본인이 적합한 이유는 무엇인가요?', '저는 고객의 문제를 관찰하고 실행 가능한 해결책으로 구체화해 왔습니다'],
    ['가장 어려웠던 프로젝트를 설명해 주세요.', '제한된 일정 속에서 우선순위를 정하고 팀의 결과를 완성했습니다'],
    ['동료와 의견이 다를 때 어떻게 하나요?', '사실과 가설을 구분해 논의하고 작은 실험으로 방향을 검증합니다'],
    ['업무 우선순위를 정하는 기준은 무엇인가요?', '고객 영향도와 긴급성을 기준으로 중요한 일부터 처리합니다'],
    ['본인의 단점을 어떻게 보완하고 있나요?', '완벽을 추구하는 성향을 마감 기준과 중간 공유로 조절합니다'],
    ['리더십을 발휘한 경험을 말해 주세요.', '역할이 모호한 상황에서 목표와 책임을 나누어 협업을 이끌었습니다'],
    ['예상치 못한 문제에 어떻게 대응하나요?', '영향 범위를 먼저 파악하고 가능한 대안을 빠르게 공유합니다'],
    ['고객의 불만을 해결한 경험이 있나요?', '불편의 원인을 직접 확인하고 해결 과정과 결과를 안내했습니다'],
    ['성과를 측정하는 본인만의 방식이 있나요?', '시작 전에 성공 기준을 수치로 정하고 과정마다 점검합니다'],
    ['입사 후 첫 세 달의 계획은 무엇인가요?', '업무 맥락을 배우고 작은 개선 성과로 신뢰를 쌓겠습니다'],
  ],
  enterprise: [
    ['급변하는 시장 환경에서 경쟁력을 유지할 방법은 무엇인가요?', '고객 행동의 변화를 데이터로 빠르게 포착하고 핵심 역량에 연결된 실험을 지속해야 합니다'],
    ['조직의 목표와 개인의 판단이 충돌하면 어떻게 하겠습니까?', '조직의 의사결정 배경을 먼저 이해하고 객관적인 근거와 대안을 책임 있게 제시하겠습니다'],
    ['복잡한 이해관계자를 설득했던 경험을 구체적으로 말해 주세요.', '각 부서의 목표와 우려를 구조화하고 공통 성과 지표를 제안해 합의를 이끌었습니다'],
    ['기존 프로세스를 혁신한 사례와 성과를 설명해 주세요.', '반복 업무의 병목을 측정하고 자동화 도구를 도입해 처리 시간을 절반으로 단축했습니다'],
    ['불확실한 상황에서 중요한 결정을 내리는 기준은 무엇입니까?', '되돌릴 수 있는 결정은 빠르게 실행하고 핵심 위험은 검증 가능한 단위로 줄입니다'],
    ['팀의 성과가 기대에 미치지 못했을 때 어떻게 대응했습니까?', '개인의 책임을 묻기 전에 목표와 자원의 정합성을 점검하고 실행 방식을 함께 개선했습니다'],
    ['윤리와 성과가 충돌하는 상황에서 어떤 선택을 하겠습니까?', '단기 성과보다 고객과 조직의 장기적인 신뢰를 지키는 원칙을 우선하겠습니다'],
    ['글로벌 협업에서 발생한 소통 문제를 어떻게 해결하겠습니까?', '문화적 차이를 존중하면서 결정 사항과 담당자를 문서로 명확히 남겨 오해를 줄이겠습니다'],
    ['본인이 주도한 가장 의미 있는 변화는 무엇이었습니까?', '사용자 피드백이 의사결정에 반영되는 정기 절차를 만들고 제품 만족도를 꾸준히 높였습니다'],
    ['회사가 당신을 채용해야 하는 이유를 마지막으로 말해 주세요.', '복잡한 문제를 끝까지 구조화하고 동료와 실행해 측정 가능한 결과를 만드는 사람이기 때문입니다'],
  ],
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const screens = { start: $('#start-screen'), lobby: $('#lobby-screen'), game: $('#game-screen'), result: $('#result-screen') };

let selectedDifficulty = 'startup';
let round = 0;
let committed = [];
let combo = 0;
let maxCombo = 0;
let duration = 0;
let remaining = 0;
let endAt = 0;
let timerId = 0;
let roundClosed = false;
let history = [];
let roundStartedAt = 0;
let lastCountdownSecond = null;
let roundSequence = 0;
let scoreAnimationId = 0;
let feedbackUnlockTimer = 0;
let feedbackAutoTimer = 0;
let feedbackCountdownTimer = 0;
let feedbackReady = false;
let inputComposing = false;
let commitSpaceAfterComposition = false;
let gameMode = 'single';
let multiplayerStartTimer = 0;
let multiplayerReviewTimer = 0;
let customRules = null;
let customQuestions = null;
let phaserDangerActive = false;
let lastSprintId = 0;
let aiQuestionsAvailable = false;
const leftPlayerIds = new Set();
const chatBubbleTimers = new Map();

function stopMultiplayerReviewTimer() {
  window.clearInterval(multiplayerReviewTimer);
  multiplayerReviewTimer = 0;
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, element]) => element.classList.toggle('hidden', key !== name));
  const active = screens[name];
  active.classList.remove('screen-enter');
  void active.offsetWidth;
  active.classList.add('screen-enter');
  audioSystem.setMood(name === 'game' ? 'game' : name === 'result' ? 'result' : name === 'lobby' ? 'lobby' : 'menu');
}

function flash(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 1500);
}

function currentPair() {
  const source = customQuestions?.length ? customQuestions : QUESTIONS[selectedDifficulty];
  const [question, answer] = source[round % source.length];
  if (!customRules) return [question, answer];
  return [question, splitWords(answer).slice(0, customRules.maxWords).join(' ')];
}

function roundCount() { return gameMode === 'multi' ? (customRules?.roundCount ?? 10) : 10; }

function multiplayerRoundEvent(roundIndex = round) {
  if (gameMode !== 'multi') return null;
  if (roundIndex === 2 || roundIndex === 8) return { scoreMultiplier: 2, message: '보너스 면접 · 이번 라운드 점수 2배' };
  if (roundIndex === 5) return { mistakePenaltyMultiplier: 2, message: '정밀 면접 · 오타 기본 점수 감소 2배' };
  return null;
}

function totalScore() { return history.reduce((sum, item) => sum + item.totalScore, 0); }

function syncProgress(forceRound = round) {
  if (gameMode !== 'multi' || !multiplayerRoom()) return;
  const wordCount = splitWords(currentPair()[1]).length;
  const partial = Math.min(1, (committed.length + ($('#word-input').value.trim() ? 0.4 : 0)) / wordCount);
  sendProgress({ round: forceRound + 1, progress: Math.min(1, (forceRound + partial) / roundCount()), score: totalScore() });
}

function renderLobby(room) {
  $('#lobby-room-code').textContent = room?.code ?? '-----';
  $('#copy-room-code').classList.toggle('hidden', !room?.code);
  const players = room?.players ?? [];
  const me = players.find(player => player.isMe);
  const isPostGame = Boolean(room && (room.status === 'finished' || room.roundState?.phase === 'final'));
  $('#lobby-players').innerHTML = Array.from({ length: 4 }, (_, index) => {
    const player = players[index];
    if (!player) return `<div class="lobby-player waiting"><span>SLOT ${index + 1}</span><strong>대기 중</strong></div>`;
    const status = player.left ? '방에서 나감' : isPostGame
      ? (player.isHost ? '방장 · 결과 확인 완료' : '게스트 · 결과 확인 완료')
      : player.isHost ? '방장 · 시작 담당' : player.ready ? '준비 완료' : '준비 필요';
    const indicator = player.left ? '×' : player.isHost ? 'H' : isPostGame ? '✓' : player.ready ? '✓' : '…';
    const slot = player.isMe ? (player.isHost ? 'YOU · HOST' : 'YOU · GUEST') : player.isHost ? 'HOST' : `PLAYER ${index + 1}`;
    return `<div class="lobby-player ${player.isHost ? 'host' : ''} ${player.ready && !isPostGame ? 'ready' : ''} ${player.isMe ? 'me' : ''}" data-player-id="${player.playerId}"><span class="player-slot">${slot}</span><i class="ready-indicator">${indicator}</i><strong>${player.nickname}</strong><small class="player-state">${status}</small></div>`;
  }).join('');
  if (!room) return;
  selectedDifficulty = room.difficulty;
  customRules = { ...room.settings };
  customQuestions = room.questions ?? null;
  const isStarting = room.status === 'starting' && !isPostGame;
  const isGenerating = room.status === 'generating';
  const canConfigure = room.kind === 'private' && room.status === 'waiting';
  $('#room-rules').classList.toggle('hidden', !canConfigure || !me?.isHost);
  $('#room-max-words').value = room.settings.maxWords;
  $('#room-seconds-per-word').value = room.settings.secondsPerWord;
  $('#room-round-count').value = room.settings.roundCount;
  $('#room-use-ai').checked = Boolean(room.settings.useAI);
  $('#room-max-words').disabled = !me?.isHost || !canConfigure;
  $('#room-seconds-per-word').disabled = !me?.isHost || !canConfigure;
  $('#room-round-count').disabled = !me?.isHost || !canConfigure;
  $('#room-use-ai').disabled = !me?.isHost || !canConfigure || !aiQuestionsAvailable;
  $('#save-room-rules').disabled = !me?.isHost || !canConfigure;
  $('#room-time-preview').textContent = `${(room.settings.maxWords * room.settings.secondsPerWord).toFixed(1)}초`;
  $('#room-rules-owner').textContent = canConfigure ? '방장 전용 · 변경 시 게스트 준비 해제' : '게임 규칙 잠김';
  const guestPlayers = players.filter(player => !player.isHost);
  const guestsReady = guestPlayers.length > 0 && guestPlayers.every(player => player.ready);
  $('#ready-button').classList.toggle('hidden', isPostGame || room.provider !== 'local' || isStarting || isGenerating || Boolean(me?.isHost));
  const readyButton = $('#ready-button');
  readyButton.disabled = false;
  readyButton.classList.toggle('is-ready', Boolean(me?.ready));
  readyButton.setAttribute('aria-pressed', String(Boolean(me?.ready)));
  readyButton.innerHTML = me?.ready
    ? '<div><strong>준비 완료</strong><small>방장의 시작을 기다리는 중 · 클릭하면 취소</small></div><b>✓</b>'
    : '<div><strong>준비하기</strong><small>방장에게 시작할 준비가 됐다고 알립니다</small></div><b>→</b>';
  $('#host-start-button').classList.toggle('hidden', isPostGame || room.kind !== 'private' || !me?.isHost || isStarting || isGenerating);
  $('#host-start-button').disabled = players.length < 2 || !guestsReady;
  $('#matching-loader').classList.toggle('loading', !isStarting && !isPostGame);
  $('#lobby-chat-form').classList.toggle('hidden', isStarting);
  $('#cancel-match-button').textContent = isPostGame ? '방 나가기' : '매칭 취소';
  $('#lobby-title').textContent = isPostGame ? '면접 종료 · 대기실' : isGenerating ? 'AI 면접 문장 생성 중' : isStarting ? `${players.length}인 면접 레이스 확정` : '지원자 대기실';
  $('#lobby-status').innerHTML = isPostGame
    ? '같은 방 참가자들과 이야기를 나눈 뒤 자유롭게 나갈 수 있습니다'
    : isGenerating
    ? '무료 AI가 질문과 답변을 만들고 있습니다<span class="waiting-dots">...</span>'
    : isStarting ? (room.aiFallback ? 'AI 생성이 지연되어 기본 면접 문장으로 시작합니다' : '곧 동시에 면접이 시작됩니다') : me?.isHost
      ? (guestsReady ? '모든 게스트 준비 완료 · 시작 버튼을 눌러 주세요' : `현재 ${players.length}/4명 · 게스트의 준비를 기다리는 중<span class="waiting-dots">...</span>`)
      : (me?.ready ? '준비 완료 · 방장의 시작을 기다리는 중' : '준비 버튼을 누르면 방장이 게임을 시작할 수 있습니다');
}

function showLobbyChat(chat) {
  if (!chat || screens.lobby.classList.contains('hidden')) return;
  const player = [...$('#lobby-players').children].find(item => item.dataset.playerId === chat.playerId);
  if (!player) return;
  player.querySelector('.player-chat-bubble')?.remove();
  clearTimeout(chatBubbleTimers.get(chat.playerId));
  const bubble = document.createElement('em');
  bubble.className = 'player-chat-bubble';
  bubble.textContent = chat.message;
  player.append(bubble);
  chatBubbleTimers.set(chat.playerId, window.setTimeout(() => {
    bubble.remove();
    chatBubbleTimers.delete(chat.playerId);
  }, 4200));
}

function renderResultChatPlayers(room) {
  const container = $('#result-chat-players');
  container.innerHTML = room.players.map(player => `
    <div class="result-chat-player ${player.isMe ? 'me' : ''} ${player.left ? 'left' : ''}" data-player-id="${player.playerId}">
      <i class="result-chat-avatar" aria-hidden="true"></i>
      <strong>${player.nickname}${player.isHost ? ' · 방장' : ''}${player.isMe ? ' · 나' : ''}</strong>
    </div>`).join('');
}

function showResultChat(chat) {
  if (!chat || screens.result.classList.contains('hidden')) return;
  const player = [...$('#result-chat-players').children].find(item => item.dataset.playerId === chat.playerId);
  if (!player) return;
  player.querySelector('.player-chat-bubble')?.remove();
  const timerKey = `result-${chat.playerId}`;
  clearTimeout(chatBubbleTimers.get(timerKey));
  const bubble = document.createElement('em');
  bubble.className = 'player-chat-bubble';
  bubble.textContent = chat.message;
  player.append(bubble);
  chatBubbleTimers.set(timerKey, window.setTimeout(() => {
    bubble.remove();
    chatBubbleTimers.delete(timerKey);
  }, 5200));
}

function renderMultiplayerRoom(room, eventName = 'room') {
  if (eventName === 'chat') {
    showLobbyChat(room.latestChat);
    showResultChat(room.latestChat);
    return;
  }
  renderLobby(room);
  room.players.filter(player => player.left).forEach(player => {
    if (!leftPlayerIds.has(player.playerId)) flash(`${player.nickname}님이 면접에서 나갔습니다`);
    leftPlayerIds.add(player.playerId);
  });
  const rivals = room.players.filter(player => !player.isMe);
  const me = room.players.find(player => player.isMe);
  $('#opponent-hud').classList.toggle('hidden', gameMode !== 'multi' || rivals.length === 0);
  $('#opponent-list').innerHTML = rivals.map(player => `
    <div class="opponent-row ${player.left ? 'left' : ''}">
      <div><strong>${player.nickname}</strong><small>${player.left ? '나감' : `Q${Math.max(1, player.round)}/${roundCount()}`}</small><b>${Math.round(player.score)}점</b></div>
      <div class="opponent-track"><i style="width:${player.progress * 100}%"></i></div>
    </div>`).join('');
  if (room.latestSprint?.id > lastSprintId) {
    lastSprintId = room.latestSprint.id;
    const sprint = room.latestSprint;
    if (sprint.winnerId !== me?.playerId && sprint.round === round && Date.now() - sprint.at < 5000 && !roundClosed) {
      endAt -= sprint.penaltyMs;
      document.body.classList.add('under-attack');
      window.setTimeout(() => document.body.classList.remove('under-attack'), 700);
      showRaceEvent(`${sprint.winnerName} 선점! 내 제한 시간 -2초`, 'sprint');
    } else if (sprint.winnerId === me?.playerId) {
      showRaceEvent('선점 성공! 상대 전원의 제한 시간 -2초', 'sprint');
    }
  }
  if (eventName === 'sprint') renderTargetGuide();
  if (!screens.result.classList.contains('hidden')) {
    renderMatchResult(room);
    renderResultChatPlayers(room);
    const canReturnToLobby = room.status === 'finished' || room.status === 'waiting';
    $('#restart-button').disabled = !canReturnToLobby;
    $('#restart-button').innerHTML = canReturnToLobby
      ? '방으로 돌아가기 <span>→</span>'
      : '결과 집계 중 <span>…</span>';
  }
  if (room.roundState?.phase === 'review') showSynchronizedRoundReview(room);
  if (eventName === 'round-start') advanceSynchronizedRound(room);
}

function showSynchronizedRoundReview(room) {
  if (gameMode !== 'multi' || screens.game.classList.contains('hidden')) return;
  stopMultiplayerReviewTimer();
  window.clearInterval(feedbackCountdownTimer);
  window.clearTimeout(feedbackAutoTimer);
  const reviewRoundIndex = room.roundState.index;
  const serverRemainingMs = Number(room.roundState.nextRoundInMs);
  const preciseRemainingMs = serverDelayUntil(room.roundState.nextRoundAt);
  const reviewDeadline = performance.now() + (room.roundState.nextRoundAt != null
    ? preciseRemainingMs
    : Number.isFinite(serverRemainingMs) ? Math.max(0, serverRemainingMs) : 0);
  const ranked = [...room.players].filter(player => !player.left).sort((a, b) => b.score - a.score);
  const panel = $('#round-review-panel');
  panel.classList.remove('hidden');
  panel.innerHTML = `<strong>ROUND ${room.roundState.index + 1} 중간 점검</strong>${ranked.map((player, index) => `
    <span class="round-review-row ${player.isMe ? 'me' : ''}"><b>${index + 1}위</b><span>${player.nickname}</span><em>+${player.roundScore.toFixed(1)}</em><b>${player.score.toFixed(1)}점</b></span>`).join('')}`;
  feedbackReady = false;
  $('#next-button').disabled = true;
  const updateCountdown = () => {
    const currentRoom = multiplayerRoom();
    const currentRoundState = currentRoom?.roundState;
    if (currentRoundState?.phase !== 'review' || currentRoundState.index !== reviewRoundIndex) {
      stopMultiplayerReviewTimer();
      return;
    }
    const remainingSeconds = Math.max(0, (reviewDeadline - performance.now()) / 1000);
    const totalRounds = Number(currentRoom.settings?.roundCount) || roundCount();
    const label = reviewRoundIndex >= totalRounds - 1 ? '최종 결과' : '다음 라운드';
    const countdownText = remainingSeconds > 0 ? `${remainingSeconds.toFixed(1)}초 후 ${label}` : `${label} 전환 대기 중`;
    $('#auto-next-hint').textContent = `모든 답변 확인 완료 · ${countdownText}`;
    $('#next-button').innerHTML = `${label} · ${remainingSeconds.toFixed(1)} <span>→</span>`;
  };
  updateCountdown();
  multiplayerReviewTimer = window.setInterval(updateCountdown, 100);
}

function advanceSynchronizedRound(room) {
  stopMultiplayerReviewTimer();
  if (gameMode !== 'multi' || screens.game.classList.contains('hidden')) return;
  if (room.roundState.phase === 'final') {
    showResults();
    return;
  }
  if (room.roundState.phase !== 'playing' || room.roundState.index <= round) return;
  round = room.roundState.index;
  beginRound();
}

function showRaceEvent(message, type = '') {
  const banner = $('#race-event-banner');
  banner.textContent = message;
  banner.className = `race-event-banner ${type}`;
  window.setTimeout(() => banner.classList.add('hidden'), 2200);
}

function renderMatchResult(room) {
  const panel = $('#match-result');
  const ranked = [...(room.lastResults?.length ? room.lastResults : room.players)].sort((a, b) => b.score - a.score);
  const mine = ranked.findIndex(player => player.isMe);
  panel.classList.remove('hidden');
  panel.innerHTML = `<strong>${mine >= 0 ? `${mine + 1}위 / ${ranked.length}명` : '집계 중'}</strong>${ranked.map((player, index) => `<span>${index + 1}. ${player.nickname} · ${player.score.toFixed(1)}점${player.left ? ' (나감)' : player.finished ? '' : ' (진행 중)'}</span>`).join('<br>')}`;
}

function scheduleMultiplayerStart(room) {
  clearTimeout(multiplayerStartTimer);
  selectedDifficulty = room.difficulty;
  customRules = { ...room.settings };
  customQuestions = room.questions ?? null;
  lastSprintId = room.latestSprint?.id ?? 0;
  audioSystem.matchFound();
  const countdownLength = 3000;
  const serverStartInMs = Number(room.startInMs);
  const preciseStartInMs = serverDelayUntil(room.startAt);
  const delay = Math.max(0, (room.startAt != null
    ? preciseStartInMs
    : Number.isFinite(serverStartInMs) ? serverStartInMs : countdownLength) - countdownLength);
  multiplayerStartTimer = window.setTimeout(beginGame, delay);
}

configureMultiplayer({
  onRoom: renderMultiplayerRoom,
  onMatchStart: scheduleMultiplayerStart,
  onError: flash,
  onConnection: () => flash('매칭 서버에 다시 연결하는 중입니다'),
  onDestroyed: reason => {
    clearTimeout(multiplayerStartTimer);
    showScreen('start');
    flash(reason);
  },
});

function renderTargetGuide() {
  const targets = splitWords(currentPair()[1]);
  const currentInput = $('#word-input').value.normalize('NFC');
  const container = $('#target-sentence');
  container.replaceChildren();

  targets.forEach((word, wordIndex) => {
    const token = document.createElement('span');
    token.className = 'target-word';
    if (wordIndex < committed.length) {
      token.classList.add(committed[wordIndex] === word ? 'target-cleared' : 'target-missed');
      token.textContent = word;
    } else if (wordIndex === committed.length) {
      token.classList.add('target-active');
      Array.from(word).forEach((character, charIndex) => {
        const glyph = document.createElement('i');
        glyph.textContent = character;
        if (charIndex < Array.from(currentInput).length) {
          glyph.className = Array.from(currentInput)[charIndex] === character ? 'char-hit' : 'char-miss';
        } else {
          glyph.className = 'char-pending';
        }
        token.append(glyph);
      });
    } else {
      token.textContent = word;
    }
    const sprint = multiplayerRoom()?.roundState;
    if (gameMode === 'multi' && sprint?.phase === 'playing' && wordIndex === sprint.sprintTargetIndex) {
      token.classList.add(multiplayerRoom()?.latestSprint ? 'sprint-claimed' : 'sprint-target');
    }
    container.append(token, document.createTextNode(' '));
  });
}

function updateSpeed() {
  const inputLength = Array.from($('#word-input').value.replace(/\s/gu, '')).length;
  const lockedLength = committed.reduce((sum, word) => sum + Array.from(word).length, 0);
  const elapsedMinutes = Math.max((performance.now() - roundStartedAt) / 60000, 1 / 60);
  const cpm = Math.round((lockedLength + inputLength) / elapsedMinutes);
  $('#cpm-count').textContent = String(Math.min(cpm, 999));
}

function retriggerClass(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

function animateQuestionScore(finalScore) {
  cancelAnimationFrame(scoreAnimationId);
  const display = $('#question-score');
  const total = display.parentElement;
  const startedAt = performance.now();
  const durationMs = 720;
  retriggerClass(total, 'score-pop');

  const draw = now => {
    const progress = Math.min((now - startedAt) / durationMs, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    display.textContent = (finalScore * eased).toFixed(1);
    if (progress < 1) scoreAnimationId = requestAnimationFrame(draw);
  };
  scoreAnimationId = requestAnimationFrame(draw);
}

function wait(milliseconds) {
  return new Promise(resolve => window.setTimeout(resolve, milliseconds));
}

function showRoundCountdown(value, label = '면접 시작까지', eventMessage = '') {
  const overlay = $('#round-countdown-overlay');
  const number = $('#round-countdown-value');
  const event = $('#countdown-event');
  $('#countdown-label').textContent = label;
  event.textContent = eventMessage;
  event.classList.toggle('hidden', !eventMessage);
  number.textContent = value;
  number.classList.remove('countdown-pop');
  void number.offsetWidth;
  number.classList.add('countdown-pop');
  overlay.classList.remove('hidden');
}

async function runRoundCountdown(sequence) {
  const roundEvent = multiplayerRoundEvent();
  const eventMessage = roundEvent ? `EVENT RULE · ${roundEvent.message}` : '';
  for (const value of ['3', '2', '1']) {
    if (sequence !== roundSequence) return false;
    showRoundCountdown(value, '면접 시작까지', eventMessage);
    audioSystem.countdown(value === '1');
    await wait(850);
  }
  if (sequence !== roundSequence) return false;
  showRoundCountdown('START!', '답변을 시작하세요', eventMessage);
  audioSystem.start();
  await wait(450);
  return sequence === roundSequence;
}

function beginGame() {
  audioSystem.unlock();
  if (gameMode === 'single') { customRules = null; customQuestions = null; }
  round = 0;
  history = [];
  $('#round-total').textContent = roundCount();
  showScreen('game');
  $('#difficulty-badge').textContent = CONFIG[selectedDifficulty].label;
  $('#question-source-badge').classList.toggle('hidden', !(gameMode === 'multi' && customQuestions?.length));
  $('#opponent-hud').classList.toggle('hidden', gameMode !== 'multi');
  $('#match-result').classList.add('hidden');
  beginRound();
}

async function beginRound() {
  const sequence = ++roundSequence;
  inputComposing = false;
  commitSpaceAfterComposition = false;
  window.clearTimeout(feedbackUnlockTimer);
  window.clearTimeout(feedbackAutoTimer);
  window.clearInterval(feedbackCountdownTimer);
  window.clearInterval(multiplayerReviewTimer);
  feedbackReady = false;
  const [question, answer] = currentPair();
  committed = [];
  combo = 0;
  maxCombo = 0;
  roundClosed = true;
  duration = splitWords(answer).length * (customRules?.secondsPerWord ?? CONFIG[selectedDifficulty].seconds);
  remaining = duration;
  lastCountdownSecond = null;

  $('#round-current').textContent = String(round + 1).padStart(2, '0');
  $('#question-number').textContent = String(round + 1).padStart(2, '0');
  $('#question-text').textContent = question;
  $('#committed-words').replaceChildren();
  $('#word-input').value = '';
  $('#word-input').disabled = true;
  $('#submit-button').disabled = true;
  $('#combo-count').textContent = combo;
  $('#cpm-count').textContent = '0';
  $('#danger-countdown').textContent = '';
  $('#game-screen').classList.remove('danger-mode');
  renderTargetGuide();
  $('#feedback-overlay').classList.add('hidden');
  $('#round-review-panel').classList.add('hidden');
  $('#round-review-panel').replaceChildren();
  retriggerClass($('.interview-room'), 'round-enter');
  interviewStage.setDanger(false);
  phaserDangerActive = false;
  interviewStage.roundEnter();
  updateTimer();
  cancelAnimationFrame(timerId);
  const ready = await runRoundCountdown(sequence);
  if (!ready) return;
  $('.interview-room').classList.remove('round-enter');
  $('#round-countdown-overlay').classList.add('hidden');
  roundClosed = false;
  $('#word-input').disabled = false;
  $('#submit-button').disabled = false;
  endAt = performance.now() + duration * 1000;
  roundStartedAt = performance.now();
  $('#word-input').focus();
  timerId = requestAnimationFrame(tick);
}

function tick(now) {
  if (roundClosed) return;
  remaining = Math.max(0, (endAt - now) / 1000);
  updateTimer();
  if (remaining <= 0) {
    finishRound(true);
    return;
  }
  timerId = requestAnimationFrame(tick);
}

function updateTimer() {
  const ratio = duration ? remaining / duration : 0;
  $('#timer-bar').style.width = `${ratio * 100}%`;
  $('#timer-bar').classList.toggle('danger', ratio < 0.25);
  $('#timer-text').textContent = remaining.toFixed(1).padStart(4, '0');
  const danger = ratio < 0.25 && !roundClosed;
  $('#game-screen').classList.toggle('danger-mode', danger);
  if (danger !== phaserDangerActive) {
    phaserDangerActive = danger;
    interviewStage.setDanger(danger);
    audioSystem.setMood(danger ? 'danger' : 'game');
  }
  $('#lock-message').textContent = danger ? '면접관들이 답변을 기다리고 있습니다!' : '스페이스를 누르면 되돌릴 수 없습니다';
  const countdown = remaining <= 3 && remaining > 0 ? Math.ceil(remaining) : null;
  $('#danger-countdown').textContent = countdown ?? '';
  if (countdown && countdown !== lastCountdownSecond) {
    lastCountdownSecond = countdown;
    audioSystem.countdown(countdown === 1);
  }
}

function commitWord(rawWord) {
  if (roundClosed || !rawWord) return;
  const targets = splitWords(currentPair()[1]);
  if (committed.length >= targets.length) return;
  const wordIndex = committed.length;
  const target = targets[wordIndex] ?? '';
  const word = rawWord.trim();
  if (!word) return;
  const correctWord = word === target;

  const result = updateCombo(word, target, combo);
  combo = result.combo;
  maxCombo = Math.max(maxCombo, result.maximum);
  committed.push(word);
  const sprint = multiplayerRoom()?.roundState;
  if (gameMode === 'multi' && correctWord && sprint?.phase === 'playing' && wordIndex === sprint.sprintTargetIndex && !multiplayerRoom()?.latestSprint) {
    claimSprintWord(round, wordIndex).catch(error => flash(error.message));
  }

  const token = document.createElement('span');
  token.className = correctWord ? 'locked-word correct' : 'locked-word wrong';
  token.textContent = word;
  $('#committed-words').append(token);
  $('#combo-count').textContent = String(combo);
  $('#combo-count').parentElement.classList.toggle('hot', combo >= 5);
  if (combo >= 5) retriggerClass($('#combo-count').parentElement, 'combo-punch');

  interviewStage.react(Math.min(committed.length - 1, 4), correctWord);
  if (!correctWord) retriggerClass($('.typing-panel'), 'wrong-hit');
  if (correctWord) audioSystem.correct(combo);
  else audioSystem.wrong();
  renderTargetGuide();
  updateSpeed();
  syncProgress();

}

function processWordInput(input, forceCommit = false) {
  if (roundClosed) return;
  renderTargetGuide();
  updateSpeed();
  if (!/\s/u.test(input.value)) {
    if (!forceCommit) return;
    const word = input.value.trim();
    input.value = '';
    if (word) commitWord(word);
    syncProgress();
    if (committed.length >= splitWords(currentPair()[1]).length) finishRound(false);
    return;
  }
  const pieces = input.value.split(/\s+/u);
  const endsWithSpace = /\s$/u.test(input.value);
  const complete = endsWithSpace ? pieces : pieces.slice(0, -1);
  input.value = endsWithSpace ? '' : (pieces.at(-1) ?? '');
  const available = splitWords(currentPair()[1]).length - committed.length;
  complete.filter(Boolean).slice(0, available).forEach(commitWord);
  syncProgress();
  if (committed.length >= splitWords(currentPair()[1]).length) finishRound(false);
}

function handleInput(event) {
  if (event.isComposing || inputComposing) return;
  processWordInput(event.currentTarget);
}

function finishRound(timedOut = false) {
  if (roundClosed) return;
  const input = $('#word-input');
  const finalWord = input.value.trim();
  input.value = '';
  if (finalWord && committed.length < splitWords(currentPair()[1]).length) {
    commitWord(finalWord);
  }
  roundClosed = true;
  $('#game-screen').classList.remove('danger-mode');
  interviewStage.setDanger(false);
  phaserDangerActive = false;
  $('#danger-countdown').textContent = '';
  cancelAnimationFrame(timerId);
  input.blur();

  const score = evaluateAnswer(committed, currentPair()[1], maxCombo, timedOut ? 0 : remaining, duration, multiplayerRoundEvent() ?? {});
  if (timedOut) audioSystem.timeout();
  else audioSystem.submit();
  history.push({ ...score, maxCombo, answer: committed.join(' ') });
  if (gameMode === 'multi') {
    completeMultiplayerRound({ round, roundScore: score.totalScore, score: totalScore() }).catch(error => flash(error.message));
  }
  const good = score.accuracy >= CONFIG[selectedDifficulty].pass;
  interviewStage.reactAll(good);

  $('#spoken-answer').textContent = committed.join(' ') || '…';
  $('#score-kicker').textContent = `QUESTION ${String(round + 1).padStart(2, '0')} 결과`;
  $('#question-score').textContent = '0.0';
  $('#accuracy-score').textContent = `${Math.round(score.accuracy * 100)}%`;
  $('#max-combo-score').textContent = maxCombo;
  $('#speed-score').textContent = `+${score.speed.toFixed(1)}`;
  $('#next-button').innerHTML = round === roundCount() - 1 ? '최종 결과 보기 <span>→</span>' : '다음 질문 <span>→</span>';
  $('#auto-next-hint').textContent = '결과 표시 중…';
  $('#next-button').disabled = true;
  feedbackReady = false;
  window.clearTimeout(feedbackUnlockTimer);

  window.setTimeout(() => {
    $('#feedback-overlay').classList.remove('hidden');
    animateQuestionScore(score.totalScore);
    feedbackUnlockTimer = window.setTimeout(() => {
      if (!roundClosed || $('#feedback-overlay').classList.contains('hidden')) return;
      if (gameMode === 'multi') {
        feedbackReady = false;
        $('#next-button').disabled = true;
        $('#auto-next-hint').textContent = '다른 지원자의 답변을 기다리는 중…';
        $('#next-button').innerHTML = '응답 대기 중 <span>…</span>';
        const room = multiplayerRoom();
        if (room?.roundState?.phase === 'review') showSynchronizedRoundReview(room);
        return;
      }
      feedbackReady = true;
      $('#next-button').disabled = false;
      startFeedbackAutoAdvance();
    }, 850);
  }, 650);
  if (timedOut) flash('답변 시간이 종료되었습니다');
}

function startFeedbackAutoAdvance() {
  const advanceAt = performance.now() + 4000;
  const label = round === roundCount() - 1 ? '최종 결과' : '다음 질문';
  const render = () => {
    const remainingMs = Math.max(0, advanceAt - performance.now());
    const seconds = Math.ceil(remainingMs / 1000);
    $('#auto-next-hint').textContent = `${seconds}초 후 ${label}${round === roundCount() - 1 ? '로' : '으로'} 자동 진행`;
    $('#next-button').innerHTML = `${label} · ${seconds} <span>→</span>`;
    if (remainingMs <= 0) {
      window.clearInterval(feedbackCountdownTimer);
      feedbackAutoTimer = window.setTimeout(nextRound, 200);
    }
  };
  render();
  feedbackCountdownTimer = window.setInterval(render, 100);
}

function nextRound() {
  if (!feedbackReady) return;
  window.clearTimeout(feedbackAutoTimer);
  window.clearInterval(feedbackCountdownTimer);
  feedbackReady = false;
  $('#next-button').disabled = true;
  if (round >= roundCount() - 1) return showResults();
  round += 1;
  beginRound();
}

function showResults() {
  showScreen('result');
  const total = totalScore();
  const average = history.reduce((sum, item) => sum + item.accuracy, 0) / history.length;
  const bestCombo = Math.max(...history.map(item => item.maxCombo));
  const perfect = history.filter(item => item.accuracy === 1).length;
  let grade = '불합격';
  let title = '아쉽지만, 여기서 끝은 아닙니다.';
  let copy = '틀린 답변도 다음 면접을 위한 훌륭한 데이터입니다.';
  if (average >= 0.9) {
    grade = '최종 합격'; title = '축하합니다!'; copy = '귀하의 답변에서 충분한 가능성을 확인했습니다.';
  } else if (average >= 0.75) {
    grade = '추가 면접'; title = '한 번 더 만나고 싶습니다.'; copy = '조금만 더 다듬으면 완벽한 답변이 될 것 같습니다.';
  }
  audioSystem.result(average >= 0.75);
  $('#result-stamp').textContent = grade;
  $('#result-stamp').dataset.grade = grade;
  $('#result-title').textContent = title;
  $('#result-copy').textContent = copy;
  $('#final-score').textContent = total.toFixed(1);
  $('#final-accuracy').textContent = `${Math.round(average * 100)}%`;
  $('#final-combo').textContent = bestCombo;
  $('#final-perfect').textContent = perfect;
  $('#round-history').innerHTML = history.map((item, index) => `
    <div title="${item.totalScore.toFixed(1)}점">
      <span>Q${index + 1}</span><i style="height:${Math.max(4, item.accuracy * 100)}%"></i>
    </div>`).join('');
  $('#result-chat').classList.toggle('hidden', gameMode !== 'multi');
  $('#restart-button').innerHTML = gameMode === 'multi' ? '방으로 돌아가기 <span>→</span>' : '다시 지원하기 <span>↻</span>';
  $('#restart-button').disabled = gameMode === 'multi';
  if (gameMode === 'multi') {
    const room = multiplayerRoom();
    if (room) {
      renderMatchResult(room);
      renderResultChatPlayers(room);
    }
    finishMatch({ round: roundCount(), progress: 1, score: total }).then(updated => updated && renderMultiplayerRoom(updated)).catch(error => flash(error.message));
  }
}

function setMode(mode) {
  gameMode = mode;
  $$('.mode-tab').forEach(button => {
    const selected = button.dataset.mode === mode;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-selected', String(selected));
  });
  $('#single-mode-options').classList.toggle('hidden', mode !== 'single');
  $('#multiplayer-controls').classList.toggle('hidden', mode !== 'multi');
  $('#start-button').innerHTML = mode === 'multi' ? '빠른 매칭 · 표준 규칙 <span>⚡</span>' : '면접실 입장 <span>→</span>';
}

function nickname() {
  const value = $('#nickname-input').value.trim() || `지원자${Math.floor(Math.random() * 90 + 10)}`;
  $('#nickname-input').value = value;
  localStorage.setItem('interview-nickname', value);
  return value;
}

async function enterMultiplayer(action) {
  leftPlayerIds.clear();
  audioSystem.unlock();
  showScreen('lobby');
  renderLobby(null);
  $('#lobby-title').textContent = '상대 지원자를 찾는 중';
  $('#matching-loader').classList.add('loading');
  $('#ready-button').classList.add('hidden');
  try {
    const room = await action();
    if (room?.code) renderLobby(room);
    else if (room?.waiting) {
      const waitingCount = Math.max(1, Number(room.waitingCount) || 1);
      $('#lobby-status').innerHTML = waitingCount >= 2
        ? '상대와 연결 중입니다<span class="waiting-dots">...</span>'
        : '현재 대기 1명 · 다른 탭이나 친구가 빠른 매칭에 들어오면 시작됩니다<span class="waiting-dots">...</span>';
    }
  } catch (error) {
    leaveMultiplayer();
    showScreen('start');
    flash(error.message);
  }
}

$$('.difficulty-option').forEach(button => button.addEventListener('click', () => {
  selectedDifficulty = button.dataset.difficulty;
  $$('.difficulty-option').forEach(option => {
    const selected = option === button;
    option.classList.toggle('selected', selected);
    option.setAttribute('aria-checked', String(selected));
  });
}));

$('#nickname-input').value = localStorage.getItem('interview-nickname') || '';
$('#room-code-input').addEventListener('input', event => {
  const input = event.currentTarget;
  input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
});
$$('.mode-tab').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
$('#start-button').addEventListener('click', () => {
  if (gameMode === 'single') beginGame();
  else enterMultiplayer(() => quickMatch(nickname(), 'sme'));
});
function multiplayerSetup() {
  const maxWords = Number($('#setup-max-words').value);
  const secondsPerWord = Number($('#setup-seconds-per-word').value);
  const roundCount = Number($('#setup-round-count').value);
  const useAI = $('#setup-use-ai').checked;
  const difficulty = maxWords <= 8 ? 'startup' : maxWords <= 12 ? 'sme' : 'enterprise';
  return { difficulty, settings: { maxWords, secondsPerWord, roundCount, useAI } };
}
function normalizeNumberInput(input) {
  const minimum = Number(input.min);
  const maximum = Number(input.max);
  const step = Number(input.step) || 1;
  const raw = Number(input.value);
  const bounded = Math.min(maximum, Math.max(minimum, Number.isFinite(raw) ? raw : minimum));
  const precision = (String(step).split('.')[1] || '').length;
  input.value = bounded.toFixed(precision);
  input.classList.remove('invalid');
  return bounded;
}
function setupRuleInputs() {
  return [$('#setup-max-words'), $('#setup-seconds-per-word'), $('#setup-round-count')];
}
function roomRuleInputs() {
  return [$('#room-max-words'), $('#room-seconds-per-word'), $('#room-round-count')];
}
function markNumberValidity(inputs, button) {
  const valid = inputs.every(input => {
    const isValid = input.validity.valid && input.value !== '';
    input.classList.toggle('invalid', !isValid);
    return isValid;
  });
  if (button) button.disabled = !valid;
  return valid;
}
function previewMultiplayerSetup() {
  const { settings } = multiplayerSetup();
  const total = settings.maxWords * settings.secondsPerWord;
  $('#setup-time-preview').textContent = Number.isFinite(total) ? `${total.toFixed(1)}초` : '--';
  markNumberValidity(setupRuleInputs(), $('#create-room-button'));
}
$('#setup-max-words').addEventListener('input', previewMultiplayerSetup);
$('#setup-seconds-per-word').addEventListener('input', previewMultiplayerSetup);
$('#setup-round-count').addEventListener('input', previewMultiplayerSetup);
setupRuleInputs().forEach(input => input.addEventListener('change', () => {
  normalizeNumberInput(input);
  previewMultiplayerSetup();
}));
setupRuleInputs().forEach(input => input.addEventListener('blur', () => {
  normalizeNumberInput(input);
  previewMultiplayerSetup();
}));
$('#create-room-button').addEventListener('click', () => {
  setupRuleInputs().forEach(normalizeNumberInput);
  const setup = multiplayerSetup();
  enterMultiplayer(() => createPrivateRoom(nickname(), setup.difficulty, setup.settings));
});
$('#join-room-button').addEventListener('click', () => {
  const code = $('#room-code-input').value.trim();
  if (!code) return flash('초대 코드를 입력해 주세요');
  enterMultiplayer(() => joinPrivateRoom(code, nickname(), 'sme'));
});
$('#ready-button').addEventListener('click', () => {
  const me = multiplayerRoom()?.players.find(player => player.isMe);
  setReady(!me?.ready).catch(error => flash(error.message));
});
$('#host-start-button').addEventListener('click', () => {
  $('#host-start-button').disabled = true;
  startPrivateRoom().catch(error => {
    flash(error.message);
    renderLobby(multiplayerRoom());
  });
});
async function saveRoomRules() {
  roomRuleInputs().forEach(normalizeNumberInput);
  const maxWords = Number($('#room-max-words').value);
  const secondsPerWord = Number($('#room-seconds-per-word').value);
  const roundCount = Number($('#room-round-count').value);
  const useAI = $('#room-use-ai').checked;
  try { await setRoomSettings({ maxWords, secondsPerWord, roundCount, useAI }); }
  catch (error) { flash(error.message); renderLobby(multiplayerRoom()); }
}
function previewRoomRules() {
  const maxWords = Number($('#room-max-words').value) || 0;
  const secondsPerWord = Number($('#room-seconds-per-word').value) || 0;
  $('#room-time-preview').textContent = `${(maxWords * secondsPerWord).toFixed(1)}초`;
  const room = multiplayerRoom();
  const me = room?.players.find(player => player.isMe);
  const canSave = room?.kind === 'private' && room.status === 'waiting' && me?.isHost;
  if (canSave) markNumberValidity(roomRuleInputs(), $('#save-room-rules'));
}
$('#room-max-words').addEventListener('input', previewRoomRules);
$('#room-seconds-per-word').addEventListener('input', previewRoomRules);
$('#room-round-count').addEventListener('input', previewRoomRules);
roomRuleInputs().forEach(input => input.addEventListener('change', () => {
  normalizeNumberInput(input);
  previewRoomRules();
}));
roomRuleInputs().forEach(input => input.addEventListener('blur', () => {
  normalizeNumberInput(input);
  previewRoomRules();
}));
$('#room-use-ai').addEventListener('change', previewRoomRules);
$('#save-room-rules').addEventListener('click', saveRoomRules);
$('#lobby-chat-form').addEventListener('submit', async event => {
  event.preventDefault();
  const input = $('#lobby-chat-input');
  const message = input.value.trim();
  if (!message) return;
  input.value = '';
  try { await sendLobbyChat(message); }
  catch (error) { flash(error.message); }
});
$('#result-chat-form').addEventListener('submit', async event => {
  event.preventDefault();
  const input = $('#result-chat-input');
  const message = input.value.trim();
  if (!message) return;
  input.value = '';
  try { await sendLobbyChat(message); }
  catch (error) { flash(error.message); }
});
$('#copy-room-code').addEventListener('click', async () => {
  await navigator.clipboard.writeText(multiplayerRoom()?.code ?? '');
  flash('초대 코드를 복사했습니다');
});
$('#cancel-match-button').addEventListener('click', () => {
  clearTimeout(multiplayerStartTimer);
  leaveMultiplayer();
  showScreen('start');
});
$('#quit-button').addEventListener('click', () => {
  roundSequence += 1;
  cancelAnimationFrame(timerId);
  $('#round-countdown-overlay').classList.add('hidden');
  leaveMultiplayer();
  showScreen('start');
});
$('#restart-button').addEventListener('click', async () => {
  if (gameMode === 'multi' && multiplayerRoom()) {
    $('#restart-button').disabled = true;
    try {
      const currentRoom = multiplayerRoom();
      const room = currentRoom.status === 'waiting' ? currentRoom : await returnToLobby();
      showScreen('lobby');
      renderLobby(room);
    } catch (error) {
      flash(error.message);
      $('#restart-button').disabled = false;
    }
    return;
  }
  showScreen('start');
});
$('#next-button').addEventListener('click', nextRound);
$('#submit-button').addEventListener('click', () => finishRound(false));
$('#word-input').addEventListener('input', handleInput);
$('#word-input').addEventListener('compositionstart', () => {
  inputComposing = true;
});
$('#word-input').addEventListener('compositionend', event => {
  inputComposing = false;
  if (!commitSpaceAfterComposition) {
    processWordInput(event.currentTarget);
    return;
  }
  commitSpaceAfterComposition = false;
  const input = event.currentTarget;
  window.setTimeout(() => processWordInput(input, true), 0);
});
$('#word-input').addEventListener('keydown', event => {
  if ((event.code === 'Space' || event.key === ' ') && (event.isComposing || inputComposing)) {
    commitSpaceAfterComposition = true;
    return;
  }
  if (event.code === 'Space' && !event.isComposing && !event.currentTarget.value.trim()) {
    event.preventDefault();
    event.currentTarget.value = '';
    return;
  }
  if (event.key === 'Enter' && !event.isComposing) {
    event.preventDefault();
    // 제출에 사용한 Enter가 문서 단축키까지 버블링해 결과 화면을
    // 곧바로 넘기는 일을 막는다.
    event.stopPropagation();
    finishRound(false);
  }
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Enter' || event.repeat || event.isComposing) return;
  const resultIsVisible = !$('#feedback-overlay').classList.contains('hidden');
  const gameIsVisible = !screens.game.classList.contains('hidden');
  if (gameIsVisible && roundClosed && resultIsVisible && feedbackReady) {
    event.preventDefault();
    nextRound();
  }
});
window.addEventListener('pagehide', signalMultiplayerExit);
$('#game-screen').addEventListener('click', event => {
  if (!roundClosed && !event.target.closest('button')) $('#word-input').focus();
});

function renderAudioSettings() {
  const button = $('#audio-toggle');
  const master = $('#audio-master-toggle');
  const { muted, musicVolume, effectsVolume } = audioSystem.getSettings();
  const musicPercent = Math.round(musicVolume * 100);
  const effectsPercent = Math.round(effectsVolume * 100);
  button.textContent = muted ? 'SOUND OFF' : 'SOUND';
  button.classList.toggle('muted', muted);
  master.textContent = muted ? '전체 사운드 켜기' : '전체 사운드 끄기';
  master.classList.toggle('sound-off', muted);
  $('#bgm-volume').value = musicPercent;
  $('#sfx-volume').value = effectsPercent;
  $('#bgm-volume-value').textContent = musicPercent;
  $('#sfx-volume-value').textContent = effectsPercent;
}

function toggleAudioPanel(force) {
  const panel = $('#audio-panel');
  const open = force ?? panel.classList.contains('hidden');
  panel.classList.toggle('hidden', !open);
  $('#audio-toggle').setAttribute('aria-expanded', String(open));
  $('#audio-toggle').setAttribute('aria-label', open ? '사운드 설정 닫기' : '사운드 설정 열기');
}

document.addEventListener('pointerover', event => {
  const button = event.target.closest?.('button:not(:disabled)');
  if (!button || button.contains(event.relatedTarget)) return;
  audioSystem.uiHover();
});
document.addEventListener('click', event => {
  audioSystem.unlock();
  if (event.target.closest?.('button:not(:disabled)')) audioSystem.uiClick();
}, true);
$('#audio-toggle').addEventListener('click', () => {
  toggleAudioPanel();
});
$('#audio-master-toggle').addEventListener('click', () => {
  audioSystem.toggleMute();
  renderAudioSettings();
});
$('#bgm-volume').addEventListener('input', event => {
  audioSystem.unlock();
  audioSystem.setMusicVolume(Number(event.currentTarget.value) / 100);
  renderAudioSettings();
});
$('#sfx-volume').addEventListener('input', event => {
  audioSystem.unlock();
  audioSystem.setEffectsVolume(Number(event.currentTarget.value) / 100);
  renderAudioSettings();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') toggleAudioPanel(false);
});
renderAudioSettings();
previewMultiplayerSetup();
fetch('/api/config').then(response => response.json()).then(config => {
  aiQuestionsAvailable = Boolean(config.aiQuestionsAvailable);
  $('#setup-use-ai').disabled = !aiQuestionsAvailable;
  $('#room-ai-hint').textContent = aiQuestionsAvailable ? 'Groq Llama 3.3 70B로 질문·답변 생성' : 'Railway에 GROQ_API_KEY 연결 필요';
}).catch(() => {});
