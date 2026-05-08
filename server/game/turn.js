function getNum(card) {
  return card === 'Joker' ? 'Joker' : card.slice(0, -1);
}

function checkRoundEnd({ tableCards, passCount, activePlayers, prevTableCards = [] }) {
  if (!tableCards || tableCards.length === 0) return { ended: false };

  const last = tableCards[tableCards.length - 1];
  const num  = getNum(last);

  if (num === '8') return { ended: true, reason: '8-clear' };

  if (prevTableCards.length === 1 && prevTableCards[0] === 'Joker' && last === '3S')
    return { ended: true, reason: 'spade-reversal' };

  if (passCount >= activePlayers - 1) return { ended: true, reason: 'all-pass' };

  return { ended: false };
}

function checkRevolution(cards) {
  if (cards.length !== 4) return false;
  const nonJoker = cards.filter(c => c !== 'Joker');
  const nums = nonJoker.map(getNum);
  return new Set(nums).size === 1;
}

module.exports = { checkRoundEnd, checkRevolution };
