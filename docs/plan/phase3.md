# Phase 3: 클라이언트 UI — ✅ 완료

> 로비, 대기실, 게임 화면 구현 + GSAP 애니메이션.
> 에셋은 나중에 교체 예정이므로 기능 동작 우선, 스타일은 최소한으로.

---

## 파일 구조

```
client/
  index.html       - 로비 (닉네임 입력, 방 목록, 방 만들기)
  room.html        - 대기실 (플레이어 목록, 게임 시작)
  game.html        - 게임 (손패, 테이블, 다른 플레이어)
  css/
    style.css      - 공통 스타일
  js/
    socket.js      - Socket.io 연결 공유
    lobby.js       - 로비 로직
    room.js        - 대기실 로직
    game.js        - 게임 로직 + GSAP 애니메이션
```

---

## Task 9: 로비 페이지 — 🔲 미완료

**파일:** `client/index.html`, `client/js/lobby.js`, `client/css/style.css`

- [ ] `client/css/style.css` 작성
```css
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: sans-serif; background: #1a1a2e; color: #eee; min-height: 100vh; }
.container { max-width: 600px; margin: 40px auto; padding: 20px; }
h1 { text-align: center; margin-bottom: 24px; font-size: 2rem; color: #e94560; }
input, button, select { padding: 10px 16px; border-radius: 6px; border: none; font-size: 1rem; }
input { background: #16213e; color: #eee; border: 1px solid #444; width: 100%; margin-bottom: 10px; }
button { background: #e94560; color: #fff; cursor: pointer; }
button:hover { background: #c73652; }
button:disabled { background: #555; cursor: default; }
.room-list { margin-top: 24px; }
.room-item { background: #16213e; border-radius: 8px; padding: 14px 18px; margin-bottom: 10px;
  display: flex; justify-content: space-between; align-items: center; }
.room-item span { font-size: 0.9rem; color: #aaa; }
.modal-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,.6); justify-content:center; align-items:center; }
.modal-overlay.open { display:flex; }
.modal { background:#16213e; border-radius:12px; padding:28px; min-width:320px; }
.modal h2 { margin-bottom:16px; }
.row { display:flex; gap:10px; }
.row input { flex:1; }
```

- [ ] `client/index.html` 작성
```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>대부호</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div class="container">
    <h1>대부호</h1>

    <input type="text" id="nickname" placeholder="닉네임 입력" maxlength="12">

    <div class="row">
      <input type="text" id="search" placeholder="방 검색...">
      <button id="btn-refresh">새로고침</button>
      <button id="btn-create">방 만들기</button>
    </div>

    <div class="room-list" id="room-list">
      <p id="no-rooms">방이 없습니다.</p>
    </div>
  </div>

  <!-- 방 만들기 모달 -->
  <div class="modal-overlay" id="create-modal">
    <div class="modal">
      <h2>방 만들기</h2>
      <input type="text" id="room-name" placeholder="방 이름" maxlength="20">
      <select id="max-players">
        <option value="3">3명</option>
        <option value="4" selected>4명</option>
        <option value="5">5명</option>
        <option value="6">6명</option>
        <option value="7">7명</option>
        <option value="8">8명</option>
      </select>
      <div class="row" style="margin-top:12px">
        <button id="btn-cancel">취소</button>
        <button id="btn-confirm-create">만들기</button>
      </div>
    </div>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script src="js/lobby.js"></script>
</body>
</html>
```

