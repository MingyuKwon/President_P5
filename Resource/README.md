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
게임 UI에 사용하는 이미지. 파일이 없으면 코드의 onerror/폴백 텍스트로 대체됨.

### UI 루트 (직접 참조)
| 파일 | 설명 | 참조 위치 |
|---|---|---|
| `btn_play.png` | "카드 내기" 버튼 이미지 | `game.html` |
| `btn_pass.png` | "패스" 버튼 이미지 | `game.html` |
| `seat_frame.png` | 플레이어 시트 프레임 배경 이미지 | `game.js` `renderSeats()` |
| `rank_president.png` | 대부호 등급 뱃지 | `game.js` `rankImg()` |
| `rank_vice-president.png` | 부호 등급 뱃지 | `game.js` `rankImg()` |
| `rank_citizen.png` | 평민 등급 뱃지 | `game.js` `rankImg()` |
| `rank_vice-scum.png` | 빈민 등급 뱃지 | `game.js` `rankImg()` |
| `rank_scum.png` | 대빈민 등급 뱃지 | `game.js` `rankImg()` |

### UI/character/
등수별 캐릭터 이미지. `*-shadow.png`(검은 실루엣)를 하단에, `*-face.png`(컬러 얼굴)를 상단에 겹쳐서 표시하는 레이어 구조.

| 파일 | 등수 | 설명 |
|---|---|---|
| `president-face.png` | 대부호 | 금색 왕관 남자 얼굴 |
| `president-shadow.png` | 대부호 | 금색 왕관 실루엣 |
| `vice-president-face.png` | 부호 | 초록 모자 남자 얼굴 |
| `vice-president-shadow.png` | 부호 | 초록 모자 실루엣 |
| `citizen-face.png` | 평민 | 파란색 단발 여자 얼굴 |
| `citizen-shadow.png` | 평민 | 파란색 단발 실루엣 |
| `vice-scum-face.png` | 빈민 | 보라색 해골 남자 얼굴 |
| `vice-scum-shadow.png` | 빈민 | 보라색 해골 실루엣 |
| `scum-face.png` | 대빈민 | 회색 해골+폭탄 얼굴 |
| `scum-shadow.png` | 대빈민 | 회색 해골+폭탄 실루엣 |

### UI/rank-badge/
등수별 원형 뱃지 아이콘.

| 파일 | 등수 | 설명 |
|---|---|---|
| `president.png` | 대부호 | 황금 왕관 캐릭터 뱃지 |
| `vice-president.png` | 부호 | 초록 모자 캐릭터 뱃지 |
| `citizen.png` | 평민 | 청록 여자 캐릭터 뱃지 |
| `vice-scum.png` | 빈민 | 보라색 캐릭터 뱃지 |
| `scum.png` | 대빈민 | 해골 뱃지 |

### UI/game-state/
게임 중 화면에 애니메이션으로 표시하는 상태 텍스트 이미지.
일부는 여러 조각(end, end2, end3)으로 나뉘어 순차 애니메이션용으로 사용.

| 파일 | 표시 내용 |
|---|---|
| `cardGame-state-start-i18n #427.png` | "게임시작 / GAME START" |
| `cardGame-state-gameover-i18n #400.png` | "게임종료 / GAME SET" |
| `cardGame-state-allpass-i18n #342.png` | "전원패스 / ALL MEMBERS PASS" |
| `cardGame-state-allout-i18n #414.png` | "냈다 / DONE!" |
| `cardGame-state-end-i18n #336.png` | "8리셋 / 현재 턴 강제 종료" (전체) |
| `cardGame-state-end2-i18n #365.png` | "8리" (조각 1) |
| `cardGame-state-end3-i18n #355.png` | "셋 / 현재 턴 강제 종료" (조각 2) |
| `cardGame-state-wonderEnd-i18n #401.png` | "X리셋 / 카드 유형 무시 및 현재 턴 강제 종료" (전체) |
| `cardGame-state-wonderEnd2-i18n #368.png` | "X리" (조각 1) |
| `cardGame-state-wonderEnd3-i18n #425.png` | "셋 / 카드 유형 무시 및 현재 턴 강제 종료" (조각 2) |
| `cardGame-state-wonderEnd4-i18n #430.png` | "X" (조각) |
| `cardGame-state-wonderEnd5-i18n #413.png` | "리" (조각) |
| `cardGame-state-wonderEnd6-i18n #354.png` | "셋" (조각) |
| `cardGame-state-wonderEnd7-i18n #395.png` | "카드 유형 무시..." (조각) |
| `cardGame-state-3max-i18n #428.png` | "스페이드3 / 조커를 받아칠 수 있는 유일한 카드" |
| `cardGame-state-exchange-i18n #370.png` | "카드교환중..." |
| `cardGame-state-fall-i18n #406.png` | "몰락! / 대부호는 1위를 하지 못하면 대빈민으로 전락" |

### UI/background/
배경 및 기타 UI 요소.

| 파일 | 설명 |
|---|---|
| `CardGame-rankReward-bg2.png` | 빨간 카드 패널 (세로형, 왕 일러스트) |
| `CardGame-goal-itemBG1 #596.png` | 체크무늬 가로 배너 (베이지) |
| `CardGame-result-bg2.png` | 검은 다각형 배경 |
| `Texture-taozhuang-ka02-new.png` | 빨간 사각형 텍스처 |
| `CardGame-info-title-i18n.png` | "상세/detail" 텍스트 이미지 |
| `CardGame-joy-income-bg1.png` | 검은 불규칙 도형 배경 |
| `CardGame-preFree-clickBg-left.png` | 좌측 클릭 배경 (흰색) |
| `CardGame-preFree-clickBg-right #611.png` | 우측 클릭 배경 (흰색) |
| `cardGame-preMain-btn1-2 #487.png` | 빈 이미지 (용도 미상) |

---

## Other/
현재 게임에서 사용하지 않는 이미지 보관소. 향후 활용 가능성이 있어 삭제하지 않고 보관 중.
