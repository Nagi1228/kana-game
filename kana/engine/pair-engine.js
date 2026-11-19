/* Pair Matching Engine: kana-kata, romaji (hiragana/katakana toggle), and triple */
(function (global) {
  'use strict';

  function shuffled(items) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function getPairKinds(mode, romajiScript) {
    if (mode === 'kana-kata') return ['hiragana', 'katakana'];
    if (mode === 'triple') return ['hiragana', 'katakana', 'romaji'];
    if (mode === 'romaji') {
      return [romajiScript === 'katakana' ? 'katakana' : 'hiragana', 'romaji'];
    }
    return ['hiragana', 'katakana'];
  }

  function buildPairTiles(kanaGroups, kinds) {
    const tiles = [];
    for (const group of kanaGroups) {
      for (const kind of kinds) {
        const label = kind === 'romaji' ? group.romaji.toUpperCase() : group[kind];
        tiles.push({
          tileId: `${group.id}_${kind}`,
          groupId: group.id,
          kind,
          label,
          data: group
        });
      }
    }
    return shuffled(tiles);
  }

  function createPairRound({ mode, scope, romajiScript = 'hiragana', reviewGroupIds = null, maxPairs = 8 }) {
    const kinds = getPairKinds(mode, romajiScript);
    const pool = global.getKanaPool({ scope, kinds });
    if (!pool.length) {
      return { pool: [], chosen: [], kinds, tiles: [], groupIds: [] };
    }

    let chosen;
    if (Array.isArray(reviewGroupIds) && reviewGroupIds.length) {
      chosen = pool.filter((item) => reviewGroupIds.includes(item.id));
      if (!chosen.length) chosen = pool;
    } else {
      chosen = shuffled(pool).slice(0, Math.min(maxPairs, pool.length));
    }

    const groupIds = chosen.map((item) => item.id);
    const tiles = buildPairTiles(chosen, kinds);
    return { pool, chosen, kinds, tiles, groupIds };
  }

  global.PairEngine = {
    shuffled,
    getPairKinds,
    buildPairTiles,
    createPairRound
  };
})(window);
