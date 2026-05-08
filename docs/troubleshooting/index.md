# 트러블슈팅 체크리스트

발견된 버그와 개선 사항을 기록합니다.  
`🔲 미완료` / `✅ 완료` 로 상태를 표시합니다.

---

## 애니메이션

| 상태 | 위치 | 문제 | 비고 |
|------|------|------|------|
| ✅ | `game.js:147` | 손패 카드 입장 애니메이션 — `y:60` + 스태거 딜레이로 인해 카드가 계단식 배치처럼 보임 | 입장 애니메이션 제거로 해결 |
| 🔲 | `game.js:167` | 테이블 카드 낼 때 scale 확대 효과 — 실제 동작 미검증 | |
| 🔲 | `game.js:74` | 판 종료 시 테이블 카드 사라지는 효과 — 실제 동작 미검증 | |
| 🔲 | `game.js:175` | "내 턴" 상태바 강조 효과 — 실제 동작 미검증 | |
| 🔲 | `game.js:191` | 혁명/완료 메시지 떠오르는 효과 — 실제 동작 미검증 | |

## 게임 로직 / UI

| 상태 | 위치 | 문제 | 비고 |
|------|------|------|------|
| ✅ | `game.js`, `game.html` | 낼 수 없는 카드가 시각적으로 구분되지 않음 | `computeSelectableSet` 추가, 낼 수 없는 카드에 `dimmed` 클래스(opacity 0.35) 적용 |
| ✅ | `game.js:computeSelectableSet` | 선(테이블 빈 상태)에서 카드 선택 후에도 다른 숫자 카드가 dimmed 안 됨 | `tableEmpty && selected.length > 0` 분기 추가 — 같은 숫자+조커만 반환 |
| ✅ | `server.js:join-room`, `game.js` | 카드 내기 버튼이 눌리지 않음 — 게임 중 reconnect 시 `currentPlayerId`가 sessionStorage의 첫 플레이어 ID에서 업데이트 안 됨 | 서버: `join-room` 시 게임 진행 중이면 `game-state-sync` 이벤트로 현재 상태 전송. 클라이언트: `game-state-sync` 핸들러 추가, `state-updated` 시 내 턴 종료 시 선택 초기화 |
| ✅ | `game.js:renderHand`, `toggleCard`, `hand-updated` | 카드 내기 버튼이 여전히 눌리지 않음 — `hand-updated` 핸들러가 `renderHand()` 이후에 `btnPlay.disabled = true`를 덮어씌워 버튼이 항상 비활성화됨 | 버튼 상태(`btnPlay.disabled`, `btnPass.disabled`, `myAreaEl.active`)를 `renderHand()` 안에서만 설정하도록 중앙화. 나머지 핸들러와 `toggleCard`에서 중복 할당 제거 |
| ✅ | `turn.js:checkRoundEnd`, `game-state.js:pass`, `game.js:renderHand` | 선(빈 테이블) 상황에서 패스 클릭 시 서버 TypeError 크래시 + 패스 불가 규칙 미적용 | `checkRoundEnd`에 빈 tableCards 조기 반환 추가. `pass`에서 `tableCards.length === 0`이면 `cannot-pass-as-leader` 에러 반환. 클라이언트 패스 버튼을 선 상황에서 disabled 처리 |

## 해결 완료

| 상태 | 위치 | 문제 | 해결 방법 |
|------|------|------|-----------|
| ✅ | `room-manager.js:22`, `game.js:117` | 게임 중 새로고침 시 "낼 수 없는 카드" 메시지 출현 | `joinRoom`에서 기존 플레이어 재접속 체크를 `status` 체크보다 먼저 수행. `error` 핸들러에서 `invalid-play` / `card-not-in-hand`만 메시지 표시하도록 분기 |
| ✅ | `game.html` | 턴 순서 패널 세로 잘림 | `max-height + overflow-y:auto` 추가 |
| ✅ | `game.html` | 턴 순서 패널 가로 잘림 — 고정 `width:190px` 하드코딩 | `width:max-content; max-width:240px` 로 변경 |
| ✅ | `server.js` | 카드 이미지 경로 깨짐 | `Resource/` 정적 경로 별도 등록 |
| ✅ | `room-manager.js` | `uuid` ES 모듈 충돌 | Node.js 내장 `crypto.randomUUID()` 로 교체 |
| ✅ | `server.js` | 방 생성 후 `room-not-found` 오류 | 페이지 이동 시 소켓 끊김 → `sessionId` 기반 신원 관리로 전환 |
| ✅ | `game.js` | 턴 순서 패널이 비어있음 | `players` 를 `sessionStorage` 에 저장하고 `game.js` 에서 로드하도록 수정 |
