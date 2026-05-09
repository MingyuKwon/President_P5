const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { createRoom, joinRoom, leaveRoom, closeRoom, getRoomList, getRoom, setRoomStatus, updateSocketId } = require('./room-manager');
const { createGameState, playCards, pass } = require('./game/game-state');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../client')));
app.use('/Resource', express.static(path.join(__dirname, '../Resource')));

const gameStates = new Map();   // roomId → gameState
const sessionMap = new Map();   // sessionId → { socketId, roomId }
const socketSession = new Map(); // socketId → sessionId
const turnTimers = new Map();   // roomId → timeoutId

const TURN_DURATION = 30; // seconds

function clearTurnTimer(roomId) {
  if (turnTimers.has(roomId)) {
    clearTimeout(turnTimers.get(roomId).timeoutId);
    turnTimers.delete(roomId);
  }
}

function startTurnTimer(roomId, state) {
  clearTurnTimer(roomId);
  const currentPlayerId = state.turnOrder[state.currentIndex] || null;
  if (!currentPlayerId) return;

  io.to(roomId).emit('turn-timer', { playerId: currentPlayerId, duration: TURN_DURATION });

  const timeoutId = setTimeout(() => {
    turnTimers.delete(roomId);
    const currentState = gameStates.get(roomId);
    if (!currentState) return;
    if ((currentState.turnOrder[currentState.currentIndex] || null) !== currentPlayerId) return;

    const result = pass(currentState, currentPlayerId);
    if (result.error) return;
    gameStates.set(roomId, result.state);
    broadcastGameUpdate(roomId, result.state, result.events);
    if (!result.events.some(e => e.type === 'game-over')) {
      startTurnTimer(roomId, result.state);
    }
  }, TURN_DURATION * 1000);
  turnTimers.set(roomId, { timeoutId, startedAt: Date.now(), playerId: currentPlayerId });
}

function broadcastGameUpdate(roomId, state, events) {
  const publicState = {
    tableCards: state.tableCards,
    tablePile: state.tablePile || [],
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
      const sess = sessionMap.get(event.playerId);
      const playerSocket = sess ? io.sockets.sockets.get(sess.socketId) : null;
      if (playerSocket) {
        playerSocket.emit('hand-updated', { hand: state.players[event.playerId].hand });
      }
    }
    io.to(roomId).emit(event.type, event);
  }
}