- [ ] `client/js/lobby.js` 작성
```js
const socket = io();
let rooms = [];

const nicknameInput = document.getElementById('nickname');
const searchInput = document.getElementById('search');
const roomListEl = document.getElementById('room-list');
const noRoomsEl = document.getElementById('no-rooms');
const createModal = document.getElementById('create-modal');

document.getElementById('btn-refresh').onclick = () => socket.emit('get-room-list');
document.getElementById('btn-create').onclick = () => {
  if (!getNickname()) return;
  createModal.classList.add('open');
};
document.getElementById('btn-cancel').onclick = () => createModal.classList.remove('open');
document.getElementById('btn-confirm-create').onclick = () => {
  const roomName = document.getElementById('room-name').value.trim() || `${getNickname()}의 방`;
  const maxPlayers = parseInt(document.getElementById('max-players').value);
  socket.emit('create-room', { roomName, maxPlayers, nickname: getNickname() });
  createModal.classList.remove('open');
};
searchInput.oninput = () => renderRooms();

socket.on('room-list', ({ rooms: r }) => { rooms = r; renderRooms(); });
socket.on('room-joined', ({ roomId }) => {
  sessionStorage.setItem('nickname', getNickname());
  location.href = `room.html?id=${roomId}`;
});

function getNickname() {
  const v = nicknameInput.value.trim();
  if (!v) { nicknameInput.focus(); return null; }
  return v;
}

function renderRooms() {
  const q = searchInput.value.toLowerCase();
  const filtered = rooms.filter(r => r.name.toLowerCase().includes(q));
  noRoomsEl.style.display = filtered.length ? 'none' : '';
  const existing = roomListEl.querySelectorAll('.room-item');
  existing.forEach(el => el.remove());
  filtered.forEach(room => {
    const div = document.createElement('div');
    div.className = 'room-item';
    div.innerHTML = `
      <strong>${room.name}</strong>
      <span>${room.currentPlayers}/${room.maxPlayers}명 · ${room.status === 'waiting' ? '대기중' : '게임중'}</span>
      <button ${room.status !== 'waiting' || room.currentPlayers >= room.maxPlayers ? 'disabled' : ''}>입장</button>
    `;
    div.querySelector('button').onclick = () => {
      if (!getNickname()) return;
      socket.emit('join-room', { roomId: room.id, nickname: getNickname() });
    };
    roomListEl.appendChild(div);
  });
}

socket.emit('get-room-list');
```

- [ ] 브라우저에서 `http://localhost:3000` 접속 확인
- [ ] 커밋: `feat: 로비 페이지`

---

## Task 10: 대기실 페이지 — 🔲 미완료

**파일:** `client/room.html`, `client/js/room.js`

- [ ] `client/room.html` 작성
```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>대부호 - 대기실</title>
  <link rel="stylesheet" href="css/style.css">
  <style>
    .player-list { margin: 20px 0; }
    .player-item { background:#16213e; border-radius:8px; padding:12px 18px; margin-bottom:8px;
      display:flex; justify-content:space-between; }
    .badge { font-size:0.75rem; background:#e94560; padding:2px 8px; border-radius:10px; }
    #room-id-display { font-size:0.85rem; color:#aaa; margin-bottom:16px; }
    #btn-start { width:100%; padding:14px; font-size:1.1rem; margin-top:12px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>대기실</h1>
    <div id="room-id-display"></div>
    <div class="player-list" id="player-list"></div>
    <button id="btn-start" disabled>게임 시작 (최소 3명)</button>
    <button id="btn-leave" style="width:100%;margin-top:8px;background:#555">나가기</button>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script src="js/room.js"></script>
</body>
</html>
```

- [ ] `client/js/room.js` 작성
```js
const socket = io();
const params = new URLSearchParams(location.search);
const roomId = params.get('id');
const nickname = sessionStorage.getItem('nickname');

if (!nickname || !roomId) location.href = '/';

let isHost = false;

document.getElementById('room-id-display').textContent = `방 코드: ${roomId}`;
document.getElementById('btn-start').onclick = () => socket.emit('start-game');
document.getElementById('btn-leave').onclick = () => {
  socket.emit('leave-room');
  location.href = '/';
};

socket.on('connect', () => {
  socket.emit('join-room', { roomId, nickname });
});

socket.on('room-joined', (data) => {
  isHost = data.isHost;
  renderPlayers(data.players);
});

socket.on('room-updated', ({ players }) => renderPlayers(players));

socket.on('game-started', ({ hand, turnOrder, currentPlayerId, gameNumber }) => {
  sessionStorage.setItem('hand', JSON.stringify(hand));
  sessionStorage.setItem('turnOrder', JSON.stringify(turnOrder));
  sessionStorage.setItem('currentPlayerId', currentPlayerId);
  sessionStorage.setItem('gameNumber', gameNumber);
  location.href = `game.html?id=${roomId}`;
});

socket.on('error', ({ message }) => alert(`오류: ${message}`));

function renderPlayers(players) {
  const el = document.getElementById('player-list');
  el.innerHTML = players.map(p => `
    <div class="player-item">
      <span>${p.nickname} ${p.id === socket.id ? '(나)' : ''}</span>
      ${p.id === players[0].id ? '<span class="badge">방장</span>' : ''}
    </div>
  `).join('');

  const startBtn = document.getElementById('btn-start');
  startBtn.disabled = !isHost || players.length < 3;
  startBtn.textContent = isHost
    ? `게임 시작 (${players.length}명)`
    : `방장이 시작하면 시작됩니다 (${players.length}명)`;
}
```

