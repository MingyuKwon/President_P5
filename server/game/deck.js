const SUITS = ['S','H','D','C'];
const NUMS  = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];

function createDeck() {
  const deck = [];
  for (const num of NUMS)
    for (const suit of SUITS)
      deck.push(num + suit);
  deck.push('Joker', 'Joker');
  return deck;
}

function shuffle(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function deal(deck, playerCount) {
  const shuffled = shuffle(deck);
  const hands = Array.from({ length: playerCount }, () => []);
  shuffled.forEach((card, i) => hands[i % playerCount].push(card));
  return hands;
}

module.exports = { createDeck, shuffle, deal };
