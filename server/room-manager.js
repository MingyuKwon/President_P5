const { randomUUID } = require('crypto');

const rooms = new Map();

function createRoom(hostId, hostNickname, roomName, maxPlayers) {
  const room = {
    id: randomUUID().slice(0, 6).toUpperCase(),
    name: roomName,
    hostId,
    maxPlayers,
    status: 'waiting',
    players: [{ id: hostId, nickname: hostNickname }],
  };
  rooms.set(room.id, room);
  return room;
}

function joinRoom(roomId, playerId, nickname) {
  const room = rooms.get(roomId);
  if (!room) return { error: 'room-not-found' };
  if (room.status !== 'waiting') return { error: 'game-in-progress' };
  if (room.players.length >= room.maxPlayers) return { error: 'room-full' };
  if (room.players.find(p => p.id === playerId)) return room;
  room.players.push({ id: playerId, nickname });
  return room;
}

function leaveRoom(roomId, playerId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.players = room.players.filter(p => p.id !== playerId);
  if (room.players.length === 0) {
    rooms.delete(roomId);
    return null;
  }
  if (room.hostId === playerId) room.hostId = room.players[0].id;
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

module.exports = { createRoom, joinRoom, leaveRoom, getRoomList, getRoom, setRoomStatus };