io.on('connection', (socket) => {

  function getSession(sessionId) {
    if (!sessionMap.has(sessionId)) sessionMap.set(sessionId, { socketId: socket.id, roomId: null });
    const session = sessionMap.get(sessionId);
    session.socketId = socket.id;
    socketSession.set(socket.id, sessionId);
    return session;
  }

  socket.on('get-room-list', () => {
    socket.emit('room-list', { rooms: getRoomList() });
  });

  socket.on('create-room', ({ roomName, nickname, sessionId }) => {
    const session = getSession(sessionId);
    const room = createRoom(sessionId, nickname, roomName);
    socket.join(room.id);
    session.roomId = room.id;
    updateSocketId(room.id, sessionId, socket.id);
    socket.emit('room-joined', { roomId: room.id, players: publicPlayers(room.players), isHost: true });
    io.emit('room-list', { rooms: getRoomList() });
  });

  socket.on('join-room', ({ roomId, nickname, sessionId }) => {
    const session = getSession(sessionId);
    const result = joinRoom(roomId, sessionId, socket.id, nickname);
    if (result.error) return socket.emit('error', { message: result.error });
    socket.join(roomId);
    session.roomId = roomId;
    const isHost = result.hostId === sessionId;
    socket.emit('room-joined', { roomId, players: publicPlayers(result.players), isHost });
    socket.to(roomId).emit('room-updated', { players: publicPlayers(result.players) });
    io.emit('room-list', { rooms: getRoomList() });

    // 게임 진행 중이면 현재 상태 동기화
    const gameState = gameStates.get(roomId);
    if (gameState && result.status === 'playing') {
      const playerState = gameState.players[sessionId];
      if (playerState) {
        socket.emit('game-state-sync', {
          hand: playerState.hand,
          tableCards: gameState.tableCards,
          tablePile: gameState.tablePile || [],
          currentPlayerId: gameState.turnOrder[gameState.currentIndex] || null,
          revolution: gameState.revolution,
          players: Object.values(gameState.players).map(p => ({
            id: p.id, nickname: p.nickname, cardCount: p.hand.length, finished: p.finished,
          })),
          turnOrder: gameState.turnOrder,
        });

        const timerInfo = turnTimers.get(roomId);
        if (timerInfo) {
          const elapsed = Math.floor((Date.now() - timerInfo.startedAt) / 1000);
          const remaining = Math.max(1, TURN_DURATION - elapsed);
          socket.emit('turn-timer', { playerId: timerInfo.playerId, duration: remaining });
        }
      }
    }
  });

  socket.on('leave-room', ({ sessionId }) => {
    doLeave(sessionId, socket);
  });

  socket.on('start-game', ({ sessionId }) => {
    const session = sessionMap.get(sessionId);
    if (!session) return;
    const roomId = session.roomId;
    const room = getRoom(roomId);
    if (!room || room.hostId !== sessionId) return;
    if (room.players.length < 3) return socket.emit('error', { message: 'need-3-players' });

    const prevState = gameStates.get(roomId);
    const prevRanks = prevState?.ranks || {};
    const gameNumber = (prevState?.gameNumber || 0) + 1;

    // game-state용 players 배열 (id = sessionId)
    const players = room.players.map(p => ({ id: p.id, nickname: p.nickname }));
    const state = createGameState(players, gameNumber, prevRanks);
    gameStates.set(roomId, state);
    setRoomStatus(roomId, 'playing');

    room.players.forEach(p => {
      const sess = sessionMap.get(p.id);
      const playerSocket = sess ? io.sockets.sockets.get(sess.socketId) : null;
      if (playerSocket) {
        playerSocket.emit('game-started', {
          hand: state.players[p.id].hand,
          turnOrder: state.turnOrder,
          currentPlayerId: state.turnOrder[state.currentIndex],
          gameNumber,
          players: Object.values(state.players).map(q => ({
            id: q.id, nickname: q.nickname, cardCount: q.hand.length, finished: q.finished,
            rank: state.ranks[q.id] || 'citizen',
          })),
        });
      }
    });
    io.emit('room-list', { rooms: getRoomList() });
    startTurnTimer(roomId, state);
  });

  socket.on('play-cards', ({ cards, sessionId }) => {
    console.log('[play-cards] received — sessionId:', sessionId, '| cards:', cards);
    const session = sessionMap.get(sessionId);
    if (!session) { console.warn('[play-cards] session 없음:', sessionId); return; }
    const state = gameStates.get(session.roomId);
    if (!state) { console.warn('[play-cards] gameState 없음 — roomId:', session.roomId); return; }
    const expectedPlayer = state.turnOrder[state.currentIndex];
    console.log('[play-cards] currentPlayer:', expectedPlayer, '| requester:', sessionId);
    const result = playCards(state, sessionId, cards);
    if (result.error) { console.warn('[play-cards] error:', result.error); return socket.emit('error', { message: result.error }); }
    gameStates.set(session.roomId, result.state);
    broadcastGameUpdate(session.roomId, result.state, result.events);
    if (!result.events.some(e => e.type === 'game-over')) {
      startTurnTimer(session.roomId, result.state);
    }
  });

  socket.on('pass', ({ sessionId }) => {
    const session = sessionMap.get(sessionId);
    if (!session) return;
    const state = gameStates.get(session.roomId);
    if (!state) return;
    const result = pass(state, sessionId);
    if (result.error) return socket.emit('error', { message: result.error });
    gameStates.set(session.roomId, result.state);
    broadcastGameUpdate(session.roomId, result.state, result.events);
    if (!result.events.some(e => e.type === 'game-over')) {
      startTurnTimer(session.roomId, result.state);
    }
  });

  // 페이지 이동 시 소켓만 끊기므로 즉시 방에서 제거하지 않음
  socket.on('disconnect', () => {
    socketSession.delete(socket.id);
  });

  function doLeave(sessionId, socket) {
    const session = sessionMap.get(sessionId);
    if (!session?.roomId) return;
    const roomId = session.roomId;
    const room = getRoom(roomId);

    clearTurnTimer(roomId);
    socket.leave(roomId);
    session.roomId = null;

    if (room && room.hostId === sessionId && room.players.length > 1) {
      // 방장 퇴장 → 방 강제 해산
      io.to(roomId).emit('room-closed', { reason: 'host-left' });
      const playerIds = closeRoom(roomId);
      for (const pid of playerIds) {
        const sess = sessionMap.get(pid);
        if (sess) sess.roomId = null;
      }
    } else {
      const updated = leaveRoom(roomId, sessionId);
      if (updated) {
        io.to(roomId).emit('room-updated', { players: publicPlayers(updated.players) });
      }
    }
    io.emit('room-list', { rooms: getRoomList() });
  }

});

function publicPlayers(players) {
  return players.map(p => ({ id: p.id, nickname: p.nickname }));
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
