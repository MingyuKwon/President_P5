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
      const eligible = pool.filter(c => c === 'Joker' || (testNum && c.slice(0, -1) === testNum) || !testNum);
      if (eligible.length >= N - testSel.length) {
        const sorted = [...eligible].sort((a, b) =>
          (b === 'Joker' ? 1 : 0) - (a === 'Joker' ? 1 : 0) || playRank(b, revolution) - playRank(a, revolution)
        );
        if (canBeat([...testSel, ...sorted.slice(0, N - testSel.length)], tableCards, revolution)) result.add(card);
      }
    }
  }
  return result;
}

let myHand = sortHand(JSON.parse(sessionStorage.getItem('hand') || '[]'));
let selectedCards = [];
let currentPlayerId = sessionStorage.getItem('currentPlayerId');
let players = JSON.parse(sessionStorage.getItem('players') || '[]');
let turnOrder = JSON.parse(sessionStorage.getItem('turnOrder') || '[]');
let originalOrder = [...turnOrder];
let playerRanks = {};
players.forEach(p => { if (p.rank) playerRanks[p.id] = p.rank; });
let currentTableCards = [];
let currentRevolution = false;

const seatsEl        = document.getElementById('player-seats');
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

function clearAutoPassTimer() {
  if (autoPassTimer) { clearTimeout(autoPassTimer); autoPassTimer = null; }
}

function tryAutoPass() {
  if (!autoPass || currentPlayerId !== myId) return;
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
  if (!autoPass) clearAutoPassTimer();
  else tryAutoPass();
};

let autoPlay = false;
let autoPlayTimer = null;
const gameBoardEl = document.getElementById('game-board');

function clearAutoPlayTimer() {
  if (autoPlayTimer) { clearTimeout(autoPlayTimer); autoPlayTimer = null; }
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
  if (!autoPlay || currentPlayerId !== myId) return;
  clearAutoPlayTimer();
  autoPlayTimer = setTimeout(() => {
    if (!autoPlay || currentPlayerId !== myId) return;
    const cards = selectCardsToPlay();
    if (cards) socket.emit('play-cards', { cards, sessionId: myId });
    else socket.emit('pass', { sessionId: myId });
  }, 1000);
}

btnAuto.onclick = () => {
  autoPlay = !autoPlay;
  btnAuto.classList.toggle('on', autoPlay);
  gameBoardEl.classList.toggle('auto-mode', autoPlay);
  if (!autoPlay) clearAutoPlayTimer();
  else tryAutoPlay();
};

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
    timerEl.textContent = `${remaining}초`;
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

socket.on('game-started', ({ hand, turnOrder: to, currentPlayerId: cpId, players: ps }) => {
  myHand = sortHand(hand);
  currentPlayerId = cpId;
  turnOrder = to;
  originalOrder = [...to];
  players = ps;
  selectedCards = [];
  currentTableCards = [];
  currentRevolution = false;
  playerRanks = {};
  ps.forEach(p => { if (p.rank) playerRanks[p.id] = p.rank; });
  renderHand();   // 버튼 상태 포함
  renderSeats();
  renderCardOrder();
});

socket.on('game-state-sync', ({ hand, tableCards, tablePile, currentPlayerId: cpId, revolution, players: ps, turnOrder: to }) => {
  myHand = sortHand(hand);
  currentPlayerId = cpId;
  currentTableCards = tableCards || [];
  currentRevolution = revolution;
  players = ps;
  if (to.length > 0) { turnOrder = to; if (originalOrder.length === 0) originalOrder = [...to]; }
  selectedCards = [];
  renderHand();
  renderSeats();
  renderTablePile(tablePile || []);
  renderCardOrder();
});

socket.on('state-updated', ({ tableCards, tablePile, currentPlayerId: cpId, revolution, players: ps }) => {
  const wasMyTurn = currentPlayerId === myId;
  currentPlayerId = cpId;
  players = ps;
  currentTableCards = tableCards || [];
  currentRevolution = revolution;
  if (wasMyTurn && cpId !== myId) { selectedCards = []; clearAutoPassTimer(); clearAutoPlayTimer(); }
  renderSeats();
  renderHand();
  renderCardOrder();
  if (cpId === myId) { tryAutoPass(); tryAutoPlay(); }
});

socket.on('card-played', ({ cards }) => {
  addCardGroupToTable(cards);
});

socket.on('hand-updated', ({ hand }) => {
  myHand = sortHand(hand);
  selectedCards = [];
  renderHand();
});

socket.on('turn-timer', ({ playerId, duration }) => {
  startTimerUI(playerId, duration);
});

socket.on('round-end', ({ reason }) => {
  clearTimerUI();
  clearAutoPassTimer();
  clearAutoPlayTimer();
  if (reason === '8-clear') animateMessage('8-Clear!');
  else if (reason === 'spade-reversal') animateMessage('♠ Reversal!');
  gsap.to('#table .table-group', {
    opacity: 0, y: -20, duration: 0.4, stagger: 0.05,
    onComplete: () => { tableEl.innerHTML = ''; },
  });
  // state-updated가 round-end보다 먼저 도착하므로, 내 차례면 재트리거
  if (currentPlayerId === myId) { tryAutoPass(); tryAutoPlay(); }
});

socket.on('revolution', ({ active }) => animateMessage(active ? '혁명 발동!' : '반혁명!'));

