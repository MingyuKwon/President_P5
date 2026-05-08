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

const seatsEl  = document.getElementById('player-seats');
const tableEl  = document.getElementById('table');
const handEl   = document.getElementById('hand');
const myAreaEl = document.getElementById('my-area');
const btnPlay  = document.getElementById('btn-play');
const btnPass  = document.getElementById('btn-pass');
const revBadge = document.getElementById('revolution-badge');

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
  revBadge.style.display = 'none';
  renderHand();   // 버튼 상태 포함
  renderSeats();
});

socket.on('game-state-sync', ({ hand, tableCards, currentPlayerId: cpId, revolution, players: ps, turnOrder: to }) => {
  myHand = sortHand(hand);
  currentPlayerId = cpId;
  currentTableCards = tableCards || [];
  currentRevolution = revolution;
  players = ps;
  if (to.length > 0) { turnOrder = to; if (originalOrder.length === 0) originalOrder = [...to]; }
  selectedCards = [];
  revBadge.style.display = revolution ? 'block' : 'none';
  renderHand();
  renderSeats();
  renderTable(tableCards);
});

socket.on('state-updated', ({ tableCards, currentPlayerId: cpId, revolution, players: ps }) => {
  const wasMyTurn = currentPlayerId === myId;
  currentPlayerId = cpId;
  players = ps;
  currentTableCards = tableCards || [];
  currentRevolution = revolution;
  if (wasMyTurn && cpId !== myId) selectedCards = [];
  renderSeats();
  renderTable(tableCards);
  revBadge.style.display = revolution ? 'block' : 'none';
  renderHand();
});

socket.on('hand-updated', ({ hand }) => {
  myHand = sortHand(hand);
  selectedCards = [];
  renderHand();
});

socket.on('round-end', ({ reason }) => {
  if (reason === '8-clear') animateMessage('8-Clear!');
  else if (reason === 'spade-reversal') animateMessage('♠ Reversal!');
  gsap.to('#table .table-card', {
    opacity: 0, y: -20, duration: 0.4, stagger: 0.05,
    onComplete: () => { tableEl.innerHTML = ''; },
  });
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
  myAreaEl.querySelector('.player-seat.me')?.remove();
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
      // #my-area 자식으로 붙여야 브라우저 크기에 반응
      // 50% = #my-area 폭(= 뷰포트 폭) 기준
      div.style.cssText = 'position:absolute; left:50%; bottom:calc(100% + 10px); top:auto; transform:translate(-50%,0);';
      myAreaEl.appendChild(div);
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
  myHand.forEach((card) => {
    const isSelected = (() => {
      const i = tempSel.indexOf(card);
      if (i !== -1) { tempSel.splice(i, 1); return true; }
      return false;
    })();
    const isDimmed = !isSelected && !selectable.has(card);
    const div = document.createElement('div');
    div.className = ['hand-card', isSelected && 'selected', isDimmed && 'dimmed'].filter(Boolean).join(' ');
    div.dataset.card = card;
    div.innerHTML = `<img src="${cardImg(card)}" alt="${card}">`;
    div.onclick = () => toggleCard(card);
    handEl.appendChild(div);
  });
  myAreaEl.classList.toggle('active', isMyTurn);
  btnPass.disabled = !isMyTurn || currentTableCards.length === 0;
  btnPlay.disabled = !isMyTurn || selectedCards.length === 0;
}

function toggleCard(card) {
  if (currentPlayerId !== myId) return;
  const idx = selectedCards.indexOf(card);
  if (idx === -1) selectedCards.push(card);
  else selectedCards.splice(idx, 1);
  renderHand();
}

function renderTable(cards) {
  if (!cards || cards.length === 0) return;
  tableEl.innerHTML = '';
  cards.forEach((card, i) => {
    const div = document.createElement('div');
    div.className = 'table-card';
    div.innerHTML = `<img src="${cardImg(card)}" alt="${card}">`;
    tableEl.appendChild(div);
    gsap.from(div, { scale: 0.5, opacity: 0, duration: 0.25, delay: i * 0.06 });
  });
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
