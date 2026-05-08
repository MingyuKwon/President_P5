test('방 생성', () => {
  const { createRoom, getRoom } = require('../server/room-manager');
  const room = createRoom('host1', 'Alice', 'Alice의 방', 4);
  expect(room.name).toBe('Alice의 방');
  expect(room.maxPlayers).toBe(4);
  expect(room.players[0]).toMatchObject({ id: 'host1', nickname: 'Alice' });
  expect(getRoom(room.id)).toBe(room);
});

test('방 입장', () => {
  const { createRoom, joinRoom } = require('../server/room-manager');
  const room = createRoom('host2', 'Alice', '테스트방', 4);
  const result = joinRoom(room.id, 'p2', 'Bob');
  expect(result.players.length).toBe(2);
});

test('인원 초과 시 입장 불가', () => {
  const { createRoom, joinRoom } = require('../server/room-manager');
  const room = createRoom('host3', 'Alice', '꽉찬방', 3);
  joinRoom(room.id, 'p2', 'Bob');
  joinRoom(room.id, 'p3', 'Carol');
  const result = joinRoom(room.id, 'p4', 'Dave');
  expect(result.error).toBeDefined();
});

test('방 퇴장', () => {
  const { createRoom, joinRoom, leaveRoom } = require('../server/room-manager');
  const room = createRoom('host4', 'Alice', '테스트방', 4);
  joinRoom(room.id, 'p2', 'Bob');
  const updated = leaveRoom(room.id, 'p2');
  expect(updated.players.length).toBe(1);
});

test('마지막 플레이어 퇴장 시 방 삭제', () => {
  const { createRoom, leaveRoom, getRoom } = require('../server/room-manager');
  const room = createRoom('host5', 'Alice', '테스트방', 4);
  leaveRoom(room.id, 'host5');
  expect(getRoom(room.id)).toBeNull();
});
