/**
 * 나만의 AI 전략 파일
 *
 * myStrategy(ctx) 함수를 수정해서 원하는 전략을 구현하세요.
 * 반환값: 낼 카드 배열 (예: ['3S', '3H']) 또는 null (패스)
 *
 * ctx 에 담긴 정보:
 *   ctx.hand          - 내 손패 배열           예: ['3S', '7H', 'KD', 'Joker']
 *   ctx.tableCards    - 현재 테이블 카드 배열   예: ['5H', '5D']  (비어있으면 선)
 *   ctx.revolution    - 혁명 여부 (boolean)
 *   ctx.isLead        - 선 여부 (tableCards가 비어있으면 true)
 *   ctx.needCount     - 내야 할 장수 (선이면 자유, 아니면 테이블 장수와 동일)
 *
 * ctx 에 담긴 헬퍼 함수:
 *   ctx.playRank(card)              - 카드의 강도 숫자 반환 (높을수록 강함)
 *   ctx.canBeat(cards, tableCards)  - 낼 카드 배열이 테이블을 이기는지 여부
 *   ctx.groupByRank(hand)           - 손패를 숫자별로 묶음  예: { '3': ['3S','3H'], 'K': ['KD'] }
 *   ctx.weakest(cards)              - 배열 중 가장 약한 카드 반환
 *   ctx.strongest(cards)            - 배열 중 가장 강한 카드 반환
 */
function myStrategy(ctx) {
  const { hand, tableCards, revolution, isLead, needCount,
          playRank, canBeat, groupByRank } = ctx;

  const groups = groupByRank(hand);

  // 조커 제외한 숫자 그룹을 약한 순으로 정렬
  const ranked = Object.entries(groups)
    .filter(([rank]) => rank !== 'Joker')
    .sort((a, b) => playRank(a[1][0]) - playRank(b[1][0]));

  if (isLead) {
    // 선: 가장 약한 숫자의 카드를 최대한 많이 낸다
    for (const [, cards] of ranked) {
      if (cards.length > 0) return cards;
    }
    return null;
  }

  // 선이 아닐 때: 테이블 장수에 맞춰 낼 수 있는 가장 약한 조합
  const N = needCount;
  for (const [, cards] of ranked) {
    if (cards.length < N) continue;
    const candidate = cards.slice(0, N);
    if (canBeat(candidate, tableCards)) return candidate;
  }

  return null; // 패스
}
