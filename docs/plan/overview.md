# 대부호 구현 계획 — 개요

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | HTML / CSS / JavaScript + GSAP (애니메이션) |
| 백엔드 | Node.js + Express |
| 실시간 통신 | Socket.io (WebSocket) |
| 테스트 | Jest |

## 게임 개요

- 웹 브라우저에서 바로 플레이 가능한 멀티플레이어 카드 게임
- 서버를 켜두면 외부에서 URL로 접속해서 플레이
- 3~8명, 방장이 인원 수 설정
- 로그인 없음 — 닉네임만 입력하고 참가
- CPU 없음 — 사람 플레이어만

## 화면 구성

### 1. 로비 페이지 `/`
- 닉네임 입력
- 방 목록 (방 이름, 현재 인원/최대 인원, 상태)
- 방 만들기 (방 이름, 인원 수 3~8명 설정)
- 방 입장 버튼

### 2. 대기실 페이지 `/room/:roomId`
- 참가한 플레이어 목록
- 방장만 게임 시작 버튼 활성화 (최소 3명 이상)
- URL 공유 버튼

### 3. 게임 페이지 `/room/:roomId/game`
- 내 패 (하단)
- 테이블 (중앙) — 현재 낸 카드들
- 다른 플레이어들 (상단/좌우) — 패 뒷면 + 이름 + 카드 수
- 카드 내기 / 패스 버튼
- 현재 턴 표시, 계급 표시

## 아키텍처

```
[브라우저 클라이언트]
  HTML/CSS/JS + GSAP
       ↕ WebSocket (Socket.io)
[Node.js 서버]
  Express + Socket.io
  - 정적 파일 서빙
  - 방 관리
  - 게임 로직 (서버 전담)
  - 게임 상태 메모리 관리 (DB 없음)
```

게임 로직은 전부 서버에서 처리하고, 클라이언트는 상태를 표시하고 입력을 전달하는 역할만 한다.

## 디렉토리 구조

```
President_P5/
  server/
    game/              ← 순수 로직 (Socket.io 의존 없음)
      deck.js          - 덱 생성, 셔플, 배분
      card.js          - 카드 강약 비교, 유효성 검사
      turn.js          - 턴 진행, 판 종료 감지
      rank.js          - 계급 산정, 세금 교환
      game-state.js    - 게임 상태 관리 (순수 함수)
    room-manager.js    ← 방 목록 관리
    server.js          ← Socket.io / Express 진입점
  client/
    index.html         - 로비
    room.html          - 대기실
    game.html          - 게임
    css/
    js/
  tests/
    deck.test.js
    card.test.js
    turn.test.js
    rank.test.js
  Resource/
    CardImage/         - 카드 이미지 54장 (PNG)
  docs/
    game-rules.md
    plan/
      overview.md
      phase1.md
      phase2.md
      phase3.md
```

## 게임 로직 모듈

| 모듈 | 역할 |
|------|------|
| `deck.js` | 54장 덱 생성, 셔플, 인원수에 맞게 배분 |
| `card.js` | 카드 강약 비교, 낼 수 있는 카드 유효성 검사, 조커 처리 |
| `turn.js` | 턴 진행, 전원 패스 / 8-Clear / ♠Reversal 감지 |
| `rank.js` | 게임 종료 후 계급 산정, 세금 교환 처리 |
| `game-state.js` | 전체 게임 상태 관리, 순수 함수 `(state, action) → newState` |

## 핵심 규칙 구현 체크리스트

- [ ] 카드 강약 순서 (기본 / 혁명 상태)
- [ ] 여러 장 내기 (같은 숫자, 같은 장수)
- [ ] 조커 단독 / 와일드카드 구분
- [ ] 판 종료 3가지 (전원 패스 / 8-Clear / ♠Reversal)
- [ ] 혁명 발동 및 반혁명
- [ ] 손패 다 냈을 때 즉시 계급 확정 및 이탈
- [ ] 대부호 방어 실패 패널티
- [ ] 세금 교환 (2번째 게임부터)
- [ ] 계급별 나머지 카드 우선 분배

## 진행 현황

| Phase | 내용 | 상태 |
|-------|------|------|
| [Phase 1](phase1.md) | 프로젝트 초기 설정 + 게임 로직 | 🔲 미완료 |
| [Phase 2](phase2.md) | 서버 + Socket.io 통신 | 🔲 미완료 |
| [Phase 3](phase3.md) | 클라이언트 UI | 🔲 미완료 |