- [ ] 브라우저에서 방 입장 → 대기실 확인
- [ ] 커밋: `feat: 대기실 페이지`

---

## Task 11: 게임 페이지 — 🔲 미완료

**파일:** `client/game.html`, `client/js/game.js`

- [ ] `client/game.html` 작성
```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>대부호 - 게임</title>
  <link rel="stylesheet" href="css/style.css">
  <style>
    body { overflow: hidden; }
    #game-board { position:relative; width:100vw; height:100vh; background:#0f3460; }

    /* 다른 플레이어 영역 */
    #opponents { position:absolute; top:16px; left:50%; transform:translateX(-50%);
      display:flex; gap:20px; }
    .opponent { background:rgba(0,0,0,.4); border-radius:10px; padding:10px 16px;
      text-align:center; min-width:80px; }
    .opponent.active { border:2px solid #e94560; }
    .opponent .card-count { font-size:1.5rem; font-weight:bold; }

    /* 테이블 */
    #table { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
      display:flex; gap:8px; min-width:200px; min-height:140px;
      align-items:center; justify-content:center; }
    .table-card { width:70px; height:100px; border-radius:8px; overflow:hidden; }
    .table-card img { width:100%; height:100%; object-fit:cover; }

    /* 상태 표시 */
    #status-bar { position:absolute; top:50%; left:50%; transform:translate(-50%,60px);
      color:#fff; font-size:0.9rem; text-align:center; }
    #revolution-badge { display:none; position:absolute; top:8px; right:16px;
      background:#e94560; padding:4px 12px; border-radius:10px; font-size:0.85rem; }

    /* 내 손패 */
    #my-area { position:absolute; bottom:0; left:0; right:0; padding:16px;
      background:rgba(0,0,0,.5); }
    #my-info { display:flex; justify-content:space-between; margin-bottom:8px; }
    #hand { display:flex; gap:6px; flex-wrap:wrap; justify-content:center; min-height:110px; }
    .hand-card { width:70px; height:100px; border-radius:8px; overflow:hidden;
      cursor:pointer; transition:transform .15s; border:3px solid transparent; }
    .hand-card:hover { transform:translateY(-8px); }
    .hand-card.selected { transform:translateY(-16px); border-color:#e94560; }
    .hand-card img { width:100%; height:100%; object-fit:cover; pointer-events:none; }
    #action-btns { display:flex; gap:10px; justify-content:center; margin-top:10px; }
    #action-btns button { padding:10px 28px; font-size:1rem; }
    #btn-pass { background:#555; }
  </style>
</head>
<body>
  <div id="game-board">
    <div id="revolution-badge">혁명!</div>
    <div id="opponents"></div>
    <div id="table"></div>
    <div id="status-bar" id="status-bar">대기중...</div>
    <div id="my-area">
      <div id="my-info">
        <span id="my-nickname"></span>
        <span id="my-rank"></span>
      </div>
      <div id="hand"></div>
      <div id="action-btns">
        <button id="btn-play" disabled>카드 내기</button>
        <button id="btn-pass" disabled>패스</button>
      </div>
    </div>
  </div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <script src="/socket.io/socket.io.js"></script>
  <script src="js/game.js"></script>
</body>
</html>
```

- [ ] 커밋 없이 Task 12로 이어서 진행

---

## Task 12: `game.js` — 게임 로직 + GSAP 애니메이션 — 🔲 미완료

**파일:** `client/js/game.js`

