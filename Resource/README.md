# Resource 폴더 구성

## CardImage/
게임에서 실제로 사용하는 카드 이미지. `game.js`의 `cardImg()` 함수에서 동적으로 참조.

| 파일 패턴 | 설명 | 참조 위치 |
|---|---|---|
| `3S.png`, `KH.png` 등 | 숫자(3~A, 2) + 무늬(S/H/D/C) 조합 52장 | `game.js` `cardImg()` |
| `Joker.png` | 조커 카드 | `game.js` `cardImg()` |
| `Card-back.png` | 카드 뒷면 (현재 미사용, 추후 상대 손패 표시용) | — |

## UI/
게임 UI에 사용하는 이미지. 파일이 없으면 코드의 onerror/폴백 텍스트로 대체됨.

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

## Other/
현재 게임에서 사용하지 않는 이미지 보관소. 향후 활용 가능성이 있어 삭제하지 않고 보관 중.
