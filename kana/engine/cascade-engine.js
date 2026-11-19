/* Cascade Mode Engine: Continuous refill without duplicate kana on board */
(function (global) {
  'use strict';

  const CASCADE_PAIRS_PER_LEVEL = 20;
  const CASCADE_KINDS = ['hiragana', 'katakana'];

  function rand(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function createCascadeSession(scope, reviewGroupIds = null) {
    const pool = global.getKanaPool({ scope, kinds: CASCADE_KINDS });
    if (!pool.length) {
      return null;
    }

    let baseChosen;
    if (Array.isArray(reviewGroupIds) && reviewGroupIds.length) {
      baseChosen = pool.filter((item) => reviewGroupIds.includes(item.id));
      if (!baseChosen.length) baseChosen = pool;
    } else {
      baseChosen = global.PairEngine.shuffled(pool);
    }

    // 棋盘初始对数不得超过可用池子大小，保证棋盘上绝不出现重复同一假名
    const initialPairs = Math.min(8, pool.length);
    const session = {
      pool,
      level: 1,
      pairsInLevel: 0,
      targetPairs: initialPairs,
      sequence: 0,
      groups: []
    };

    const initialItems = baseChosen.slice(0, initialPairs);
    session.groups = initialItems.map((item) => wrapCascadeItem(session, item));
    return session;
  }

  function wrapCascadeItem(session, source) {
    session.sequence += 1;
    const sourceId = source.sourceId || source.id;
    return {
      ...source,
      sourceId,
      id: `cascade_${session.sequence}_${sourceId}`
    };
  }

  function refillBoard(session, excludeSourceId = null) {
    // 严格限制目标对数不超过可用池子大小，杜绝重复假名
    const cap = Math.min(session.targetPairs, session.pool.length);
    session.targetPairs = cap;

    while (session.groups.length < cap) {
      const activeSourceIds = new Set(session.groups.map((g) => g.sourceId));
      let candidates = session.pool.filter(
        (item) => !activeSourceIds.has(item.id) && item.id !== excludeSourceId
      );
      if (!candidates.length) {
        candidates = session.pool.filter((item) => !activeSourceIds.has(item.id));
      }
      if (!candidates.length) break;
      session.groups.push(wrapCascadeItem(session, rand(candidates)));
    }

    const tiles = global.PairEngine.buildPairTiles(session.groups, CASCADE_KINDS);
    const groupIds = session.groups.map((g) => g.id);
    return { tiles, groupIds };
  }

  function advanceLevel(session) {
    session.level += 1;
    session.pairsInLevel = 0;
    // 升级后棋盘对数 +1，但上限受限于 12 以及可用池子大小 pool.length
    session.targetPairs = Math.min(session.targetPairs + 1, 12, session.pool.length);
    return refillBoard(session, null);
  }

  global.CascadeEngine = {
    CASCADE_PAIRS_PER_LEVEL,
    CASCADE_KINDS,
    createCascadeSession,
    refillBoard,
    advanceLevel
  };
})(window);
