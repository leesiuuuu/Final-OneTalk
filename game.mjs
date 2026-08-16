import { splitWords, evaluateAnswer, updateCombo } from './scoring.mjs';
import { interviewStage } from './src/interview-stage.ts';
import { audioSystem } from './src/audio-system.ts';
import {
  configureMultiplayer, createPrivateRoom, finishMatch, joinPrivateRoom,
  leaveMultiplayer, multiplayerRoom, quickMatch, sendProgress, setReady, setRoomSettings,
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
let gameMode = 'single';
let multiplayerStartTimer = 0;
let customRules = null;
let phaserDangerActive = false;

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
  const [question, answer] = QUESTIONS[selectedDifficulty][round];
  if (!customRules) return [question, answer];
  return [question, splitWords(answer).slice(0, customRules.maxWords).join(' ')];
}

function totalScore() { return history.reduce((sum, item) => sum + item.totalScore, 0); }

function syncProgress(forceRound = round) {
  if (gameMode !== 'multi' || !multiplayerRoom()) return;
  const wordCount = splitWords(currentPair()[1]).length;
  const partial = Math.min(1, (committed.length + ($('#word-input').value.trim() ? 0.4 : 0)) / wordCount);
  sendProgress({ round: forceRound + 1, progress: Math.min(1, (forceRound + partial) / 10), score: totalScore() });
}

function renderLobby(room) {
  $('#lobby-room-code').textContent = room?.code ?? '-----';
  $('#copy-room-code').classList.toggle('hidden', !room?.code);
  $('#room-rules').classList.toggle('hidden', !room || room.kind !== 'private');
  const players = room?.players ?? [];
  $('#lobby-players').innerHTML = Array.from({ length: 4 }, (_, index) => {
    const player = players[index];
    if (!player) return `<div class="lobby-player waiting"><span>SLOT ${index + 1}</span><strong>대기 중</strong></div>`;
    return `<div class="lobby-player ${player.ready ? 'ready' : ''}"><span>${player.isMe ? 'YOU' : `PLAYER ${index + 1}`}</span><strong>${player.nickname}</strong><small>${player.ready ? ' READY' : ''}</small></div>`;
  }).join('');
  if (!room) return;
  selectedDifficulty = room.difficulty;
  customRules = room.settings;
  const me = players.find(player => player.isMe);
  const isStarting = room.status === 'starting';
  const canConfigure = room.kind === 'private' && !isStarting;
  $('#room-max-words').value = room.settings.maxWords;
  $('#room-seconds-per-word').value = room.settings.secondsPerWord;
  $('#room-max-words').disabled = !me?.isHost || !canConfigure;
  $('#room-seconds-per-word').disabled = !me?.isHost || !canConfigure;
  $('#save-room-rules').disabled = !me?.isHost || !canConfigure;
  $('#room-time-preview').textContent = `${(room.settings.maxWords * room.settings.secondsPerWord).toFixed(1)}초`;
  $('#room-rules-owner').textContent = me?.isHost
    ? (canConfigure ? '방장 설정 · 변경 시 준비 해제' : '게임 규칙 잠김')
    : '방장만 변경 가능';
  $('#ready-button').classList.toggle('hidden', room.provider !== 'local' || isStarting);
  $('#ready-button').disabled = Boolean(me?.ready);
  $('#ready-button').innerHTML = me?.ready ? '다른 지원자 준비 중…' : '준비 완료 <span>✓</span>';
  $('#lobby-title').textContent = isStarting ? `${players.length}인 면접 레이스 확정` : '지원자 대기실';
  $('#lobby-status').innerHTML = isStarting ? '곧 동시에 면접이 시작됩니다' : `현재 ${players.length}/4명 · 2명 이상 모두 준비하면 시작합니다<span class="waiting-dots">...</span>`;
}

function renderMultiplayerRoom(room) {
  renderLobby(room);
  const rivals = room.players.filter(player => !player.isMe);
  $('#opponent-hud').classList.toggle('hidden', gameMode !== 'multi' || rivals.length === 0);
  $('#opponent-list').innerHTML = rivals.map(player => `
    <div class="opponent-row">
      <div><strong>${player.nickname}</strong><small>Q${Math.max(1, player.round)}/10</small><b>${Math.round(player.score)}점</b></div>
      <div class="opponent-track"><i style="width:${player.progress * 100}%"></i></div>
    </div>`).join('');
  if (!screens.result.classList.contains('hidden')) renderMatchResult(room);
}

