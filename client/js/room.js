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

let isHost = false;

const roomIdDisplay = document.getElementById('room-id-display');
roomIdDisplay.textContent = `방 코드: ${roomId} (클릭하여 복사)`;
roomIdDisplay.onclick = () => {
  navigator.clipboard.writeText(location.href).then(() => {
    roomIdDisplay.textContent = '링크 복사됨!';
    setTimeout(() => { roomIdDisplay.textContent = `방 코드: ${roomId} (클릭하여 복사)`; }, 2000);
  });
};

document.getElementById('btn-start').onclick = () => socket.emit('start-game', { sessionId: getSessionId() });
document.getElementById('btn-leave').onclick = () => {
  socket.emit('leave-room', { sessionId: getSessionId() });
  location.href = '/';
};

socket.on('connect', () => {
  socket.emit('join-room', { roomId, nickname, sessionId: getSessionId() });
});

socket.on('room-joined', (data) => {
  isHost = data.isHost;
  renderPlayers(data.players);
});

socket.on('room-updated', ({ players }) => renderPlayers(players));

socket.on('game-started', ({ hand, turnOrder, currentPlayerId, gameNumber, players }) => {
  sessionStorage.setItem('hand', JSON.stringify(hand));
  sessionStorage.setItem('turnOrder', JSON.stringify(turnOrder));
  sessionStorage.setItem('currentPlayerId', currentPlayerId);
  sessionStorage.setItem('gameNumber', gameNumber);
  sessionStorage.setItem('players', JSON.stringify(players));
  sessionStorage.setItem('showGameStartCutscene', '1');
  location.href = `game.html?id=${roomId}`;
});

socket.on('room-closed', () => {
  alert('방장이 방을 나갔습니다. 로비로 이동합니다.');
  location.href = '/';
});

socket.on('error', ({ message }) => alert(`오류: ${message}`));

const chatMessagesEl = document.getElementById('chat-messages');
const chatInputEl    = document.getElementById('chat-input');
const chatSendEl     = document.getElementById('chat-send');

function sendChat() {
  const msg = chatInputEl.value.trim();
  if (!msg) return;
  socket.emit('chat-message', { sessionId: getSessionId(), message: msg });
  chatInputEl.value = '';
}

chatSendEl.addEventListener('click', sendChat);
chatInputEl.addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });

socket.on('chat-message', ({ senderId, nickname, message }) => {
  const isMine = senderId === getSessionId();
  const div = document.createElement('div');
  div.className = `chat-msg${isMine ? ' mine' : ''}`;
  div.innerHTML = `<span class="chat-nick">${nickname}</span><span class="chat-text">${message.replace(/</g, '&lt;')}</span>`;
  chatMessagesEl.appendChild(div);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
});

function renderPlayers(players) {
  const el = document.getElementById('player-list');
  const mySessionId = getSessionId();
  el.innerHTML = players.map(p => `
    <div class="player-item">
      <span>${p.nickname}${p.id === mySessionId ? ' (나)' : ''}</span>
      ${p.id === players[0].id ? '<span class="badge">방장</span>' : ''}
    </div>
  `).join('');

  const startBtn = document.getElementById('btn-start');
  startBtn.disabled = !isHost || players.length < 3;
  startBtn.textContent = isHost
    ? `게임 시작 (${players.length}명)`
    : `방장이 시작하면 시작됩니다 (${players.length}명)`;
}
