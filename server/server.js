const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { createRoom, joinRoom, leaveRoom, getRoomList, getRoom, setRoomStatus } = require('./room-manager');
const { createGameState, playCards, pass } = require('./game/game-state');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../client')));

const gameStates = new Map();  // roomId → gameState
const playerRooms = new Map(); // socketId → roomId

io.on('connection', (socket) => {
  socket.on('get-room-list', () => {
    socket.emit('room-list', { rooms: getRoomList() });
  });

  socket.on('create-room', ({ roomName, maxPlayers, nickname }) => {
    const room = createRoom(socket.id, nickname, roomName, maxPlayers);
    socket.join(room.id);
    playerRooms.set(socket.id, room.id);
    socket.emit('room-joined', { roomId: room.id, players: room.players, isHost: true });
    io.emit('room-list', { rooms: getRoomList() });
  });

  socket.on('join-room', ({ roomId, nickname }) => {
    const result = joinRoom(roomId, socket.id, nickname);
    if (result.error) return socket.emit('error', { message: result.error });
    socket.join(roomId);
    playerRooms.set(socket.id, roomId);
    socket.emit('room-joined', { roomId, players: result.players, isHost: result.hostId === socket.id });
    socket.to(roomId).emit('room-updated', { players: result.players });
    io.emit('room-list', { rooms: getRoomList() });
  });

  socket.on('leave-room', () => {
    handleLeave(socket);
  });

  socket.on('start-game', () => {
    const roomId = playerRooms.get(socket.id);
    const room = getRoom(roomId);
    if (!room || room.hostId !== socket.id) return;
    if (room.players.length < 3) return socket.emit('error', { message: 'need-3-players' });

    const prevState = gameStates.get(roomId);
    const prevRanks = prevState?.ranks || {};
    const gameNumber = (prevState?.gameNumber || 0) + 1;
    const state = createGameState(room.players, gameNumber, prevRanks);
    gameStates.set(roomId, state);
    setRoomStatus(roomId, 'playing');

    room.players.forEach(p => {
      const playerSocket = io.sockets.sockets.get(p.id);
      if (playerSocket) {
        playerSocket.emit('game-started', {
          hand: state.players[p.id].hand,
          turnOrder: state.turnOrder,
          currentPlayerId: state.turnOrder[state.currentIndex],
          gameNumber,
        });
      }
    });
    io.emit('room-list', { rooms: getRoomList() });
  });

  socket.on('play-cards', ({ cards }) => {
    const roomId = playerRooms.get(socket.id);
    const state = gameStates.get(roomId);
    if (!state) return;
    const result = playCards(state, socket.id, cards);
    if (result.error) return socket.emit('error', { message: result.error });
    gameStates.set(roomId, result.state);
    broadcastGameUpdate(roomId, result.state, result.events);
  });

  socket.on('pass', () => {
    const roomId = playerRooms.get(socket.id);
    const state = gameStates.get(roomId);
    if (!state) return;
    const result = pass(state, socket.id);
    if (result.error) return socket.emit('error', { message: result.error });
    gameStates.set(roomId, result.state);
    broadcastGameUpdate(roomId, result.state, result.events);
  });

  socket.on('disconnect', () => {
    handleLeave(socket);
  });

  function handleLeave(socket) {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;
    playerRooms.delete(socket.id);
    socket.leave(roomId);
    const room = leaveRoom(roomId, socket.id);
    if (room) {
      io.to(roomId).emit('room-updated', { players: room.players });
    }
    io.emit('room-list', { rooms: getRoomList() });
  }

  function broadcastGameUpdate(roomId, state, events) {
    const publicState = {
      tableCards: state.tableCards,
      currentPlayerId: state.turnOrder[state.currentIndex] || null,
      passCount: state.passCount,
      revolution: state.revolution,
      players: Object.values(state.players).map(p => ({
        id: p.id, nickname: p.nickname, cardCount: p.hand.length, finished: p.finished,
      })),
    };
    io.to(roomId).emit('state-updated', publicState);

    for (const event of events) {
      if (event.type === 'card-played') {
        // 손패 업데이트는 해당 플레이어에게만
        const playerSocket = io.sockets.sockets.get(event.playerId);
        if (playerSocket) {
          playerSocket.emit('hand-updated', { hand: state.players[event.playerId].hand });
        }
      }
      io.to(roomId).emit(event.type, event);
    }
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