socket.on('player-finished', ({ playerId, rank }) => {
  const p = players.find(p => p.id === playerId);
  animateMessage(`${p ? p.nickname : playerId} — ${rankLabel(rank)}`);
  playerRanks[playerId] = rank;
  renderSeats();
});

socket.on('president-penalty', ({ playerId }) => {
  const p = players.find(p => p.id === playerId);
  animateMessage(`${p ? p.nickname : playerId} 대부호 방어 실패!`, '#e94560');
});

socket.on('game-over', ({ ranks }) => {
  clearTimerUI();
  const lines = Object.entries(ranks).map(([id, rank]) => {
    const p = players.find(p => p.id === id);
    return `${rankLabel(rank)}: ${p ? p.nickname : id}`;
  }).join('\n');
  setTimeout(() => {
    if (confirm(`게임 종료!\n\n${lines}\n\n대기실로 돌아가시겠습니까?`)) {
      location.href = `room.html?id=${roomId}`;
    }
  }, 800);
});

socket.on('error', ({ message }) => {
  console.log('[error] server error:', message);
  if (message === 'invalid-play' || message === 'card-not-in-hand') {
    animateMessage('낼 수 없는 카드입니다', '#e94560');
  }
});

btnPlay.onclick = () => {
  console.log('[play] click — selectedCards:', [...selectedCards], '| myId:', myId, '| currentPlayerId:', currentPlayerId, '| disabled:', btnPlay.disabled);
  if (selectedCards.length === 0) { console.warn('[play] selectedCards 비어있음, 전송 취소'); return; }
  socket.emit('play-cards', { cards: [...selectedCards], sessionId: myId });
};
btnPass.onclick = () => socket.emit('pass', { sessionId: myId });
document.getElementById('btn-exit').onclick = () => {
  if (!confirm('게임을 나가시겠습니까?')) return;
  socket.emit('leave-room', { sessionId: myId });
  location.href = '/';
};

// 플레이어 시트 — 원형 배치
// 원점: 화면 중앙(cx, cy), 타원 반지름(rx, ry), 모두 뷰포트 % 기준
const CX = 50, CY = 38, RX = 36, RY = 26;

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
    div.innerHTML = `
      <img class="seat-frame" src="/Resource/UI/seat_frame.png" alt="">
      <div class="seat-content">
        <div class="seat-name">${p.nickname}</div>
        <div class="seat-cards">${p.finished ? '완료' : p.cardCount + '장'}</div>
        ${rank ? `<div class="seat-rank"><img src="${rankImg(rank)}" alt="${rankLabel(rank)}"></div>` : ''}
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

function renderHand() {
  const isMyTurn = currentPlayerId === myId;
  const selectable = computeSelectableSet(myHand, selectedCards, currentTableCards, currentRevolution);
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
    const drop = maxHalf > 0 ? (angleDeg / maxHalf) ** 2 * 20 : 0;
    div.style.setProperty('--rot', `${angleDeg}deg`);
    div.style.setProperty('--drop', `${drop}px`);

    handEl.appendChild(div);
  });
  myAreaEl.classList.toggle('active', isMyTurn);
  btnPass.disabled = !isMyTurn;
  btnPlay.disabled = !isMyTurn || selectedCards.length === 0;
}

function toggleCard(card) {
  if (currentPlayerId !== myId) return;
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
  if (animate) gsap.from(group, { scale: 0.6, opacity: 0, duration: 0.25, clearProps: 'opacity' });
}

function renderTablePile(pile) {
  tableEl.innerHTML = '';
  pile.forEach(cards => addCardGroupToTable(cards, false));
}

function renderCardOrder() {
  const order = currentRevolution
    ? ['2','A','K','Q','J','10','9','8','7','6','5','4','3','Joker']
    : ['3','4','5','6','7','8','9','10','J','Q','K','A','2','Joker'];

  const nonJoker = currentTableCards.filter(c => c !== 'Joker');
  const activeRank = currentTableCards.length === 0 ? null
    : nonJoker.length > 0 ? nonJoker[0].slice(0, -1)
    : 'Joker';

  const last = order.length - 1;
  const ranks = order.map((rank, i) => {
    const isActive = rank === activeRank;
    const color = isActive ? '#e94560' : '#ccc';
    const weight = isActive ? 'bold' : '400';
    const sep = i < last ? '<span class="order-sep">&lt;</span>' : '';
    return `<span class="order-rank" style="color:${color};font-weight:${weight}">${rank}</span>${sep}`;
  }).join('');

  const revTag = currentRevolution
    ? '<span class="order-rev">혁명!</span>'
    : '';
  orderBarEl.innerHTML = `<span class="order-label">강약</span>${ranks}${revTag}`;
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
  return `/Resource/UI/rank_${rank}.png`;
}

myAreaEl.classList.toggle('active', currentPlayerId === myId);

if (myHand.length > 0) {
  renderHand();
  renderSeats();
}
renderCardOrder();

function scaleGameBoard() {
  const scale = Math.min(window.innerWidth / 1350, window.innerHeight / 900);
  const board = document.getElementById('game-board');
  board.style.transform = `scale(${scale})`;
  board.style.left = `${(window.innerWidth - 1350 * scale) / 2}px`;
  board.style.top  = `${(window.innerHeight - 900 * scale) / 2}px`;
}
window.addEventListener('resize', scaleGameBoard);
scaleGameBoard();
