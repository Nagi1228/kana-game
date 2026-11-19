/* Whack-a-mole Engine (假名打地鼠) */
(function (global) {
  'use strict';

  const MOLE_HOLES = 9;
  const MOLE_SECONDS = 60;
  const WRONG_PENALTY = 5;

  const MOLE_SPEEDS = {
    slow: { label: '慢', life: 3920, step: 0, min: 3920 },
    mid: { label: '中', life: 2500, step: 210, min: 1500 },
    fast: { label: '快', life: 1750, step: 190, min: 820 }
  };

  // 数字键 1–9 映射九个洞口，布局同数字小键盘（7 8 9 / 4 5 6 / 1 2 3）
  const NUMPAD_TO_HOLE_INDEX = {
    Digit7: 0, Numpad7: 0, '7': 0,
    Digit8: 1, Numpad8: 1, '8': 1,
    Digit9: 2, Numpad9: 2, '9': 2,
    Digit4: 3, Numpad4: 3, '4': 3,
    Digit5: 4, Numpad5: 4, '5': 4,
    Digit6: 5, Numpad6: 5, '6': 5,
    Digit1: 6, Numpad1: 6, '1': 6,
    Digit2: 7, Numpad2: 7, '2': 7,
    Digit3: 8, Numpad3: 8, '3': 8
  };

  /**
   * 预留播放读音接口（5c 接入音频时实现）
   * @param {string} kanaId
   */
  function playKanaAudio(kanaId) {
    void kanaId;
  }

  /**
   * 范围从"行"扩展为"行 + 范围"：
   * 支持清音各行（a..wa/all）以及浊音（dakuon）、半浊音（handakuon）、拗音（yoon）、进阶（advanced）
   */
  function getMolePool({ rows = ['a', 'ka'], scope = 'seion', play = 'sound', script = 'mixed', level = 1 }) {
    const isPair = play === 'pair';
    const kinds = isPair
      ? ['hiragana', 'katakana']
      : (script === 'katakana' ? ['katakana', 'romaji'] : ['hiragana', 'romaji']);
    const includeAdvanced = isPair || level >= 5 || scope === 'advanced';

    const basePool = global.getKanaPool({ scope, kinds, includeAdvanced });
    if (scope !== 'seion') {
      return basePool;
    }

    const activeRows = rows.includes('all') ? global.KANA_ROWS.map((r) => r.id) : rows;
    if (!activeRows.length) return [];
    const rowSet = new Set(activeRows);
    return basePool.filter((item) => item.row && rowSet.has(item.row));
  }

  function calcMoleTiming(speedKey, level) {
    const speed = MOLE_SPEEDS[speedKey] || MOLE_SPEEDS.mid;
    return {
      life: Math.max(speed.min, speed.life - (level - 1) * speed.step),
      decoys: Math.min(5, 2 + Math.floor((level - 1) / 1.5))
    };
  }

  function moleLevelNeed(level) {
    return 6 + level * 2;
  }

  function buildMoleConfigKey({ play, dir, script, scope, rows, speed }) {
    const scopePart = scope === 'seion'
      ? (rows.includes('all') ? 'all' : global.KANA_ROWS.filter((r) => rows.includes(r.id)).map((r) => r.id).join('+'))
      : scope;
    const kindPart = play === 'pair' ? `pair-${dir}` : `sound-${script}`;
    return `${kindPart}|${scopePart}|${speed}`;
  }

  global.MoleEngine = {
    MOLE_HOLES,
    MOLE_SECONDS,
    WRONG_PENALTY,
    MOLE_SPEEDS,
    NUMPAD_TO_HOLE_INDEX,
    playKanaAudio,
    getMolePool,
    calcMoleTiming,
    moleLevelNeed,
    buildMoleConfigKey
  };
})(window);
