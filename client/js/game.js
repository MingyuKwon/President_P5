const socket = io();
const params = new URLSearchParams(location.search);
const roomId = params.get('id');
const nickname = sessionStorage.getItem('nickname');
if (!nickname || !roomId) location.href = '/';

function getSessionId() {
  let id = sessionStorage.getItem('sessionId');
  if (!id) { id = Math.random().toString(36).slice(2, 10); sessionStorage.setItem('sessionId', id); }
  return id;
}

const myId = getSessionId();

function cardImg(card) {
  if (card === 'Joker') return '/Resource/CardImage/Joker.png';
  return `/Resource/CardImage/${card}.png`;
}

const RANK_SCORES = { president: 30, 'vice-president': 20, citizen: 10, 'vice-scum': 0, scum: -10 };

const CARD_ORDER = ['3','4','5','6','7','8','9','10','J','Q','K','A','2','Joker'];
function cardRank(card) {
  const num = card === 'Joker' ? 'Joker' : card.slice(0, -1);
  return CARD_ORDER.indexOf(num);
}
function sortHand(hand) {
  return [...hand].sort((a, b) => cardRank(a) - cardRank(b));
}

const REV_ORDER = ['2','A','K','Q','J','10','9','8','7','6','5','4','3','Joker'];
function playRank(card, revolution) {
  const num = card === 'Joker' ? 'Joker' : card.slice(0, -1);
  return (revolution ? REV_ORDER : CARD_ORDER).indexOf(num);
}
function playValue(cards, revolution) {
  const nonJoker = cards.filter(c => c !== 'Joker');
  return playRank(nonJoker.length ? nonJoker[0] : 'Joker', revolution);
}
function canBeat(cards, tableCards, revolution) {
  // 스페이드 3 역전: 조커 단독에 스페이드 3 단독으로 응수 가능
  if (cards.length === 1 && cards[0] === '3S' && tableCards.length === 1 && tableCards[0] === 'Joker') return true;
  return cards.length === tableCards.length && playValue(cards, revolution) > playValue(tableCards, revolution);
}
function subtractCards(arr, toRemove) {
  const r = [...arr];
  for (const c of toRemove) { const i = r.indexOf(c); if (i !== -1) r.splice(i, 1); }
  return r;
}
function computeSelectableSet(hand, selected, tableCards, revolution) {
  if (currentPlayerId !== myId) return new Set();
  const tableEmpty = !tableCards || tableCards.length === 0;
  if (tableEmpty && selected.length === 0) return new Set(hand);
  if (tableEmpty) {
    const selNum = selected.filter(c => c !== 'Joker').map(c => c.slice(0, -1))[0] || null;
    const remaining = subtractCards(hand, selected);
    if (!selNum) return new Set(remaining);
    return new Set(remaining.filter(c => c === 'Joker' || c.slice(0, -1) === selNum));
  }
  const N = tableCards.length;
  if (selected.length >= N) return new Set();
  const selNum = selected.filter(c => c !== 'Joker').map(c => c.slice(0, -1))[0] || null;
  const remaining = subtractCards(hand, selected);
  const result = new Set();
  for (const card of new Set(remaining)) {
    if (card !== 'Joker' && selNum !== null && card.slice(0, -1) !== selNum) continue;
    const testSel = [...selected, card];
    const testNum = testSel.filter(c => c !== 'Joker').map(c => c.slice(0, -1))[0] || null;
    if (testSel.length === N) {
      if (canBeat(testSel, tableCards, revolution)) result.add(card);
    } else {
      const pool = subtractCards(remaining, [card]);
      const need = N - testSel.length;
      const sortFn = (a, b) => (b === 'Joker' ? 1 : 0) - (a === 'Joker' ? 1 : 0) || playRank(b, revolution) - playRank(a, revolution);
      if (testNum !== null) {
        // 숫자가 확정된 경우: 같은 숫자 + 조커만 eligible
        const eligible = pool.filter(c => c === 'Joker' || c.slice(0, -1) === testNum);
        if (eligible.length >= need) {
          const sorted = [...eligible].sort(sortFn);
          if (canBeat([...testSel, ...sorted.slice(0, need)], tableCards, revolution)) result.add(card);
        }
      } else {
        // 조커만 선택된 경우: 숫자가 미확정이므로 각 숫자별로 조합 가능한지 검사
        const extraJokers = pool.filter(c => c === 'Joker');
        const rankGroups = {};
        for (const c of pool) {
          if (c === 'Joker') continue;
          const r = c.slice(0, -1);
          (rankGroups[r] = rankGroups[r] || []).push(c);
        }
        for (const rankCards of Object.values(rankGroups)) {
          const available = [...rankCards, ...extraJokers];
          if (available.length >= need) {
            const sorted = [...available].sort(sortFn);
            if (canBeat([...testSel, ...sorted.slice(0, need)], tableCards, revolution)) { result.add(card); break; }
          }
        }
      }
    }
  }
  return result;
}

let myHand = sortHand(JSON.parse(sessionStorage.getItem('hand') || '[]'));
let selectedCards = [];
let currentPlayerId = sessionStorage.getItem('currentPlayerId');
let roundEndAnimating = false;
let players = JSON.parse(sessionStorage.getItem('players') || '[]');
let turnOrder = JSON.parse(sessionStorage.getItem('turnOrder') || '[]');
let originalOrder = [...turnOrder];
let playerRanks = {};
players.forEach(p => { if (p.rank) playerRanks[p.id] = p.rank; });
let currentTableCards = [];
let currentRevolution = false;
let fallenPresidentId = null;
let isHost = false;
let leftPlayers = new Set();
let taxPhase = null; // null | { role, taxReturnCount }
let taxSubmitted = false;
let taxExchangeEl = null;
let taxExchangeAnim = null;
let taxNewCards = []; // 세금으로 새로 받은 카드 목록 (receive 애니메이션용)

const seatsEl        = document.getElementById('player-seats');
const scorePanelEl   = document.getElementById('score-panel');
const tableEl        = document.getElementById('table');
const handEl         = document.getElementById('hand');
const myAreaEl       = document.getElementById('my-area');
const mySeatEl       = document.getElementById('my-seat');
const btnPlay        = document.getElementById('btn-play');
const btnPass        = document.getElementById('btn-pass');
const orderBarEl     = document.getElementById('card-order-bar');
const timerEl        = document.getElementById('turn-timer');
const btnAutoPass    = document.getElementById('btn-autopass');
const btnAuto        = document.getElementById('btn-auto');

