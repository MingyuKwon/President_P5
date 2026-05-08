const socket = io();
const params = new URLSearchParams(location.search);
const roomId = params.get('id');
const nickname = sessionStorage.getItem('nickname');

if (!nickname || !roomId) location.href = '/';

let isHost = false;

const roomIdDisplay = document.getElementById('room-id-display');
roomIdDisplay.textContent = `방 코드: ${roomId} (클릭하여 복사)`;
roomIdDisplay.onclick = () => {
  navigator.clipboard.writeText(location.href).then(() => {
    roomIdDisplay.textContent = '링크 복사됨!';
    setTimeout(() => { roomIdDisplay.textContent = `방 코드: ${roomId} (클릭하여 복사)`; }, 2000);
  });
};

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
      <span>${p.nickname}${p.id === socket.id ? ' (나)' : ''}</span>
      ${p.id === players[0].id ? '<span class="badge">방장</span>' : ''}
    </div>
  `).join('');

  const startBtn = document.getElementById('btn-start');
  startBtn.disabled = !isHost || players.length < 3;
  startBtn.textContent = isHost
    ? `게임 시작 (${players.length}명)`
    : `방장이 시작하면 시작됩니다 (${players.length}명)`;
}
