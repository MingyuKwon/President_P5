# Phase 2: 서버 + Socket.io 통신 — 🔲 미완료

> 방 관리, Socket 이벤트, 게임 상태와 클라이언트 연결.

---

## Socket 이벤트 목록 (서버 ↔ 클라이언트)

| 방향 | 이벤트 | 내용 |
|------|--------|------|
| C→S | `create-room` | 방 이름, 인원 수 |
| C→S | `join-room` | 방 ID, 닉네임 |
| C→S | `start-game` | (방장만) |
| C→S | `play-cards` | 낼 카드 배열 |
| C→S | `pass` | 패스 |
| S→C | `room-list` | 현재 방 목록 |
| S→C | `room-joined` | 방 입장 성공, 플레이어 목록 |
| S→C | `game-started` | 내 손패, 첫 턴 플레이어 |
| S→C | `game-state` | 매 턴 후 전체 상태 업데이트 |
| S→C | `game-over` | 최종 계급 결과 |

---

## Task 6: `game-state.js` — 전체 게임 상태 관리 — 🔲 미완료

> 상세 내용은 추후 작성

---

## Task 7: `room-manager.js` — 방 생성/입장/퇴장 — 🔲 미완료

> 상세 내용은 추후 작성

---

## Task 8: `server.js` — Express + Socket.io 진입점 — 🔲 미완료

> 상세 내용은 추후 작성