let timerInterval    = null;
let autoPass         = false;
let autoPassTimer    = null;
let countdownInterval = null;

function clearAutoPassTimer() {
  if (autoPassTimer) { clearTimeout(autoPassTimer); autoPassTimer = null; }
}

function tryAutoPass() {
  if (!autoPass || currentPlayerId !== myId || isCutscenePlaying()) return;
  const selectable = computeSelectableSet(myHand, selectedCards, currentTableCards, currentRevolution);
  if (selectable.size > 0) return;
  clearAutoPassTimer();
  autoPassTimer = setTimeout(() => {
    if (autoPass && currentPlayerId === myId) socket.emit('pass', { sessionId: myId });
  }, 1000);
}

btnAutoPass.onclick = () => {
  autoPass = !autoPass;
  btnAutoPass.classList.toggle('on', autoPass);
  socket.emit('set-auto-setting', { sessionId: myId, key: 'autoPass', value: autoPass });
  if (!autoPass) clearAutoPassTimer();
  else tryAutoPass();
};

let autoPlay = false;
let autoPlayTimer = null;
let autoTaxTimer = null;
const gameBoardEl = document.getElementById('game-board');

function clearAutoPlayTimer() {
  if (autoPlayTimer) { clearTimeout(autoPlayTimer); autoPlayTimer = null; }
}

function clearAutoTaxTimer() {
  if (autoTaxTimer) { clearTimeout(autoTaxTimer); autoTaxTimer = null; }
}

function groupByRank(hand) {
  const map = {};
  for (const c of hand) {
    const r = c === 'Joker' ? 'Joker' : c.slice(0, -1);
    (map[r] = map[r] || []).push(c);
  }
  return map;
}
function weakestCard(cards) {
  return cards.reduce((a, b) => playRank(a, currentRevolution) <= playRank(b, currentRevolution) ? a : b);
}
function strongestCard(cards) {
  return cards.reduce((a, b) => playRank(a, currentRevolution) >= playRank(b, currentRevolution) ? a : b);
}

function selectCardsToPlay() {
  const isLead   = currentTableCards.length === 0;
  const needCount = isLead ? 1 : currentTableCards.length;
  const ctx = {
    hand: myHand,
    tableCards: currentTableCards,
    revolution: currentRevolution,
    isLead,
    needCount,
    playRank: (card) => playRank(card, currentRevolution),
    canBeat:  (cards) => canBeat(cards, currentTableCards, currentRevolution),
    groupByRank,
    weakest:  weakestCard,
    strongest: strongestCard,
  };
  return myStrategy(ctx);
}

function tryAutoPlay() {
  if (!autoPlay || currentPlayerId !== myId || isCutscenePlaying()) return;
  clearAutoPlayTimer();
  autoPlayTimer = setTimeout(() => {
    if (!autoPlay || currentPlayerId !== myId) return;
    const cards = selectCardsToPlay();
    if (cards) socket.emit('play-cards', { cards, sessionId: myId });
    else socket.emit('pass', { sessionId: myId });
  }, 1000);
}

function tryAutoTax() {
  if (!autoPlay || !taxPhase || taxPhase.taxReturnCount <= 0 || taxSubmitted || isCutscenePlaying()) return;
  clearAutoTaxTimer();
  const count = taxPhase.taxReturnCount;
  autoTaxTimer = setTimeout(() => {
    if (!autoPlay || !taxPhase || taxSubmitted) return;
    // 가장 약한 카드 count장 선택
    const sorted = [...myHand].sort((a, b) => playRank(a, currentRevolution) - playRank(b, currentRevolution));
    const cards = sorted.slice(0, count);
    taxSubmitted = true;
    socket.emit('tax-return', { sessionId: myId, cards });
    const toRemove = [...cards];
    myHand = myHand.filter(c => { const i = toRemove.indexOf(c); if (i !== -1) { toRemove.splice(i, 1); return false; } return true; });
    selectedCards = [];
    taxBannerEl.textContent = '제출 완료, 세금 교환 대기 중...';
    handEl.classList.add('tax-waiting');
    renderHand();
  }, 1000);
}

btnAuto.onclick = () => {
  autoPlay = !autoPlay;
  btnAuto.classList.toggle('on', autoPlay);
  gameBoardEl.classList.toggle('auto-mode', autoPlay);
  socket.emit('set-auto-setting', { sessionId: myId, key: 'autoPlay', value: autoPlay });
  if (!autoPlay) { clearAutoPlayTimer(); clearAutoTaxTimer(); }
  else { tryAutoPlay(); tryAutoTax(); }
};

function applyAutoSettings(settings) {
  if (!settings) return;
  autoPlay = settings.autoPlay || false;
  autoPass = settings.autoPass || false;
  btnAuto.classList.toggle('on', autoPlay);
  gameBoardEl.classList.toggle('auto-mode', autoPlay);
  btnAutoPass.classList.toggle('on', autoPass);
}

function clearTimerUI() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  timerEl.style.visibility = 'hidden';
  timerEl.classList.remove('urgent');
}

function startTimerUI(playerId, duration) {
  clearTimerUI();
  if (playerId !== myId) return;
  let remaining = duration;

  function update() {
    timerEl.style.visibility = 'visible';
    timerEl.classList.toggle('urgent', remaining <= 10);
    timerEl.querySelector('.timer-text').textContent = remaining;
  }
  update();
  timerInterval = setInterval(() => {
    remaining--;
    if (remaining <= 0) { clearTimerUI(); return; }
    update();
  }, 1000);
}

socket.on('connect', () => {
  socket.emit('join-room', { roomId, nickname, sessionId: myId });
});

socket.on('room-joined', ({ isHost: h }) => {
  isHost = h;
});

