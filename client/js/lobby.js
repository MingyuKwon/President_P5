const socket = io();
let rooms = [];

function getSessionId() {
  let id = sessionStorage.getItem('sessionId');
  if (!id) { id = Math.random().toString(36).slice(2, 10); sessionStorage.setItem('sessionId', id); }
  return id;
}

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
  socket.emit('create-room', { roomName, nickname: getNickname(), sessionId: getSessionId() });
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
  roomListEl.querySelectorAll('.room-item').forEach(el => el.remove());
  filtered.forEach(room => {
    const div = document.createElement('div');
    div.className = 'room-item';
    div.innerHTML = `
      <strong>${room.name}</strong>
      <span>${room.currentPlayers}/8명 · ${room.status === 'waiting' ? '대기중' : '게임중'}</span>
      <button ${room.status !== 'waiting' || room.currentPlayers >= 8 ? 'disabled' : ''}>입장</button>
    `;
    div.querySelector('button').onclick = () => {
      if (!getNickname()) return;
      socket.emit('join-room', { roomId: room.id, nickname: getNickname(), sessionId: getSessionId() });
    };
    roomListEl.appendChild(div);
  });
}

socket.emit('get-room-list');
