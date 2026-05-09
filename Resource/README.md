# Resource 폴더 구성

## CardImage/
게임에서 실제로 사용하는 카드 이미지. `game.js`의 `cardImg()` 함수에서 동적으로 참조.

| 파일 패턴 | 설명 | 참조 위치 |
|---|---|---|
| `3S.png`, `KH.png` 등 | 숫자(3~A, 2) + 무늬(S/H/D/C) 조합 52장 | `game.js` `cardImg()` |
| `Joker.png` | 조커 카드 | `game.js` `cardImg()` |
| `Card-back.png` | 카드 뒷면 (현재 미사용, 추후 상대 손패 표시용) | — |

---

## UI/

### UI/ControlPanel/
조작 패널 버튼 및 타이머 이미지.

| 파일 | 설명 | 참조 위치 |
|---|---|---|
| `CardSelect.png` | "카드 내기" 버튼 이미지 | `game.html` `#btn-play` |
| `Pass.png` | "패스" 버튼 이미지 | `game.html` `#btn-pass` |
| `Time.png` | 턴 타이머 배경 이미지 (숫자는 위에 오버레이) | `game.html` `#turn-timer` |

### UI/character/
등수별 캐릭터 이미지. `*-shadow.png`(검은 실루엣)를 하단에, `*-face.png`(컬러 얼굴)를 상단에 겹쳐서 표시하는 레이어 구조. 현재 턴인 플레이어는 `-shadow.png` 대신 `-shadow-red.png` 사용.

| 파일 | 등수 | 설명 |
|---|---|---|
| `president-face.png` | 대부호 | 금색 왕관 남자 얼굴 |
| `president-shadow.png` | 대부호 | 검은 실루엣 |
| `president-shadow-red.png` | 대부호 | 빨간 실루엣 (현재 턴) |
| `vice-president-face.png` | 부호 | 초록 모자 남자 얼굴 |
| `vice-president-shadow.png` | 부호 | 검은 실루엣 |
| `vice-president-shadow-red.png` | 부호 | 빨간 실루엣 (현재 턴) |
| `citizen-face.png` | 평민 | 파란색 단발 여자 얼굴 |
| `citizen-shadow.png` | 평민 | 검은 실루엣 |
| `citizen-shadow-red.png` | 평민 | 빨간 실루엣 (현재 턴) |
| `vice-scum-face.png` | 빈민 | 보라색 해골 남자 얼굴 |
| `vice-scum-shadow.png` | 빈민 | 검은 실루엣 |
| `vice-scum-shadow-red.png` | 빈민 | 빨간 실루엣 (현재 턴) |
| `scum-face.png` | 대빈민 | 회색 해골+폭탄 얼굴 |
| `scum-shadow.png` | 대빈민 | 검은 실루엣 |
| `scum-shadow-red.png` | 대빈민 | 빨간 실루엣 (현재 턴) |

### UI/rank-badge/
등수별 원형 뱃지 아이콘. 결과창(`showGameOverPanel`)에서 사용.

| 파일 | 등수 | 설명 |
|---|---|---|
| `president.png` | 대부호 | 황금 왕관 캐릭터 뱃지 |
| `vice-president.png` | 부호 | 초록 모자 캐릭터 뱃지 |
| `citizen.png` | 평민 | 청록 여자 캐릭터 뱃지 |
| `vice-scum.png` | 빈민 | 보라색 캐릭터 뱃지 |
| `scum.png` | 대빈민 | 해골 뱃지 |

### UI/game-state/
게임 중 화면에 표시하는 상태 이미지.

| 파일 | 표시 내용 | 참조 위치 |
|---|---|---|
| `GameStart.png` | 게임 시작 | — |
| `GameEnd.png` | 게임 종료 | — |
| `AllPass_RoundENd.png` | 전원 패스 | — |
| `Eight_RoundEnd.png` | 8리셋 | — |
| `S3_RoundEnd.png` | 스페이드3 역전 | — |
| `Revolution.png` | 혁명 | — |
| `ExchangeCard.png` | 카드 교환 중 | — |
| `allout.png` | 카드를 다 낸 플레이어의 시트 위에 오버레이 | `game.js` `renderSeats()` |
| `fall.png` | 대부호 방어 실패 플레이어의 시트 위에 오버레이 | `game.js` `renderSeats()` |

### UI/result/
게임 결과창 레이어 구조.

| 파일 | 레이어 | 설명 |
|---|---|---|
| `result-bg-red.png` | 하단 (배경) | 빨간 사각형 |
| `result-panel-dark.png` | 상단 (전경) | 검정 다각형 패널 |

### UI/background/
배경 및 기타 UI 요소 (현재 게임 화면에서 직접 참조하지 않음).

| 파일 | 설명 |
|---|---|
| `CardGame-rankReward-bg2.png` | 빨간 카드 패널 (세로형, 왕 일러스트) |
| `CardGame-goal-itemBG1 #596.png` | 체크무늬 가로 배너 (베이지) |
| `CardGame-info-title-i18n.png` | "상세/detail" 텍스트 이미지 |
| `CardGame-joy-income-bg1.png` | 검은 불규칙 도형 배경 |
| `CardGame-preFree-clickBg-left.png` | 좌측 클릭 배경 (흰색) |
| `CardGame-preFree-clickBg-right #611.png` | 우측 클릭 배경 (흰색) |
| `cardGame-preMain-btn1-2 #487.png` | 빈 이미지 (용도 미상) |

---

## Other/
현재 게임에서 사용하지 않는 이미지 보관소. 향후 활용 가능성이 있어 삭제하지 않고 보관 중.