- [ ] `client/js/game.js` 작성
```js
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

// 요소
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

// 게임 시작 (대기실에서 넘어온 경우 이미 hand가 있음)
socket.on('game-started', ({ hand, turnOrder, currentPlayerId: cpId }) => {
  myHand = hand;
  currentPlayerId = cpId;
  renderHand();
  updateStatus(cpId);
});

// 상태 업데이트
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

// 내 손패 업데이트
socket.on('hand-updated', ({ hand }) => {
  myHand = hand;
  selectedCards = [];
  renderHand();
});

// 이벤트들
socket.on('round-end', ({ reason, nextPlayerId }) => {
  const msg = reason === '8-clear' ? '8-Clear!' : reason === 'spade-reversal' ? '♠ Reversal!' : '';
  if (msg) animateMessage(msg);
  gsap.to('#table .table-card', { opacity: 0, y: -20, duration: 0.4, stagger: 0.05,
    onComplete: () => { tableEl.innerHTML = ''; } });
});

socket.on('revolution', ({ active }) => {
  animateMessage(active ? '혁명 발동!' : '반혁명!');
});

socket.on('player-finished', ({ playerId, rank }) => {
  const p = players.find(p => p.id === playerId);
  if (p) animateMessage(`${p.nickname} — ${rankLabel(rank)}`);
});

socket.on('president-penalty', ({ playerId }) => {
  const p = players.find(p => p.id === playerId);
  if (p) animateMessage(`${p.nickname} 대부호 방어 실패!`);
});

socket.on('game-over', ({ ranks }) => {
  const lines = Object.entries(ranks)
    .map(([id, rank]) => {
      const p = players.find(p => p.id === id) || { nickname: id };
      return `${rankLabel(rank)}: ${p.nickname}`;
    }).join('\n');
  setTimeout(() => alert('게임 종료!\n\n' + lines), 500);
});

socket.on('error', ({ message }) => {
  animateMessage('낼 수 없는 카드입니다', '#e94560');
});

// 버튼
btnPlay.onclick = () => {
  if (selectedCards.length === 0) return;
  socket.emit('play-cards', { cards: selectedCards });
};
btnPass.onclick = () => socket.emit('pass');

// 렌더링
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
  btnPlay.disabled = selectedCards.length === 0;
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
    <div class="opponent ${p.id === currentPlayerId ? 'active' : ''}">
      <div class="card-count">${p.finished ? '✓' : p.cardCount}</div>
      <div>${p.nickname}</div>
    </div>
  `).join('');
}

function updateStatus(cpId) {
  if (!cpId) { statusEl.textContent = ''; return; }
  if (cpId === myId) {
    statusEl.textContent = '내 턴';
    gsap.fromTo('#status-bar', { scale: 1.3, color: '#e94560' }, { scale: 1, color: '#fff', duration: 0.4 });
  } else {
    const p = players.find(p => p.id === cpId);
    statusEl.textContent = p ? `${p.nickname}의 턴` : '';
  }
}

function animateMessage(text, color = '#fff') {
  const el = document.createElement('div');
  el.textContent = text;
  Object.assign(el.style, {
    position: 'fixed', top: '40%', left: '50%', transform: 'translateX(-50%)',
    fontSize: '1.8rem', fontWeight: 'bold', color, zIndex: 999,
    textShadow: '0 2px 8px rgba(0,0,0,.8)',
  });
  document.body.appendChild(el);
  gsap.fromTo(el, { y: 0, opacity: 1 }, { y: -60, opacity: 0, duration: 1.2,
    onComplete: () => el.remove() });
}

function rankLabel(rank) {
  const map = { president:'대부호', 'vice-president':'부호', citizen:'평민', 'vice-scum':'빈민', scum:'대빈민' };
  return map[rank] || rank;
}

// 초기 렌더링 (대기실에서 넘어온 경우)
if (myHand.length > 0) {
  renderHand();
  updateStatus(currentPlayerId);
}
```

- [ ] `npm start` 후 브라우저 3탭으로 3명 접속해서 게임 흐름 확인
- [ ] 커밋: `feat: 게임 페이지 + GSAP 애니메이션`
