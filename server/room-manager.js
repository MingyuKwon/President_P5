const { randomUUID } = require('crypto');

const rooms = new Map();

function createRoom(sessionId, nickname, roomName) {
  const room = {
    id: randomUUID().slice(0, 6).toUpperCase(),
    name: roomName,
    hostId: sessionId,
    maxPlayers: 8,
    status: 'waiting',
    players: [{ id: sessionId, nickname, socketId: null }],
  };
  rooms.set(room.id, room);
  return room;
}

// sessionId 기준으로 입장. 이미 있으면 socketId만 업데이트.
function joinRoom(roomId, sessionId, socketId, nickname) {
  const room = rooms.get(roomId);
  if (!room) return { error: 'room-not-found' };

  const existing = room.players.find(p => p.id === sessionId);
  if (existing) {
    existing.socketId = socketId;
    return room;
  }

  if (room.status !== 'waiting') return { error: 'game-in-progress' };

  if (room.players.length >= room.maxPlayers) return { error: 'room-full' };
  room.players.push({ id: sessionId, nickname, socketId });
  return room;
}

function updateSocketId(roomId, sessionId, socketId) {
  const room = rooms.get(roomId);
  if (!room) return;
  const player = room.players.find(p => p.id === sessionId);
  if (player) player.socketId = socketId;
}

function leaveRoom(roomId, sessionId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.players = room.players.filter(p => p.id !== sessionId);
  if (room.players.length === 0) {
    rooms.delete(roomId);
    return null;
  }
  if (room.hostId === sessionId) room.hostId = room.players[0].id;
  return room;
}

function getRoomList() {
  return Array.from(rooms.values()).map(r => ({
    id: r.id, name: r.name, maxPlayers: r.maxPlayers,
    currentPlayers: r.players.length, status: r.status,
  }));
}

function getRoom(roomId) {
  return rooms.get(roomId) || null;
}

function setRoomStatus(roomId, status) {
  const room = rooms.get(roomId);
  if (room) room.status = status;
}

module.exports = { createRoom, joinRoom, leaveRoom, getRoomList, getRoom, setRoomStatus, updateSocketId };
