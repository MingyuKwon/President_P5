const BASE_ORDER = ['3','4','5','6','7','8','9','10','J','Q','K','A','2','Joker'];
const REV_ORDER  = ['2','A','K','Q','J','10','9','8','7','6','5','4','3','Joker'];

function getRank(card, revolution = false) {
  const num = card === 'Joker' ? 'Joker' : card.slice(0, -1);
  const order = revolution ? REV_ORDER : BASE_ORDER;
  return order.indexOf(num);
}

function compareCards(a, b, revolution = false) {
  return getRank(a, revolution) - getRank(b, revolution);
}

function getPlayNumber(cards, revolution = false) {
  const nonJoker = cards.filter(c => c !== 'Joker');
  if (nonJoker.length === 0) return getRank('Joker', revolution);
  return getRank(nonJoker[0], revolution);
}

function isValidPlay(cards, tableCards, revolution = false) {
  if (cards.length !== tableCards.length) return false;
  return getPlayNumber(cards, revolution) > getPlayNumber(tableCards, revolution);
}

module.exports = { compareCards, isValidPlay, getRank, getPlayNumber };