socket.on('game-started', ({ hand, turnOrder: to, currentPlayerId: cpId, players: ps, phase, taxInfo, autoSettings, scores }) => {
  clearCutsceneQueue();
  applyAutoSettings(autoSettings);
  clearTimeout(gameOverTimer);
  sessionStorage.removeItem('gameOverRanks');
  sessionStorage.removeItem('gameOverScores');
  document.getElementById('game-over-overlay').classList.remove('open');
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  setReadyBtn(false);
  const cdEl2 = document.getElementById('ready-countdown');
  cdEl2.style.display = 'none';
  cdEl2.textContent = '';
  myHand = sortHand(hand);
  currentPlayerId = cpId;
  turnOrder = to;
  originalOrder = [...to];
  players = ps;
  selectedCards = [];
  currentTableCards = [];
  currentRevolution = false;
  fallenPresidentId = null;
  leftPlayers = new Set();
  playerRanks = {};
  ps.forEach(p => { if (p.rank) playerRanks[p.id] = p.rank; });
  renderScorePanel(scores || {});
  tableEl.innerHTML = '';

  enqueueCutscene({ image: '/Resource/UI/game-state/GameStart.png' });
  afterCutsceneQueue(() => {
    if (phase === 'tax' && taxInfo) {
      taxPhase = taxInfo;
      taxSubmitted = false;
      enterTaxPhase(taxInfo);
      if (taxInfo.taxReceived && taxInfo.taxReceived.length > 0) {
        animateTaxReceive(taxInfo.taxReceived);
      }
    } else {
      taxPhase = null;
      exitTaxPhase();
      renderHand();
      renderSeats();
      renderCardOrder();
      if (currentPlayerId === myId) { tryAutoPlay(); tryAutoPass(); }
    }
  });
});

socket.on('game-state-sync', ({ hand, tableCards, tablePile, currentPlayerId: cpId, revolution, players: ps, turnOrder: to, phase, readyPlayers, scores, isHost: h, taxInfo, autoSettings, chatHistory }) => {
  if (h !== undefined) isHost = h;
  applyAutoSettings(autoSettings);
  if (chatHistory && chatMessagesEl.children.length === 0) {
    chatHistory.forEach(renderChatMsg);
  }
  myHand = sortHand(hand);
  currentPlayerId = cpId;
  currentTableCards = tableCards || [];
  currentRevolution = revolution;
  players = ps;
  ps.forEach(p => { if (p.rank) playerRanks[p.id] = p.rank; });
  if (to.length > 0) { turnOrder = to; if (originalOrder.length === 0) originalOrder = [...to]; }
  selectedCards = [];
  renderScorePanel(scores || {});

  if (phase === 'tax' && taxInfo) {
    taxPhase = taxInfo;
    taxSubmitted = taxInfo.taxSubmitted || false;
    enterTaxPhase(taxInfo);
    renderTablePile(tablePile || []);
    renderCardOrder();
  } else if (phase === 'gameover' && readyPlayers) {
    taxPhase = null;
    exitTaxPhase();
    renderHand();
    renderSeats();
    renderTablePile(tablePile || []);
    renderCardOrder();
    if (scores) sessionStorage.setItem('gameOverScores', JSON.stringify(scores));
    readyPlayers.forEach(pid => {
      const card = document.querySelector(`.go-player-card[data-player-id="${pid}"]`);
      if (card) card.querySelector('.go-card-ready').style.display = 'block';
    });
    if (readyPlayers.includes(myId)) setReadyBtn(true);
  } else {
    taxPhase = null;
    exitTaxPhase();
    const showStartCutscene = sessionStorage.getItem('showGameStartCutscene');
    if (showStartCutscene) {
      sessionStorage.removeItem('showGameStartCutscene');
      enqueueCutscene({ image: '/Resource/UI/game-state/GameStart.png' });
      afterCutsceneQueue(() => {
        renderHand();
        renderSeats();
        renderTablePile(tablePile || []);
        renderCardOrder();
        if (cpId === myId) { tryAutoPass(); tryAutoPlay(); }
      });
    } else {
      renderHand();
      renderSeats();
      renderTablePile(tablePile || []);
      renderCardOrder();
      if (cpId === myId) { tryAutoPass(); tryAutoPlay(); }
    }
  }
});

socket.on('state-updated', ({ tableCards, tablePile, currentPlayerId: cpId, revolution, players: ps }) => {
  const wasMyTurn = currentPlayerId === myId;
  currentPlayerId = cpId;
  players = ps;
  currentTableCards = tableCards || [];
  currentRevolution = revolution;
  if (wasMyTurn && cpId !== myId) { selectedCards = []; clearAutoPassTimer(); clearAutoPlayTimer(); }
  updateSeats();
  updateHandSelectability();
  renderCardOrder();
  if (cpId === myId) { tryAutoPass(); tryAutoPlay(); }
});

socket.on('card-played', ({ cards }) => {
  addCardGroupToTable(cards);
});

