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

let myHand = sortHand(JSON.parse(sessionStorage.getItem('hand') || '[]'));
let selectedCards = [];
let currentPlayerId = sessionStorage.getItem('currentPlayerId');
let players = JSON.parse(sessionStorage.getItem('players') || '[]');
let turnOrder = JSON.parse(sessionStorage.getItem('turnOrder') || '[]');

const turnListEl = document.getElementById('turn-list');
const tableEl = document.getElementById('table');
const handEl = document.getElementById('hand');
const statusEl = document.getElementById('status-bar');
const btnPlay = document.getElementById('btn-play');
const btnPass = document.getElementById('btn-pass');
const revBadge = document.getElementById('revolution-badge');
const myNicknameEl = document.getElementById('my-nickname');
const myRankEl = document.getElementById('my-rank');

socket.on('connect', () => {
  myNicknameEl.textContent = nickname;
  socket.emit('join-room', { roomId, nickname, sessionId: myId });
});

socket.on('game-started', ({ hand, turnOrder: to, currentPlayerId: cpId, players: ps }) => {
  myHand = sortHand(hand);
  currentPlayerId = cpId;
  turnOrder = to;
  players = ps;
  selectedCards = [];
  renderHand();
  renderTurnPanel();
  updateStatus(cpId);
});

socket.on('state-updated', ({ tableCards, currentPlayerId: cpId, revolution, players: ps }) => {
  currentPlayerId = cpId;
  players = ps;
  renderTurnPanel();
  renderTable(tableCards);
  updateStatus(cpId);
  revBadge.style.display = revolution ? 'block' : 'none';
  const isMyTurn = cpId === myId;
  btnPass.disabled = !isMyTurn;
  btnPlay.disabled = !isMyTurn || selectedCards.length === 0;
});

socket.on('hand-updated', ({ hand }) => {
  myHand = sortHand(hand);
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

socket.on('revolution', ({ active }) => animateMessage(active ? '혁명 발동!' : '반혁명!'));

socket.on('player-finished', ({ playerId, rank }) => {
  const p = players.find(p => p.id === playerId);
  animateMessage(`${p ? p.nickname : playerId} — ${rankLabel(rank)}`);
  if (playerId === myId) myRankEl.textContent = rankLabel(rank);
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

socket.on('error', () => animateMessage('낼 수 없는 카드입니다', '#e94560'));

btnPlay.onclick = () => {
  if (selectedCards.length === 0) return;
  socket.emit('play-cards', { cards: [...selectedCards], sessionId: myId });
};
btnPass.onclick = () => socket.emit('pass', { sessionId: myId });

function renderTurnPanel() {
  // turnOrder 기준으로 정렬, 완료된 플레이어는 뒤로
  const ordered = turnOrder.map(id => players.find(p => p.id === id)).filter(Boolean);
  const finished = players.filter(p => p.finished && !turnOrder.includes(p.id));

  turnListEl.innerHTML = [...ordered, ...finished].map((p, i) => {
    const isActive = p.id === currentPlayerId;
    const isMe = p.id === myId;
    const classes = [
      isActive ? 'active' : '',
      p.finished ? 'finished' : '',
      isMe ? 'me' : '',
    ].filter(Boolean).join(' ');

    return `
      <div class="turn-row ${classes}">
        <span class="turn-num">${p.finished ? '✓' : i + 1}</span>
        <span class="turn-name">${p.nickname}${isMe ? ' (나)' : ''}</span>
        <span class="turn-cards">${p.finished ? '' : p.cardCount + '장'}</span>
        ${isActive ? '<span class="turn-arrow">◀</span>' : ''}
      </div>
    `;
  }).join('');
}

function renderHand() {
  handEl.innerHTML = '';
  const isMyTurn = currentPlayerId === myId;
  myHand.forEach((card) => {
    const div = document.createElement('div');
    div.className = 'hand-card' + (isMyTurn ? ' my-turn-card' : '');
    div.dataset.card = card;
    div.innerHTML = `<img src="${cardImg(card)}" alt="${card}">`;
    div.onclick = () => toggleCard(div, card);
    handEl.appendChild(div);
  });
}

function toggleCard(el, card) {
  if (currentPlayerId !== myId) return;
  const idx = selectedCards.indexOf(card);
  if (idx === -1) { selectedCards.push(card); el.classList.add('selected'); }
  else { selectedCards.splice(idx, 1); el.classList.remove('selected'); }
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

const myAreaEl = document.getElementById('my-area');
const vignetteEl = document.getElementById('vignette');

function setMyTurn(isMyTurn) {
  myAreaEl.classList.toggle('my-turn', isMyTurn);
  vignetteEl.classList.toggle('active', isMyTurn);
  document.querySelectorAll('.hand-card').forEach(el => {
    el.classList.toggle('my-turn-card', isMyTurn);
  });
}

function updateStatus(cpId) {
  if (!cpId) { statusEl.textContent = ''; return; }
  const isMyTurn = cpId === myId;
  setMyTurn(isMyTurn);
  if (isMyTurn) {
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
  gsap.fromTo(el, { y: 0, opacity: 1 }, { y: -60, opacity: 0, duration: 1.4, onComplete: () => el.remove() });
}

function rankLabel(rank) {
  const map = { president:'대부호', 'vice-president':'부호', citizen:'평민', 'vice-scum':'빈민', scum:'대빈민' };
  return map[rank] || rank;
}

if (myHand.length > 0) {
  renderHand();
  renderTurnPanel();
  updateStatus(currentPlayerId);
}
