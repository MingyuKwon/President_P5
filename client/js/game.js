const socket = io();
const params = new URLSearchParams(location.search);
const roomId = params.get('id');
const nickname = sessionStorage.getItem('nickname');
if (!nickname || !roomId) location.href = '/';

const CARD_BACK = '/Resource/CardImage/Card-back.png';
function cardImg(card) {
  if (card === 'Joker') return '/Resource/CardImage/Joker.png';
  return `/Resource/CardImage/${card}.png`;
}

let myHand = JSON.parse(sessionStorage.getItem('hand') || '[]');
let selectedCards = [];
let myId = null;
let currentPlayerId = sessionStorage.getItem('currentPlayerId');
let players = [];

const opponentsEl = document.getElementById('opponents');
const tableEl = document.getElementById('table');
const handEl = document.getElementById('hand');
const statusEl = document.getElementById('status-bar');
const btnPlay = document.getElementById('btn-play');
const btnPass = document.getElementById('btn-pass');
const revBadge = document.getElementById('revolution-badge');
const myNicknameEl = document.getElementById('my-nickname');
const myRankEl = document.getElementById('my-rank');

socket.on('connect', () => {
  myId = socket.id;
  myNicknameEl.textContent = nickname;
  socket.emit('join-room', { roomId, nickname });
});

socket.on('game-started', ({ hand, turnOrder, currentPlayerId: cpId }) => {
  myHand = hand;
  currentPlayerId = cpId;
  selectedCards = [];
  renderHand();
  updateStatus(cpId);
});

socket.on('state-updated', ({ tableCards, currentPlayerId: cpId, passCount, revolution, players: ps }) => {
  currentPlayerId = cpId;
  players = ps;
  renderOpponents();
  renderTable(tableCards);
  updateStatus(cpId);
  revBadge.style.display = revolution ? 'block' : 'none';
  const isMyTurn = cpId === myId;
  btnPass.disabled = !isMyTurn;
  btnPlay.disabled = !isMyTurn || selectedCards.length === 0;
});

socket.on('hand-updated', ({ hand }) => {
  myHand = hand;
  selectedCards = [];
  renderHand();
  btnPlay.disabled = true;
});

socket.on('round-end', ({ reason }) => {
  if (reason === '8-clear') animateMessage('8-Clear!');
  else if (reason === 'spade-reversal') animateMessage('♠ Reversal!');
  gsap.to('#table .table-card', {
    opacity: 0, y: -20, duration: 0.4, stagger: 0.05,
    onComplete: () => { tableEl.innerHTML = ''; },
  });
});

socket.on('revolution', ({ active }) => {
  animateMessage(active ? '혁명 발동!' : '반혁명!');
});

socket.on('player-finished', ({ playerId, rank }) => {
  const p = players.find(p => p.id === playerId);
  const name = p ? p.nickname : playerId;
  animateMessage(`${name} — ${rankLabel(rank)}`);
  if (playerId === myId) myRankEl.textContent = rankLabel(rank);
});

socket.on('president-penalty', ({ playerId }) => {
  const p = players.find(p => p.id === playerId);
  animateMessage(`${p ? p.nickname : playerId} 대부호 방어 실패!`, '#e94560');
});

socket.on('game-over', ({ ranks }) => {
  const self = players.find(p => p.id === myId);
  const myRank = ranks[myId];
  const lines = Object.entries(ranks).map(([id, rank]) => {
    const p = players.find(p => p.id === id);
    return `${rankLabel(rank)}: ${p ? p.nickname : id}`;
  }).join('\n');
  setTimeout(() => {
    if (confirm(`게임 종료!\n\n${lines}\n\n다시 대기실로 돌아가시겠습니까?`)) {
      location.href = `room.html?id=${roomId}`;
    }
  }, 800);
});

socket.on('error', ({ message }) => {
  animateMessage('낼 수 없는 카드입니다', '#e94560');
});

btnPlay.onclick = () => {
  if (selectedCards.length === 0) return;
  socket.emit('play-cards', { cards: [...selectedCards] });
};
btnPass.onclick = () => socket.emit('pass');

function renderHand() {
  handEl.innerHTML = '';
  myHand.forEach((card, i) => {
    const div = document.createElement('div');
    div.className = 'hand-card';
    div.dataset.card = card;
    div.innerHTML = `<img src="${cardImg(card)}" alt="${card}">`;
    div.onclick = () => toggleCard(div, card);
    handEl.appendChild(div);
    gsap.from(div, { y: 60, opacity: 0, duration: 0.3, delay: i * 0.04 });
  });
}

function toggleCard(el, card) {
  if (currentPlayerId !== myId) return;
  const idx = selectedCards.indexOf(card);
  if (idx === -1) {
    selectedCards.push(card);
    el.classList.add('selected');
  } else {
    selectedCards.splice(idx, 1);
    el.classList.remove('selected');
  }
  btnPlay.disabled = currentPlayerId !== myId || selectedCards.length === 0;
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

function renderOpponents() {
  const opponents = players.filter(p => p.id !== myId);
  opponentsEl.innerHTML = opponents.map(p => `
    <div class="opponent ${p.finished ? 'finished' : ''} ${p.id === currentPlayerId ? 'active' : ''}">
      <div class="card-count">${p.finished ? '✓' : p.cardCount}</div>
      <div style="font-size:0.85rem">${p.nickname}</div>
    </div>
  `).join('');
}

function updateStatus(cpId) {
  if (!cpId) { statusEl.textContent = ''; return; }
  if (cpId === myId) {
    statusEl.textContent = '내 턴 — 카드를 선택하세요';
    gsap.fromTo(statusEl, { scale: 1.2, color: '#e94560' }, { scale: 1, color: '#fff', duration: 0.4 });
  } else {
    const p = players.find(p => p.id === cpId);
    statusEl.textContent = p ? `${p.nickname}의 턴` : '';
  }
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
  gsap.fromTo(el, { y: 0, opacity: 1 }, { y: -60, opacity: 0, duration: 1.4,
    onComplete: () => el.remove() });
}

function rankLabel(rank) {
  const map = { president:'대부호', 'vice-president':'부호', citizen:'평민', 'vice-scum':'빈민', scum:'대빈민' };
  return map[rank] || rank;
}

if (myHand.length > 0) {
  renderHand();
  updateStatus(currentPlayerId);
}