socket.on('player-passed', ({ playerId }) => {
  const seatEl = playerId === myId
    ? document.querySelector('.player-seat.me')
    : document.querySelector(`.player-seat[data-player-id="${playerId}"]`);
  if (!seatEl) return;

  const TOTAL_DURATION = 0.7; // seconds
  const receivedAt = performance.now();

  function playPassAnim() {
    const elapsed = (performance.now() - receivedAt) / 1000;
    if (elapsed >= TOTAL_DURATION) return;

    const boardRect = gameBoardEl.getBoundingClientRect();
    const scale = boardRect.width / 2000;
    const seatRect = seatEl.getBoundingClientRect();
    const imgW = 81, imgH = 62;
    const bx = (seatRect.left - boardRect.left) / scale - imgW - 10;
    const by = (seatRect.top  - boardRect.top)  / scale + seatRect.height / scale / 2 - imgH / 2;

    const img = document.createElement('img');
    img.src = '/Resource/UI/ControlPanel/PassWord.png';
    Object.assign(img.style, {
      position: 'absolute',
      left: `${bx}px`,
      top:  `${by}px`,
      width:  `${imgW}px`,
      height: `${imgH}px`,
      objectFit: 'contain',
      zIndex: '500',
      pointerEvents: 'none',
    });
    gameBoardEl.appendChild(img);

    const tl = gsap.timeline({ onComplete: () => img.remove() })
      .fromTo(img, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.08, ease: 'back.out(1.5)' })
      .to(img, { scale: 1.18, duration: 0.08, ease: 'power2.out' })
      .to(img, { scale: 1.0,  duration: 0.08, ease: 'power2.in' })
      .to(img, { scale: 1.1,  duration: 0.06, ease: 'power2.out' })
      .to(img, { scale: 1.0,  duration: 0.06, ease: 'power2.in' })
      .to({}, { duration: 0.2 })
      .to(img, { opacity: 0, scale: 0.8, duration: 0.14, ease: 'power2.in' });

    if (elapsed > 0) tl.seek(elapsed);
  }

  if (!document.hidden) {
    playPassAnim();
  } else {
    const onVisible = () => {
      if (!document.hidden) {
        document.removeEventListener('visibilitychange', onVisible);
        playPassAnim();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
  }
});

socket.on('hand-updated', ({ hand }) => {
  // 세금 페이즈 중 새로 받은 카드 감지 → floating 애니메이션
  if (taxPhase) {
    const remaining = [...myHand];
    const newCards = [];
    for (const card of hand) {
      const idx = remaining.indexOf(card);
      if (idx !== -1) remaining.splice(idx, 1);
      else newCards.push(card);
    }
    if (newCards.length > 0) animateTaxReceive(newCards);
  }
  myHand = sortHand(hand);
  selectedCards = [];
  renderHand();
  // 세금 제출 전이고 내가 선택할 차례면 버튼 갱신
  if (taxPhase && taxPhase.taxReturnCount > 0 && !taxSubmitted) {
    renderTaxButtons(taxPhase.taxReturnCount);
  }
});

socket.on('turn-timer', ({ playerId, duration }) => {
  startTimerUI(playerId, duration);
});

socket.on('round-end', ({ reason }) => {
  clearTimerUI();
  clearAutoPassTimer();
  clearAutoPlayTimer();
  if (reason === '8-clear') enqueueCutscene({ image: '/Resource/UI/game-state/Eight_RoundEnd.png' });
  else if (reason === 'spade-reversal') enqueueCutscene({ image: '/Resource/UI/game-state/S3_RoundEnd.png' });
  else if (reason === 'all-pass') enqueueCutscene({ image: '/Resource/UI/game-state/AllPass_RoundENd.png', duration: 0.6, fadeIn: 0.1 });
  roundEndAnimating = true;
  updateSeats();
  lockAnim();
  gsap.to('#table .table-group', {
    opacity: 0, y: -20, duration: 0.6, stagger: 0.05,
    onComplete: () => { tableEl.innerHTML = ''; },
  });
  setTimeout(() => {
    tableEl.innerHTML = '';
    roundEndAnimating = false;
    updateSeats();
    unlockAnim();
  }, 800);
});

socket.on('revolution', ({ active }) => enqueueCutscene({ image: '/Resource/UI/game-state/Revolution.png', imageScale: 1.4 }));

socket.on('player-finished', ({ playerId, rank }) => {
  if (rank === 'scum') return;
  const p = players.find(p => p.id === playerId);
  enqueueCutscene({ image: '/Resource/UI/game-state/allout.png', subImage: rankImg(rank), text: p ? p.nickname : playerId });
});

socket.on('player-bot', ({ playerId }) => {
  leftPlayers.add(playerId);
});

socket.on('room-updated', ({ players: newPlayers }) => {
  if (!document.getElementById('game-over-overlay').classList.contains('open')) return;
  const newPlayerIds = new Set(newPlayers.map(p => p.id));
  document.querySelectorAll('.go-player-card').forEach(card => {
    const pid = card.dataset.playerId;
    if (pid && !newPlayerIds.has(pid)) markPlayerLeft(pid);
  });
});

socket.on('president-penalty', ({ playerId }) => {
  enqueueCutscene({ image: '/Resource/UI/game-state/fall.png' });
  fallenPresidentId = playerId;
  renderSeats();
});

function showGameOverPanel(ranks, scores = {}) {
  const RANK_ORDER = ['president', 'vice-president', 'citizen', 'vice-scum', 'scum'];
  const sorted = Object.entries(ranks).sort(
    (a, b) => RANK_ORDER.indexOf(a[1]) - RANK_ORDER.indexOf(b[1])
  );

  const ranksEl = document.getElementById('game-over-ranks');
  ranksEl.innerHTML = sorted.map(([id, rank]) => {
    const p = players.find(p => p.id === id);
    const name = p ? p.nickname : id;
    return `
      <div class="go-player-card" data-player-id="${id}">
        <img class="go-card-reward-bg" src="/Resource/UI/background/CardGame-rankReward-bg2.png" alt="">
        <img class="go-card-bg" src="/Resource/UI/result/result-bg-red.png" alt="">
        <img class="go-card-badge" src="/Resource/UI/rank-badge/${rank}.png" alt="${rankLabel(rank)}">
        <div class="go-card-content">
          <div class="go-card-name">${name}</div>
          <div class="go-card-score">${(() => { const total = scores[id] ?? 0; const delta = RANK_SCORES[rank] ?? 0; const sign = delta >= 0 ? '+' : ''; return `${total}점<br>(${sign}${delta})`; })()}</div>
        </div>
        <img class="go-card-ready" src="/Resource/UI/result/Ready.png" alt="">
        <img class="go-card-exit" src="/Resource/UI/result/ExitRoom.png" alt="" ${leftPlayers.has(id) ? 'style="display:block"' : ''}>
      </div>`;
  }).join('');

  document.getElementById('game-over-overlay').classList.add('open');
  const btnReady = document.getElementById('btn-ready');
  setReadyBtn(false);
  const cdEl = document.getElementById('ready-countdown');
  cdEl.style.display = 'none';
  cdEl.textContent = '';
}

let gameOverTimer = null;
socket.on('game-over', ({ ranks, scores }) => {
  clearTimerUI();
  autoPlay = false;
  btnAuto.classList.remove('on');
  gameBoardEl.classList.remove('auto-mode');
  clearAutoPassTimer();
  clearAutoPlayTimer();
  clearAutoTaxTimer();
  sessionStorage.setItem('gameOverRanks', JSON.stringify(ranks));
  sessionStorage.setItem('gameOverScores', JSON.stringify(scores || {}));
  renderScorePanel(scores || {});
  enqueueCutscene({ image: '/Resource/UI/game-state/GameEnd.png' });
  afterCutsceneQueue(() => showGameOverPanel(ranks, scores));
});


const taxBannerEl = document.getElementById('tax-banner');
const ROLE_LABEL = { president: '대부호', 'vice-president': '부호', citizen: '평민', 'vice-scum': '빈민', scum: '대빈민' };

function showTaxExchangeImage() {
  if (taxExchangeEl) return;
  taxExchangeEl = document.createElement('div');
  Object.assign(taxExchangeEl.style, {
    position: 'fixed', inset: '0', zIndex: '200',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'none',
  });
  const img = document.createElement('img');
  img.src = '/Resource/UI/game-state/ExchangeCard.png';
  Object.assign(img.style, { width: '26.6vw', height: '26.6vh', objectFit: 'contain' });
  taxExchangeEl.appendChild(img);
  document.body.appendChild(taxExchangeEl);

  taxExchangeAnim = gsap.timeline({ repeat: -1 })
    .to(img, { scale: 1.13, duration: 0.14, ease: 'power2.out' })
    .to(img, { scale: 1.0,  duration: 0.14, ease: 'power2.in' })
    .to(img, { scale: 1.08, duration: 0.14, ease: 'power2.out' })
    .to(img, { scale: 1.0,  duration: 0.14, ease: 'power2.in' })
    .to({},  { duration: 0.55 });
}

function hideTaxExchangeImage() {
  if (taxExchangeAnim) { taxExchangeAnim.kill(); taxExchangeAnim = null; }
  if (taxExchangeEl) { taxExchangeEl.remove(); taxExchangeEl = null; }
}

function animateTaxReceive(cards) {
  if (!cards.length) return;
  const handRect = handEl.getBoundingClientRect();
  const centerX = handRect.left + handRect.width / 2;
  const targetY = handRect.top + handRect.height * 0.3;

  lockAnim();
  let completed = 0;
  let unlocked = false;
  const doUnlock = () => { if (!unlocked) { unlocked = true; unlockAnim(); } };
  const maxDelay = (cards.length - 1) * 0.1 + 0.52 + 0.45;
  setTimeout(doUnlock, maxDelay * 1000 + 200);

  cards.forEach((card, i) => {
    const el = document.createElement('div');
    const offsetX = (i - (cards.length - 1) / 2) * 44;
    el.style.cssText = [
      'position:fixed',
      `left:${centerX - 50 + offsetX}px`,
      `top:${handRect.top - 160}px`,
      'width:100px', 'height:143px',
      'border-radius:8px', 'overflow:hidden',
      'z-index:600', 'pointer-events:none',
      'box-shadow:0 8px 24px rgba(0,0,0,.6)',
    ].join(';');
    el.innerHTML = `<img src="${cardImg(card)}" style="width:100%;height:100%;object-fit:cover">`;
    document.body.appendChild(el);

    const delay = i * 0.1;
    gsap.to(el, { top: targetY, duration: 0.55, ease: 'power2.in', delay });
    gsap.to(el, { opacity: 0, scale: 0.7, duration: 0.45, ease: 'power1.in',
      delay: delay + 0.52, onComplete: () => { el.remove(); completed++; if (completed === cards.length) doUnlock(); } });
  });
}

function enterTaxPhase(taxInfo) {
  const { role, taxGiven, taxReceived, taxReturnCount } = taxInfo;
  // taxSubmitted은 호출자가 설정 — 여기서 초기화하지 않음
  gameBoardEl.classList.add('tax-mode');
  taxBannerEl.style.display = 'block';

  if (taxReturnCount > 0) {
    if (taxSubmitted) {
      taxBannerEl.textContent = '제출 완료, 세금 교환 대기 중...';
      handEl.classList.add('tax-waiting');
      renderHand();
      btnPlay.disabled = true;
      btnPass.style.display = 'none';
    } else {
      taxBannerEl.textContent = `세금: 돌려줄 카드 ${taxReturnCount}장을 선택하세요`;
      renderHand();
      renderTaxButtons(taxReturnCount);
    }
  } else if (taxGiven.length > 0) {
    taxBannerEl.textContent = `세금 ${taxGiven.length}장 납부됨 (${taxGiven.map(c => c.slice(0, -1)).join(', ')})`;
    handEl.classList.add('tax-waiting');
    renderHand();
    btnPlay.disabled = true;
    btnPass.disabled = true;
  } else {
    taxBannerEl.textContent = '세금 교환 중...';
    handEl.classList.add('tax-waiting');
    renderHand();
    btnPlay.disabled = true;
    btnPass.disabled = true;
  }

  renderSeats();
  renderCardOrder();
  showTaxExchangeImage();
  tryAutoTax();
}

function exitTaxPhase() {
  hideTaxExchangeImage();
  clearAutoTaxTimer();
  taxSubmitted = false;
  gameBoardEl.classList.remove('tax-mode');
  taxBannerEl.style.display = 'none';
  handEl.classList.remove('tax-waiting');
  btnPlay.innerHTML = '<img src="/Resource/UI/ControlPanel/CardSelect.png" alt="카드 내기"><span>카드 내기</span>';
  btnPlay.onclick = onBtnPlayClick;
  btnPass.style.display = '';
}

function renderTaxButtons(count) {
  if (taxSubmitted) return;
  btnPlay.innerHTML = `<img src="/Resource/UI/ControlPanel/CardSelect.png" alt="세금 내기"><span>세금 내기 (${count}장)</span>`;
  btnPlay.disabled = selectedCards.length !== count;
  btnPlay.onclick = () => {
    if (selectedCards.length !== count || taxSubmitted) return;
    taxSubmitted = true;
    const submitted = [...selectedCards];

    // 선택된 카드 요소를 클론해서 날리는 send 애니메이션
    const selectedEls = [...handEl.querySelectorAll('.hand-card.selected')];
    if (selectedEls.length > 0) lockAnim();
    selectedEls.forEach(el => {
      const rect = el.getBoundingClientRect();
      const clone = el.cloneNode(true);
      clone.style.cssText = `position:fixed; left:${rect.left}px; top:${rect.top}px; width:${rect.width}px; height:${rect.height}px; z-index:500; pointer-events:none; border-radius:8px; overflow:hidden;`;
      document.body.appendChild(clone);
      gsap.to(clone, { y: -260, x: (Math.random() - 0.5) * 60, opacity: 0, scale: 0.75, duration: 0.7, ease: 'power2.in', onComplete: () => clone.remove() });
    });
    if (selectedEls.length > 0) setTimeout(unlockAnim, 800);

    socket.emit('tax-return', { sessionId: myId, cards: submitted });
    // 낙관적 UI: 손패에서 즉시 제거
    const toRemove = [...submitted];
    myHand = myHand.filter(c => { const i = toRemove.indexOf(c); if (i !== -1) { toRemove.splice(i, 1); return false; } return true; });
    selectedCards = [];
    btnPlay.disabled = true;
    taxBannerEl.textContent = '제출 완료, 세금 교환 대기 중...';
    handEl.classList.add('tax-waiting');
    renderHand();
  };
  btnPass.style.display = 'none';
}

socket.on('tax-returned', ({ giverId, cardCount }) => {
  if (!taxPhase) return;
  // 대부호·부호 동시 진행이므로 별도 UI 전환 없음. 배너만 업데이트.
  if (taxSubmitted) {
    taxBannerEl.textContent = '제출 완료, 세금 교환 대기 중...';
  }
});

socket.on('tax-phase-end', ({ currentPlayerId: cpId }) => {
  taxPhase = null;
  currentPlayerId = cpId;
  exitTaxPhase();
  selectedCards = [];
  renderHand();
  renderSeats();
  renderCardOrder();
  if (currentPlayerId === myId) { tryAutoPlay(); tryAutoPass(); }
});

function onBtnPlayClick() {
  if (!selectedCards.length || isCutscenePlaying()) return;
  socket.emit('play-cards', { cards: selectedCards, sessionId: myId });
}

function showReadyOverlay(el) {
  el.classList.remove('pop');
  void el.offsetWidth; // reflow to restart animation
  el.style.display = 'block';
  el.classList.add('pop');
}

function markPlayerLeft(playerId) {
  leftPlayers.add(playerId);
  const card = document.querySelector(`.go-player-card[data-player-id="${playerId}"]`);
  if (!card) return;
  card.querySelector('.go-card-ready').style.display = 'none';
  card.querySelector('.go-card-exit').style.display = 'block';
}

function setReadyBtn(ready) {
  const btn = document.getElementById('btn-ready');
  btn.querySelector('img').src = ready
    ? '/Resource/UI/result/ReadyButtonAfter.png'
    : '/Resource/UI/result/ReadyButtonBefore.png';
  btn.disabled = ready;
}

document.getElementById('btn-ready').onclick = () => {
  socket.emit('player-ready', { sessionId: myId });
};

socket.on('ready-updated', ({ readyPlayers }) => {
  readyPlayers.forEach(pid => {
    const card = document.querySelector(`.go-player-card[data-player-id="${pid}"]`);
    if (!card) return;
    const el = card.querySelector('.go-card-ready');
    if (el.style.display === 'block') return; // 이미 표시 중 → 애니메이션 재실행 안 함
    showReadyOverlay(el);
  });
  if (readyPlayers.includes(myId)) setReadyBtn(true);
});

socket.on('all-ready', () => {
  const cdEl = document.getElementById('ready-countdown');
  cdEl.style.display = 'block';
  let sec = 3;
  cdEl.textContent = `${sec}초 후 시작!`;
  countdownInterval = setInterval(() => {
    sec--;
    if (sec <= 0) { clearInterval(countdownInterval); countdownInterval = null; return; }
    cdEl.textContent = `${sec}초 후 시작!`;
  }, 1000);
});

// 새로고침 후 결과창 복원
const savedRanks = sessionStorage.getItem('gameOverRanks');
if (savedRanks) {
  const savedScores = sessionStorage.getItem('gameOverScores');
  showGameOverPanel(JSON.parse(savedRanks), savedScores ? JSON.parse(savedScores) : {});
}

socket.on('room-closed', () => {
  sessionStorage.removeItem('gameOverRanks');
  sessionStorage.removeItem('gameOverScores');
  alert('방장이 방을 나갔습니다. 로비로 이동합니다.');
  location.href = '/';
});

socket.on('error', ({ message }) => {
  if (message === 'invalid-play' || message === 'card-not-in-hand') {
    animateMessage('낼 수 없는 카드입니다', '#e94560');
  }
});

btnPlay.onclick = onBtnPlayClick;
btnPass.onclick = () => { if (!isCutscenePlaying()) socket.emit('pass', { sessionId: myId }); };
document.getElementById('btn-exit').onclick = () => {
  if (!confirm('게임을 나가시겠습니까?')) return;
  sessionStorage.removeItem('gameOverRanks');
  sessionStorage.removeItem('gameOverScores');
  socket.emit('leave-room', { sessionId: myId });
  location.href = '/';
};

// 플레이어 시트 — 원형 배치
// 원점: 화면 중앙(cx, cy), 타원 반지름(rx, ry), 모두 뷰포트 % 기준
const CX = 50, CY = 40, RX = 23, RY = 23;

function renderSeats() {
  seatsEl.innerHTML = '';
  mySeatEl.innerHTML = '';
  const order = originalOrder.length > 0 ? originalOrder : turnOrder;
  const total = order.length;
  if (total === 0) return;

  const myIdx = order.indexOf(myId);

  order.forEach((playerId, i) => {
    const p = players.find(p => p.id === playerId);
    if (!p) return;

    const isMe     = playerId === myId;
    const isActive = playerId === currentPlayerId;
    const rank     = playerRanks[playerId] || '';

    const div = document.createElement('div');
    div.className = ['player-seat',
      isMe     ? 'me'       : '',
      isActive ? 'active'   : '',
      p.finished ? 'finished' : '',
    ].filter(Boolean).join(' ');
    div.dataset.playerId = playerId;
    const charRank = rank || 'citizen';
    const shadowSrc = isActive
      ? `/Resource/UI/character/${charRank}-shadow-red.png`
      : `/Resource/UI/character/${charRank}-shadow.png`;
    const overlayImg = playerId === fallenPresidentId
      ? '/Resource/UI/game-state/fall.png'
      : (p.finished && playerRanks[playerId] !== 'scum')
        ? '/Resource/UI/game-state/allout.png'
        : '';
    div.innerHTML = `
      <div class="seat-char">
        <img class="seat-char-shadow" src="${shadowSrc}" alt="">
        <img class="seat-char-face" src="/Resource/UI/character/${charRank}-face.png" alt="">
        ${overlayImg ? `<img class="seat-overlay" src="${overlayImg}" alt="">` : ''}
      </div>
      <div class="seat-content">
        <div class="seat-name">${p.nickname}</div>
        <div class="seat-cards">${p.finished ? '완료' : p.cardCount + '장'}</div>
      </div>
    `;

    if (isMe) {
      mySeatEl.appendChild(div);
      return;
    }
    // 나를 아래(90°)에 고정, 나머지를 시계 방향으로 배분
    const offset = (i - myIdx + total) % total;
    const deg = 90 + offset * (360 / total);
    const rad = deg * Math.PI / 180;
    div.style.left = `${CX + RX * Math.cos(rad)}%`;
    div.style.top  = `${CY + RY * Math.sin(rad)}%`;
    seatsEl.appendChild(div);
  });
}

function renderScorePanel(scores) {
  const s = scores || {};
  const order = originalOrder.length > 0 ? originalOrder : turnOrder;
  const rows = [...order]
    .sort((a, b) => (s[b] ?? 0) - (s[a] ?? 0))
    .map(pid => {
      const p = players.find(p => p.id === pid);
      const name = p ? p.nickname : pid;
      const val = s[pid] ?? 0;
      return `<div class="score-row"><span class="score-name">${name}</span><span class="score-val">${val}점</span></div>`;
    }).join('');
  scorePanelEl.innerHTML = `<div class="score-title">누적 점수</div>${rows}`;
}

function updateSeats() {
  const order = originalOrder.length > 0 ? originalOrder : turnOrder;
  const allExist = order.every(pid => {
    const c = pid === myId ? mySeatEl : seatsEl;
    return !!c.querySelector(`[data-player-id="${pid}"]`);
  });
  if (!allExist) { renderSeats(); return; }
  order.forEach(playerId => {
    const p = players.find(p => p.id === playerId);
    if (!p) return;
    const isActive = !roundEndAnimating && playerId === currentPlayerId;
    const container = playerId === myId ? mySeatEl : seatsEl;
    const div = container.querySelector(`[data-player-id="${playerId}"]`);
    div.classList.toggle('active', isActive);
    div.classList.toggle('finished', p.finished);
    const cardsEl = div.querySelector('.seat-cards');
    if (cardsEl) cardsEl.textContent = p.finished ? '완료' : p.cardCount + '장';
    const shadowImg = div.querySelector('.seat-char-shadow');
    if (shadowImg) {
      const rank = playerRanks[playerId] || 'citizen';
      shadowImg.src = isActive
        ? `/Resource/UI/character/${rank}-shadow-red.png`
        : `/Resource/UI/character/${rank}-shadow.png`;
    }
    const charDiv = div.querySelector('.seat-char');
    if (charDiv) {
      const overlaySrc = playerId === fallenPresidentId
        ? '/Resource/UI/game-state/fall.png'
        : (p.finished && playerRanks[playerId] !== 'scum')
          ? '/Resource/UI/game-state/allout.png'
          : '';
      let overlayImg = div.querySelector('.seat-overlay');
      if (overlaySrc) {
        if (!overlayImg) {
          overlayImg = document.createElement('img');
          overlayImg.className = 'seat-overlay';
          overlayImg.alt = '';
          charDiv.appendChild(overlayImg);
        }
        overlayImg.src = overlaySrc;
      } else if (overlayImg) {
        overlayImg.remove();
      }
    }
  });
}

function updateHandSelectability() {
  const isTaxSelecting = taxPhase && taxPhase.taxReturnCount > 0 && !taxSubmitted;
  const isMyTurn = currentPlayerId === myId;
  const selectable = isTaxSelecting
    ? (selectedCards.length >= taxPhase.taxReturnCount ? new Set(selectedCards) : new Set(myHand))
    : computeSelectableSet(myHand, selectedCards, currentTableCards, currentRevolution);
  const tempSel = [...selectedCards];
  handEl.querySelectorAll('.hand-card').forEach(div => {
    const card = div.dataset.card;
    const idx = tempSel.indexOf(card);
    const isSelected = idx !== -1;
    if (isSelected) tempSel.splice(idx, 1);
    div.classList.toggle('selected', isSelected);
    div.classList.toggle('dimmed', !isSelected && !selectable.has(card));
  });
  if (isTaxSelecting) {
    myAreaEl.classList.add('active');
    btnPlay.disabled = selectedCards.length !== taxPhase.taxReturnCount;
  } else {
    myAreaEl.classList.toggle('active', isMyTurn);
    btnPass.disabled = !isMyTurn;
    btnPlay.disabled = !isMyTurn || selectedCards.length === 0;
  }
}

function renderHand() {
  const isTaxSelecting = taxPhase && taxPhase.taxReturnCount > 0 && !taxSubmitted;
  const isMyTurn = currentPlayerId === myId;
  const selectable = isTaxSelecting
    ? (selectedCards.length >= taxPhase.taxReturnCount ? new Set(selectedCards) : new Set(myHand))
    : computeSelectableSet(myHand, selectedCards, currentTableCards, currentRevolution);
  const tempSel = [...selectedCards];
  handEl.innerHTML = '';
  const n = myHand.length;
  const totalAngle = Math.min(12, n - 1);

  myHand.forEach((card, i) => {
    const isSelected = (() => {
      const idx = tempSel.indexOf(card);
      if (idx !== -1) { tempSel.splice(idx, 1); return true; }
      return false;
    })();
    const isDimmed = !isSelected && !selectable.has(card);
    const div = document.createElement('div');
    div.className = ['hand-card', isSelected && 'selected', isDimmed && 'dimmed'].filter(Boolean).join(' ');
    div.dataset.card = card;
    div.innerHTML = `<img src="${cardImg(card)}" alt="${card}">`;
    div.onclick = () => toggleCard(card);

    const angleDeg = n <= 1 ? 0 : (i - (n - 1) / 2) / (n - 1) * totalAngle;
    const maxHalf = totalAngle / 2;
    const drop = maxHalf > 0 ? (angleDeg / maxHalf) ** 2 * 25 * (totalAngle / 12) : 0;
    div.style.setProperty('--rot', `${angleDeg}deg`);
    div.style.setProperty('--drop', `${drop}px`);

    handEl.appendChild(div);
  });

  if (isTaxSelecting) {
    myAreaEl.classList.add('active');
    btnPlay.disabled = selectedCards.length !== taxPhase.taxReturnCount;
  } else {
    myAreaEl.classList.toggle('active', isMyTurn);
    btnPass.disabled = !isMyTurn;
    btnPlay.disabled = !isMyTurn || selectedCards.length === 0;
  }
}

function toggleCard(card) {
  const isTaxSelecting = taxPhase && taxPhase.taxReturnCount > 0 && !taxSubmitted;
  if (!isTaxSelecting && currentPlayerId !== myId) return;
  const idx = selectedCards.indexOf(card);
  if (idx === -1) selectedCards.push(card);
  else selectedCards.splice(idx, 1);
  renderHand();
}

function addCardGroupToTable(cards, animate = true) {
  const group = document.createElement('div');
  group.className = 'table-group';
  const ox = (Math.random() - 0.5) * 120;
  const oy = (Math.random() - 0.5) * 80;
  const rot = (Math.random() - 0.5) * 30;
  group.style.transform = `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px)) rotate(${rot}deg)`;
  cards.forEach(card => {
    const div = document.createElement('div');
    div.className = 'table-card';
    div.innerHTML = `<img src="${cardImg(card)}" alt="${card}">`;
    group.appendChild(div);
  });
  tableEl.appendChild(group);
  if (animate) {
    lockAnim();
    gsap.from(group, { scale: 0.6, opacity: 0, duration: 0.45, clearProps: 'opacity' });
    setTimeout(unlockAnim, 500);
  }
}

function renderTablePile(pile) {
  tableEl.innerHTML = '';
  pile.forEach(cards => addCardGroupToTable(cards, false));
}

let _cardOrderKey = null;
function renderCardOrder() {
  const nonJoker = currentTableCards.filter(c => c !== 'Joker');
  const activeRank = currentTableCards.length === 0 ? null
    : nonJoker.length > 0 ? nonJoker[0].slice(0, -1) : 'Joker';
  const key = `${currentRevolution}|${activeRank}`;
  if (key === _cardOrderKey) return;
  _cardOrderKey = key;

  const order = currentRevolution
    ? ['2','A','K','Q','J','10','9','8','7','6','5','4','3','Joker']
    : ['3','4','5','6','7','8','9','10','J','Q','K','A','2','Joker'];

  const last = order.length - 1;
  const ranks = order.map((rank, i) => {
    const isActive = rank === activeRank;
    const color = isActive ? '#e94560' : '#ccc';
    const weight = isActive ? 'bold' : '400';
    const sep = i < last ? '<span class="order-sep">&lt;</span>' : '';
    return `<span class="order-rank" style="color:${color};font-weight:${weight}">${rank}</span>${sep}`;
  }).join('');

  orderBarEl.innerHTML = `<span class="order-label">강약</span>${ranks}`;
  document.getElementById('revolution-indicator').style.display = currentRevolution ? 'block' : 'none';
}



function animateMessage(text, color = '#fff') {
  const el = document.createElement('div');
  el.textContent = text;
  Object.assign(el.style, {
    position: 'fixed', top: '38%', left: '50%', transform: 'translateX(-50%)',
    fontSize: '1.8rem', fontWeight: 'bold', color, zIndex: 999, pointerEvents: 'none',
    textShadow: '0 2px 8px rgba(0,0,0,.8)', whiteSpace: 'nowrap',
  });
  document.body.appendChild(el);
  gsap.fromTo(el, { y: 0, opacity: 1 }, { y: -60, opacity: 0, duration: 1.4, onComplete: () => el.remove() });
}

function rankLabel(rank) {
  const map = { president:'대부호', 'vice-president':'부호', citizen:'평민', 'vice-scum':'빈민', scum:'대빈민' };
  return map[rank] || rank;
}
function rankImg(rank) {
  if (!rank) return '';
  return `/Resource/UI/rank-badge/${rank}.png`;
}

myAreaEl.classList.toggle('active', currentPlayerId === myId);

if (myHand.length > 0) {
  renderHand();
  renderSeats();
}
renderCardOrder();

function scaleGameBoard() {
  const scale = Math.min(window.innerWidth / 2000, window.innerHeight / 900);
  const board = document.getElementById('game-board');
  board.style.transform = `scale(${scale})`;
  board.style.left = `${(window.innerWidth - 2000 * scale) / 2}px`;
  board.style.top  = `${(window.innerHeight - 900 * scale) / 2}px`;
}
window.addEventListener('resize', scaleGameBoard);
scaleGameBoard();

window.onCutsceneQueueEmpty = () => {
  if (currentPlayerId === myId) { tryAutoPass(); tryAutoPlay(); }
  tryAutoTax();
};

// 채팅
const chatMessagesEl = document.getElementById('chat-messages');
const chatInputEl    = document.getElementById('chat-input');
const chatSendEl     = document.getElementById('chat-send');
console.log('[chat] elements:', { chatMessagesEl, chatInputEl, chatSendEl });

function sendChat() {
  const msg = chatInputEl.value.trim();
  console.log('[chat] sendChat() called, msg:', JSON.stringify(msg), '| myId:', myId);
  if (!msg) { console.log('[chat] sendChat() — empty msg, abort'); return; }
  console.log('[chat] emitting chat-message to server');
  socket.emit('chat-message', { sessionId: myId, message: msg });
  chatInputEl.value = '';
}

chatSendEl.addEventListener('click', () => { console.log('[chat] send button clicked'); sendChat(); });
chatInputEl.addEventListener('keydown', e => {
  console.log('[chat] keydown:', e.key);
  if (e.key === 'Enter') sendChat();
});
chatInputEl.addEventListener('input', e => {
  console.log('[chat] input event, value:', chatInputEl.value);
});
chatInputEl.addEventListener('focus', () => console.log('[chat] input focused'));
chatInputEl.addEventListener('blur',  () => console.log('[chat] input blurred'));

function renderChatMsg({ senderId, nickname, message }) {
  const isMine = senderId === myId;
  const div = document.createElement('div');
  div.className = `chat-msg${isMine ? ' mine' : ''}`;
  div.innerHTML = `<span class="chat-nick">${nickname}</span><span class="chat-text">${message.replace(/</g, '&lt;')}</span>`;
  chatMessagesEl.appendChild(div);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

socket.on('chat-message', ({ senderId, nickname, message }) => {
  console.log('[chat] received chat-message — senderId:', senderId, '| nickname:', nickname, '| message:', message);
  renderChatMsg({ senderId, nickname, message });
  console.log('[chat] message appended, total messages:', chatMessagesEl.children.length);
});
