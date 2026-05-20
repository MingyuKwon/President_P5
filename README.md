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

## 외부 접속 허용 (같은 네트워크의 다른 기기에서 접속)

기본값은 `0.0.0.0` 바인딩이므로 별도 설정 없이도 같은 네트워크의 기기에서 접속 가능합니다.  
접속 URL은 서버 머신의 로컬 IP를 사용합니다 (예: `http://192.168.0.10:3000`).

포트나 바인딩 주소를 바꾸고 싶으면 환경변수로 지정합니다:

```bash
# 포트 변경
PORT=8080 node server/server.js

# 특정 인터페이스에만 바인딩 (localhost 전용으로 제한하고 싶을 때)
HOST=127.0.0.1 node server/server.js

# 둘 다
PORT=8080 HOST=0.0.0.0 node server/server.js
```

> **왜 `0.0.0.0`인가?**  
> `127.0.0.1`(localhost)은 루프백 주소로, 같은 머신 안에서만 통신이 가능합니다.  
> `0.0.0.0`은 "모든 네트워크 인터페이스에서 수신"을 의미하며, Wi-Fi·이더넷·VPN 등 모든 경로로 들어오는 연결을 받습니다.  
> 서버가 `127.0.0.1`에만 바인딩되어 있으면 다른 기기에서 IP로 접속해도 거절됩니다.

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
