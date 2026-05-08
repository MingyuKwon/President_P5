# 대부호 (President)

트럼프 카드 게임 "대부호"의 웹 멀티플레이어 구현입니다. 3~8명이 같은 네트워크에서 브라우저로 플레이합니다.

## 환경 요구사항

| 항목 | 최소 버전 | 비고 |
|------|-----------|------|
| Node.js | 18.x 이상 | 20.x LTS 권장 |
| npm | 9.x 이상 | Node.js 설치 시 자동 포함 |
| 브라우저 | Chrome / Edge / Firefox 최신 | |

Node.js 설치: https://nodejs.org (LTS 버전 선택)

## 빠른 시작

### Windows

```bat
setup.bat
```

### Mac / Linux

```bash
chmod +x setup.sh && ./setup.sh
```

스크립트가 Node.js 버전 확인 → `npm install` → 실행 안내까지 처리합니다.

### 수동 설치

```bash
# 1. 의존성 설치
npm install

# 2. 서버 실행
npm start
# 또는
node server/server.js
```

서버가 뜨면 브라우저에서 http://localhost:3000 접속.

## 프로젝트 구조

```
President_P5/
├── client/          # 브라우저 클라이언트
│   ├── game.html    # 게임 화면
│   ├── room.html    # 대기실
│   ├── index.html   # 로비
│   ├── js/
│   │   └── game.js  # 게임 클라이언트 로직
│   └── css/
├── server/          # Node.js 서버
│   ├── server.js    # Express + Socket.io 진입점
│   ├── room-manager.js
│   └── game/        # 게임 로직
│       ├── game-state.js
│       ├── card.js
│       ├── deck.js
│       ├── turn.js
│       └── rank.js
├── Resource/        # 카드·UI 이미지
│   └── CardImage/
└── docs/            # 문서
    ├── game-rules.md
    └── plan/
```

## 개발 문서

- 게임 규칙: [docs/game-rules.md](docs/game-rules.md)
- 구현 계획: [docs/plan/overview.md](docs/plan/overview.md)
- 버그 이력: [docs/troubleshooting/index.md](docs/troubleshooting/index.md)

## 기술 스택

- **서버**: Node.js, Express 5, Socket.io 4
- **클라이언트**: Vanilla JS, GSAP 3 (애니메이션)
- **통신**: WebSocket (Socket.io)
