/* Local Storage Manager with tangogo:kana: prefix & legacy migration */
(function (global) {
  'use strict';

  const PREFIX = 'tangogo:kana:';
  const LEGACY_MOLE_RANK_KEY = 'kana-match:mole-ranking:v1';
  const MOLE_RANK_KEY = `${PREFIX}mole-ranking:v1`;
  const MIGRATED_FLAG = `${PREFIX}migrated:v1`;
  const MOLE_RANK_PER_CONFIG = 10;
  const memoryFallback = [];

  function migrateLegacyStorage() {
    try {
      if (localStorage.getItem(MIGRATED_FLAG)) return;
      const legacyRaw = localStorage.getItem(LEGACY_MOLE_RANK_KEY);
      if (legacyRaw) {
        const legacyList = JSON.parse(legacyRaw);
        const currentRaw = localStorage.getItem(MOLE_RANK_KEY);
        const currentList = currentRaw ? JSON.parse(currentRaw) : [];
        if (Array.isArray(legacyList) && legacyList.length > 0) {
          const seenIds = new Set(currentList.map((item) => item.id));
          const merged = currentList.concat(legacyList.filter((item) => item && !seenIds.has(item.id)));
          localStorage.setItem(MOLE_RANK_KEY, JSON.stringify(merged));
        }
        localStorage.removeItem(LEGACY_MOLE_RANK_KEY);
      }
      localStorage.setItem(MIGRATED_FLAG, '1');
    } catch (_) {
      // Ignore storage quota or private-mode restrictions
    }
  }

  function loadMoleRanking() {
    migrateLegacyStorage();
    try {
      const list = JSON.parse(localStorage.getItem(MOLE_RANK_KEY) || '[]');
      return Array.isArray(list) ? list : memoryFallback.slice();
    } catch (_) {
      return memoryFallback.slice();
    }
  }

  function saveMoleRanking(entry) {
    const sorted = loadMoleRanking()
      .concat(entry)
      .sort((a, b) => (b.score || 0) - (a.score || 0) || (b.hits || 0) - (a.hits || 0));
    const counts = new Map();
    const kept = sorted.filter((item) => {
      const count = counts.get(item.key) || 0;
      counts.set(item.key, count + 1);
      return count < MOLE_RANK_PER_CONFIG;
    });
    try {
      localStorage.setItem(MOLE_RANK_KEY, JSON.stringify(kept));
    } catch (_) {
      memoryFallback.splice(0, memoryFallback.length, ...kept);
    }
    return kept.filter((item) => item.key === entry.key);
  }

  function getPref(key, fallback) {
    try {
      const val = localStorage.getItem(`${PREFIX}${key}`);
      return val !== null ? val : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function setPref(key, val) {
    try {
      localStorage.setItem(`${PREFIX}${key}`, String(val));
    } catch (_) {}
  }

  migrateLegacyStorage();

  global.KanaStorage = {
    PREFIX,
    MOLE_RANK_KEY,
    migrateLegacyStorage,
    loadMoleRanking,
    saveMoleRanking,
    getPref,
    setPref
  };
})(window);