function renderMatchResult(room) {
  const panel = $('#match-result');
  const ranked = [...room.players].sort((a, b) => b.score - a.score);
  const mine = ranked.findIndex(player => player.isMe);
  panel.classList.remove('hidden');
  panel.innerHTML = `<strong>${mine >= 0 ? `${mine + 1}위 / ${ranked.length}명` : '집계 중'}</strong>${ranked.map((player, index) => `<span>${index + 1}. ${player.nickname} · ${player.score.toFixed(1)}점${player.finished ? '' : ' (진행 중)'}</span>`).join('<br>')}`;
}

function scheduleMultiplayerStart(room) {
  clearTimeout(multiplayerStartTimer);
  selectedDifficulty = room.difficulty;
  customRules = room.settings;
  audioSystem.matchFound();
  const countdownLength = 2800;
  const delay = Math.max(0, room.startAt - Date.now() - countdownLength);
  multiplayerStartTimer = window.setTimeout(beginGame, delay);
}

configureMultiplayer({
  onRoom: renderMultiplayerRoom,
  onMatchStart: scheduleMultiplayerStart,
  onError: flash,
  onConnection: () => flash('매칭 서버에 다시 연결하는 중입니다'),
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

function showRoundCountdown(value, label = '면접 시작까지') {
  const overlay = $('#round-countdown-overlay');
  const number = $('#round-countdown-value');
  $('#countdown-label').textContent = label;
  number.textContent = value;
  number.classList.remove('countdown-pop');
  void number.offsetWidth;
  number.classList.add('countdown-pop');
  overlay.classList.remove('hidden');
}

async function runRoundCountdown(sequence) {
  for (const value of ['3', '2', '1']) {
    if (sequence !== roundSequence) return false;
    showRoundCountdown(value);
    audioSystem.countdown(value === '1');
    await wait(750);
  }
  if (sequence !== roundSequence) return false;
  showRoundCountdown('START!', '답변을 시작하세요');
  audioSystem.start();
  await wait(550);
  return sequence === roundSequence;
}

function beginGame() {
  audioSystem.unlock();
  if (gameMode === 'single') customRules = null;
  round = 0;
  history = [];
  showScreen('game');
  $('#difficulty-badge').textContent = CONFIG[selectedDifficulty].label;
  $('#opponent-hud').classList.toggle('hidden', gameMode !== 'multi');
  $('#match-result').classList.add('hidden');
  beginRound();
}

async function beginRound() {
  const sequence = ++roundSequence;
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
  $('#combo-count').textContent = '0';
  $('#cpm-count').textContent = '0';
  $('#danger-countdown').textContent = '';
  $('#game-screen').classList.remove('danger-mode');
  renderTargetGuide();
  $('#feedback-overlay').classList.add('hidden');
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
  const target = targets[committed.length] ?? '';
  const word = rawWord.trim();
  if (!word) return;
  const correctWord = word === target;

  const result = updateCombo(word, target, combo);
  combo = result.combo;
  maxCombo = Math.max(maxCombo, result.maximum);
  committed.push(word);

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

function handleInput(event) {
  if (event.isComposing || roundClosed) return;
  const input = event.currentTarget;
  renderTargetGuide();
  updateSpeed();
  if (!/\s/u.test(input.value)) return;
  const pieces = input.value.split(/\s+/u);
  const endsWithSpace = /\s$/u.test(input.value);
  const complete = endsWithSpace ? pieces : pieces.slice(0, -1);
  input.value = endsWithSpace ? '' : (pieces.at(-1) ?? '');
  const available = splitWords(currentPair()[1]).length - committed.length;
  complete.filter(Boolean).slice(0, available).forEach(commitWord);
  syncProgress();
  if (committed.length >= splitWords(currentPair()[1]).length) finishRound(false);
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

  const score = evaluateAnswer(committed, currentPair()[1], maxCombo, timedOut ? 0 : remaining, duration);
  if (timedOut) audioSystem.timeout();
  else audioSystem.submit();
  history.push({ ...score, maxCombo, answer: committed.join(' ') });
  if (gameMode === 'multi') sendProgress({ round: round + 1, progress: (round + 1) / 10, score: totalScore() });
  const good = score.accuracy >= CONFIG[selectedDifficulty].pass;
  interviewStage.reactAll(good);

  $('#spoken-answer').textContent = committed.join(' ') || '…';
  $('#score-kicker').textContent = `QUESTION ${String(round + 1).padStart(2, '0')} 결과`;
  $('#question-score').textContent = '0.0';
  $('#accuracy-score').textContent = `${Math.round(score.accuracy * 100)}%`;
  $('#max-combo-score').textContent = maxCombo;
  $('#speed-score').textContent = `+${score.speed.toFixed(1)}`;
  $('#next-button').innerHTML = round === 9 ? '최종 결과 보기 <span>→</span>' : '다음 질문 <span>→</span>';

  window.setTimeout(() => {
    $('#feedback-overlay').classList.remove('hidden');
    animateQuestionScore(score.totalScore);
  }, 650);
  if (timedOut) flash('답변 시간이 종료되었습니다');
}

function nextRound() {
  if (round >= 9) return showResults();
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
  if (gameMode === 'multi') {
    const room = multiplayerRoom();
    if (room) renderMatchResult(room);
    finishMatch({ round: 10, progress: 1, score: total }).then(updated => updated && renderMultiplayerRoom(updated)).catch(error => flash(error.message));
  }
}

function setMode(mode) {
  gameMode = mode;
  $$('.mode-tab').forEach(button => {
    const selected = button.dataset.mode === mode;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-selected', String(selected));
  });
  $('#multiplayer-controls').classList.toggle('hidden', mode !== 'multi');
  $('#start-button').innerHTML = mode === 'multi' ? '빠른 매칭 <span>⚡</span>' : '면접실 입장 <span>→</span>';
}

function nickname() {
  const value = $('#nickname-input').value.trim() || `지원자${Math.floor(Math.random() * 90 + 10)}`;
  $('#nickname-input').value = value;
  localStorage.setItem('interview-nickname', value);
  return value;
}

async function enterMultiplayer(action) {
  audioSystem.unlock();
  showScreen('lobby');
  renderLobby(null);
  $('#lobby-title').textContent = '상대 지원자를 찾는 중';
  $('#ready-button').classList.add('hidden');
  try {
    const room = await action();
    if (room?.code) renderLobby(room);
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
$$('.mode-tab').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
$('#start-button').addEventListener('click', () => {
  if (gameMode === 'single') beginGame();
  else enterMultiplayer(() => quickMatch(nickname(), selectedDifficulty));
});
$('#create-room-button').addEventListener('click', () => enterMultiplayer(() => createPrivateRoom(nickname(), selectedDifficulty)));
$('#join-room-button').addEventListener('click', () => {
  const code = $('#room-code-input').value.trim();
  if (!code) return flash('초대 코드를 입력해 주세요');
  enterMultiplayer(() => joinPrivateRoom(code, nickname(), selectedDifficulty));
});
$('#ready-button').addEventListener('click', () => setReady(true).catch(error => flash(error.message)));
async function saveRoomRules() {
  const maxWords = Number($('#room-max-words').value);
  const secondsPerWord = Number($('#room-seconds-per-word').value);
  try { await setRoomSettings({ maxWords, secondsPerWord }); }
  catch (error) { flash(error.message); renderLobby(multiplayerRoom()); }
}
function previewRoomRules() {
  const maxWords = Number($('#room-max-words').value) || 0;
  const secondsPerWord = Number($('#room-seconds-per-word').value) || 0;
  $('#room-time-preview').textContent = `${(maxWords * secondsPerWord).toFixed(1)}초`;
}
$('#room-max-words').addEventListener('input', previewRoomRules);
$('#room-seconds-per-word').addEventListener('input', previewRoomRules);
$('#save-room-rules').addEventListener('click', saveRoomRules);
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
$('#restart-button').addEventListener('click', () => {
  leaveMultiplayer();
  showScreen('start');
});
$('#next-button').addEventListener('click', nextRound);
$('#submit-button').addEventListener('click', () => finishRound(false));
$('#word-input').addEventListener('input', handleInput);
$('#word-input').addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.isComposing) {
    event.preventDefault();
    finishRound(false);
  }
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Enter' || event.repeat || event.isComposing) return;
  const resultIsVisible = !$('#feedback-overlay').classList.contains('hidden');
  const gameIsVisible = !screens.game.classList.contains('hidden');
  if (gameIsVisible && roundClosed && resultIsVisible) {
    event.preventDefault();
    nextRound();
  }
});
$('#game-screen').addEventListener('click', event => {
  if (!roundClosed && !event.target.closest('button')) $('#word-input').focus();
});

function renderAudioToggle() {
  const button = $('#audio-toggle');
  const muted = audioSystem.isMuted();
  button.textContent = muted ? 'SND OFF' : 'SND ON';
  button.classList.toggle('muted', muted);
  button.setAttribute('aria-pressed', String(muted));
  button.setAttribute('aria-label', muted ? '사운드 켜기' : '사운드 끄기');
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
  audioSystem.toggleMute();
  renderAudioToggle();
});
renderAudioToggle();
