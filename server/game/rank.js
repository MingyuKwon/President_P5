const { getRank } = require('./card');

const RANK_MAP = {
  3: ['president', 'citizen', 'scum'],
  4: ['president', 'vice-president', 'vice-scum', 'scum'],
};

function buildRanks(n) {
  return ['president', 'vice-president', ...Array(n - 4).fill('citizen'), 'vice-scum', 'scum'];
}

function assignRanks(orderedPlayerIds) {
  const n = orderedPlayerIds.length;
  const ranks = RANK_MAP[n] || buildRanks(n);
  const result = {};
  orderedPlayerIds.forEach((id, i) => { result[id] = ranks[i]; });
  return result;
}

function getTaxCards(hand, count) {
  return [...hand]
    .filter(c => c !== 'Joker')
    .sort((a, b) => getRank(b) - getRank(a))
    .slice(0, count);
}

module.exports = { assignRanks, getTaxCards, buildRanks };
