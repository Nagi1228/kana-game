/**
 * Tangogo 日语声调高低线（Pitch Accent）可复用组件
 * 支持：
 * 1. 东京式标准音调规则（平板 0、头高 1、中高 2..N-1、尾高 N）+ 末尾空心助词点
 * 2. 精确拆拍（合并拗音小字 ゃゅょャュョ 及小假名 ぁぃぅぇぉァィゥェォ，独立计算 っ/ッ、ん/ン、ー）
 * 3. 兼容纯数字（0, 2）、圆圈数字（⓪, ②）及多读法（0/3, ①/③）并列绘制
 * 4. 自适应浅色与深色模式，异常/空值/超拍数降级显示"暂无声调"
 * 5. 内置单元测试套件 runPitchAccentTests()
 */
(function (global) {
  'use strict';

  // 拗音及依附性小假名（与前一假名合并为一拍；促音 っ/ッ 单独成拍，不在此集合）
  const COMBINING_SMALL_KANA = new Set([
    'ゃ', 'ゅ', 'ょ', 'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ', 'ゎ', 'ゕ', 'ゖ',
    'ャ', 'ュ', 'ョ', 'ァ', 'ィ', 'ゥ', 'ェ', 'ォ', 'ヮ', 'ヵ', 'ヶ'
  ]);

  const CIRCLED_NUM_MAP = {
    '⓪': 0, '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5,
    '⑥': 6, '⑦': 7, '⑧': 8, '⑨': 9, '⑩': 10, '⑪': 11,
    '⑫': 12, '⑬': 13, '⑭': 14, '⑮': 15, '⑯': 16, '⑰': 17,
    '⑱': 18, '⑲': 19, '⑳': 20
  };

  /**
   * 拆拍函数 splitMora(kana)
   * 规则：
   * - 一个假名一拍
   * - 拗音小字（ゃゅょ/ャュョ）及小号 ぁぃぅぇぉ/ァィゥェォ 与前一个假名合为一拍
   * - 促音「っ/ッ」、拨音「ん/ン」、长音「ー」各算一拍
   */
  function splitMora(kanaStr) {
    if (!kanaStr || typeof kanaStr !== 'string') return [];
    const cleaned = kanaStr.trim().replace(/\s+/g, '');
    if (!cleaned) return [];

    const chars = Array.from(cleaned);
    const morae = [];

    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (COMBINING_SMALL_KANA.has(ch) && morae.length > 0) {
        morae[morae.length - 1] += ch;
      } else {
        morae.push(ch);
      }
    }
    return morae;
  }

  /**
   * 解析单个声调标记为非负整数（如 "0" -> 0, "①" -> 1, "[2]" -> 2），非法返回 null
   */
  function parseSinglePitchToken(token) {
    if (token === null || token === undefined) return null;
    const raw = String(token).trim().replace(/^[\[\(（【]|[\]\)）】]$/g, '').trim();
    if (!raw) return null;

    if (Object.prototype.hasOwnProperty.call(CIRCLED_NUM_MAP, raw)) {
      return CIRCLED_NUM_MAP[raw];
    }
    if (/^\d+$/.test(raw)) {
      return parseInt(raw, 10);
    }
    return null;
  }

  /**
   * 解析声调字段（支持单声调如 "0"、"①" 与多声调如 "0/3"、"①/③"、"0,2"）
   * @returns {Array<number>|null} 若包含非法标记或为空，返回 null
   */
  function parsePitchValues(pitchInput) {
    if (pitchInput === null || pitchInput === undefined) return null;
    if (typeof pitchInput === 'number') {
      return Number.isInteger(pitchInput) && pitchInput >= 0 ? [pitchInput] : null;
    }
    const str = String(pitchInput).trim();
    if (!str) return null;

    const parts = str.split(/[\/／,，、・|]+/).map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) return null;

    const nums = [];
    for (const part of parts) {
      const n = parseSinglePitchToken(part);
      if (n === null || !Number.isInteger(n) || n < 0) {
        return null;
      }
      nums.push(n);
    }
    return nums;
  }

  /**
   * 根据拍数 moraCount 与声调核 n 计算东京式标准高低序列（含末尾第 moraCount+1 个助词位）
   * @returns {{ levels: Array<'H'|'L'>, typeKey: string, typeName: string } | null}
   */
  function computePitchPattern(moraCount, n) {
    if (!Number.isInteger(moraCount) || moraCount <= 0) return null;
    if (!Number.isInteger(n) || n < 0 || n > moraCount) return null;

    const levels = [];
    let typeKey = '';
    let typeName = '';

    if (n === 0) {
      // 平板型：第1拍低，其余拍高，后接助词也保持高
      typeKey = 'heiban';
      typeName = '平板';
      for (let i = 1; i <= moraCount + 1; i++) {
        levels.push(i === 1 ? 'L' : 'H');
      }
    } else if (n === 1) {
      // 头高型：第1拍高，其余拍低（含助词低）
      typeKey = 'atamadaka';
      typeName = '头高';
      for (let i = 1; i <= moraCount + 1; i++) {
        levels.push(i === 1 ? 'H' : 'L');
      }
    } else if (n < moraCount) {
      // 中高型（2 到 拍数-1）：第1拍低，第2拍到第n拍高，之后低（含助词低）
      typeKey = 'nakadaka';
      typeName = '中高';
      for (let i = 1; i <= moraCount + 1; i++) {
        levels.push(i >= 2 && i <= n ? 'H' : 'L');
      }
    } else {
      // 尾高型（n === 拍数）：第1拍低，其余拍高，后接助词降为低
      typeKey = 'odaka';
      typeName = '尾高';
      for (let i = 1; i <= moraCount + 1; i++) {
        levels.push(i >= 2 && i <= moraCount ? 'H' : 'L');
      }
    }

    return { levels, typeKey, typeName };
  }

  /**
   * 校验单个词条的假名与声调是否合法
   */
  function validateWordPitch(kana, pitchInput) {
    const morae = splitMora(kana);
    if (morae.length === 0) {
      return { valid: false, reason: '假名为空，无法拆分拍数', morae: [], values: [] };
    }
    const str = (pitchInput === null || pitchInput === undefined) ? '' : String(pitchInput).trim();
    if (!str) {
      return { valid: false, reason: '声调为空', morae, values: [] };
    }
    const nums = parsePitchValues(str);
    if (!nums) {
      return { valid: false, reason: `格式不合法（"${str}"）`, morae, values: [] };
    }
    for (const n of nums) {
      if (n > morae.length) {
        return {
          valid: false,
          reason: `声调数字 ${n} 大于词条总拍数 ${morae.length}（${morae.join('·')}）`,
          morae,
          values: nums
        };
      }
    }
    return { valid: true, reason: '', morae, values: nums };
  }

  function escapeXml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * 注入自适应浅色/深色主题的组件样式（只注入一次）
   */
  function ensureStylesInjected() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('tangogo-pitch-accent-styles')) return;

    const style = document.createElement('style');
    style.id = 'tangogo-pitch-accent-styles';
    style.textContent = `
      .tgo-pitch-group {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 12px;
      }
      .tgo-pitch-card {
        --pa-bg: #F6F7FA;
        --pa-border: #E2E5EE;
        --pa-text: #16161A;
        --pa-muted: #7C808F;
        --pa-particle-fill: #FFFFFF;
        --pa-heiban: #2563EB;
        --pa-atamadaka: #E11D48;
        --pa-nakadaka: #D97706;
        --pa-odaka: #059669;

        display: inline-flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 8px 12px 6px;
        border-radius: 14px;
        background: var(--pa-bg);
        border: 1px solid var(--pa-border);
        transition: background .2s ease, border-color .2s ease;
      }
      :root[data-theme="dark"] .tgo-pitch-card,
      .dark .tgo-pitch-card {
        --pa-bg: #1B1C22;
        --pa-border: #2D2F3B;
        --pa-text: #F2F2F5;
        --pa-muted: #989BA8;
        --pa-particle-fill: #17171C;
        --pa-heiban: #60A5FA;
        --pa-atamadaka: #FB7185;
        --pa-nakadaka: #FBBF24;
        --pa-odaka: #34D399;
      }
      @media (prefers-color-scheme: dark) {
        :root:not([data-theme="light"]) .tgo-pitch-card {
          --pa-bg: #1B1C22;
          --pa-border: #2D2F3B;
          --pa-text: #F2F2F5;
          --pa-muted: #989BA8;
          --pa-particle-fill: #17171C;
          --pa-heiban: #60A5FA;
          --pa-atamadaka: #FB7185;
          --pa-nakadaka: #FBBF24;
          --pa-odaka: #34D399;
        }
      }
      .tgo-pitch-header {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 11.5px;
        font-weight: 700;
        line-height: 1.2;
      }
      .tgo-pitch-badge {
        padding: 1px 7px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 800;
      }
      .tgo-pitch-card[data-type="heiban"] { --pa-accent: var(--pa-heiban); }
      .tgo-pitch-card[data-type="atamadaka"] { --pa-accent: var(--pa-atamadaka); }
      .tgo-pitch-card[data-type="nakadaka"] { --pa-accent: var(--pa-nakadaka); }
      .tgo-pitch-card[data-type="odaka"] { --pa-accent: var(--pa-odaka); }

      .tgo-pitch-badge {
        color: var(--pa-accent);
        background: color-mix(in srgb, var(--pa-accent) 14%, transparent);
      }
      .tgo-pitch-num {
        color: var(--pa-muted);
        font-variant-numeric: tabular-nums;
      }
      .tgo-pitch-empty {
        display: inline-flex;
        align-items: center;
        padding: 4px 12px;
        border-radius: 999px;
        font-size: 12.5px;
        font-weight: 600;
        color: var(--muted, #6C6C78);
        background: var(--field, #F3F2EE);
        border: 1px solid var(--line, #E8E6E1);
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * 生成单张声调高低线 SVG 字符串
   * @param {string} kana 假名字符串
   * @param {number|string} pitchNum 单个声调数字（如 0, 1, "②"）
   * @returns {string} SVG 字符串，不合法时返回空字符串
   */
  function createPitchSVG(kana, pitchNum) {
    const morae = splitMora(kana);
    const n = parseSinglePitchToken(pitchNum);
    if (morae.length === 0 || n === null || n < 0 || n > morae.length) {
      return '';
    }

    const pattern = computePitchPattern(morae.length, n);
    if (!pattern) return '';

    const totalPoints = morae.length + 1; // 词拍数 + 1个助词点
    const stepX = 34;
    const padX = 20;
    const width = padX * 2 + (totalPoints - 1) * stepX;
    const yHigh = 14;
    const yLow = 36;
    const yText = 58;
    const height = 68;

    const coords = pattern.levels.map((lvl, idx) => ({
      x: padX + idx * stepX,
      y: lvl === 'H' ? yHigh : yLow,
      isParticle: idx === morae.length,
      label: idx < morae.length ? morae[idx] : '助'
    }));

    // 拆分为实线（词本体各拍之间）与虚线（最后一拍到助词点之间）
    const wordCoords = coords.slice(0, morae.length);
    const polylinePoints = wordCoords.map(p => `${p.x},${p.y}`).join(' ');
    const lastWordPt = wordCoords[wordCoords.length - 1];
    const particlePt = coords[coords.length - 1];

    const circlesSvg = coords.map(p => {
      if (p.isParticle) {
        return `<circle cx="${p.x}" cy="${p.y}" r="4.5" fill="var(--pa-particle-fill, #ffffff)" stroke="var(--pa-accent, #2563EB)" stroke-width="2.2" />`;
      }
      return `<circle cx="${p.x}" cy="${p.y}" r="4.8" fill="var(--pa-accent, #2563EB)" />`;
    }).join('');

    const labelsSvg = coords.map(p => {
      const fontSize = p.label.length > 1 ? 12 : 14;
      const fill = p.isParticle ? 'var(--pa-muted, #7C808F)' : 'var(--pa-text, #16161A)';
      const fontWeight = p.isParticle ? '600' : '700';
      return `<text x="${p.x}" y="${yText}" text-anchor="middle" font-size="${fontSize}" font-weight="${fontWeight}" fill="${fill}" font-family="'M PLUS Rounded 1c', 'Noto Sans JP', sans-serif">${escapeXml(p.label)}</text>`;
    }).join('');

    return `<svg class="tgo-pitch-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(kana)} 声调 ${n}型 ${pattern.typeName}型">
      <line x1="${padX - 6}" y1="${yHigh}" x2="${width - padX + 6}" y2="${yHigh}" stroke="var(--pa-border, #E2E5EE)" stroke-width="1" stroke-dasharray="2 3" />
      <line x1="${padX - 6}" y1="${yLow}" x2="${width - padX + 6}" y2="${yLow}" stroke="var(--pa-border, #E2E5EE)" stroke-width="1" stroke-dasharray="2 3" />
      ${wordCoords.length > 1 ? `<polyline fill="none" stroke="var(--pa-accent, #2563EB)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${polylinePoints}" />` : ''}
      <line x1="${lastWordPt.x}" y1="${lastWordPt.y}" x2="${particlePt.x}" y2="${particlePt.y}" stroke="var(--pa-accent, #2563EB)" stroke-width="2" stroke-dasharray="3 3" />
      ${circlesSvg}
      ${labelsSvg}
    </svg>`;
  }

  /**
   * 渲染完整的声调组件 HTML（包含调型标注 + 多读法并列 + 空值/非法降级处理）
   * @param {string} kana 假名字符串
   * @param {string|number} pitchInput 声调字段（如 "0", "①", "0/3"）
   * @returns {string} HTML 字符串
   */
  function renderPitchHTML(kana, pitchInput) {
    ensureStylesInjected();
    const validation = validateWordPitch(kana, pitchInput);
    if (!validation.valid) {
      return `<span class="tgo-pitch-empty">暂无声调</span>`;
    }

    const cards = validation.values.map(n => {
      const pattern = computePitchPattern(validation.morae.length, n);
      const svg = createPitchSVG(kana, n);
      return `<div class="tgo-pitch-card" data-type="${pattern.typeKey}">
        <div class="tgo-pitch-header">
          <span class="tgo-pitch-badge">${pattern.typeName}</span>
          <span class="tgo-pitch-num">[${n}]</span>
        </div>
        ${svg}
      </div>`;
    }).join('');

    return `<div class="tgo-pitch-group">${cards}</div>`;
  }

  /**
   * 直接挂载声调图到指定 DOM 容器
   */
  function mountPitchComponent(containerEl, kana, pitchInput) {
    if (!containerEl) return;
    containerEl.innerHTML = renderPitchHTML(kana, pitchInput);
  }

  /**
   * 单元测试套件：验证拆拍函数与所有指定单词用例的高低序列
   */
  function runPitchAccentTests() {
    const cases = [
      {
        name: 'はし 箸[1]（头高）',
        kana: 'はし',
        pitch: 1,
        expectedMorae: ['は', 'し'],
        expectedLevels: ['H', 'L', 'L'],
        expectedType: '头高'
      },
      {
        name: 'はし 橋[2]（尾高）',
        kana: 'はし',
        pitch: 2,
        expectedMorae: ['は', 'し'],
        expectedLevels: ['L', 'H', 'L'],
        expectedType: '尾高'
      },
      {
        name: 'はし 端[0]（平板）',
        kana: 'はし',
        pitch: 0,
        expectedMorae: ['は', 'し'],
        expectedLevels: ['L', 'H', 'H'],
        expectedType: '平板'
      },
      {
        name: 'さくら[0]（平板）',
        kana: 'さくら',
        pitch: '⓪',
        expectedMorae: ['さ', 'く', 'ら'],
        expectedLevels: ['L', 'H', 'H', 'H'],
        expectedType: '平板'
      },
      {
        name: 'にほんご[0]（含拨音 ん，平板）',
        kana: 'にほんご',
        pitch: 0,
        expectedMorae: ['に', 'ほ', 'ん', 'ご'],
        expectedLevels: ['L', 'H', 'H', 'H', 'H'],
        expectedType: '平板'
      },
      {
        name: 'たべる[2]（中高）',
        kana: 'たべる',
        pitch: 2,
        expectedMorae: ['た', 'べ', 'る'],
        expectedLevels: ['L', 'H', 'L', 'L'],
        expectedType: '中高'
      },
      {
        name: 'がっこう[0]（含促音 っ，平板）',
        kana: 'がっこう',
        pitch: 0,
        expectedMorae: ['が', 'っ', 'こ', 'う'],
        expectedLevels: ['L', 'H', 'H', 'H', 'H'],
        expectedType: '平板'
      },
      {
        name: 'きょう[1]（含拗音 きょ，头高）',
        kana: 'きょう',
        pitch: 1,
        expectedMorae: ['きょ', 'う'],
        expectedLevels: ['H', 'L', 'L'],
        expectedType: '头高'
      }
    ];

    const results = cases.map(tc => {
      const morae = splitMora(tc.kana);
      const parsed = parsePitchValues(tc.pitch);
      const pattern = parsed ? computePitchPattern(morae.length, parsed[0]) : null;
      const moraeOk = JSON.stringify(morae) === JSON.stringify(tc.expectedMorae);
      const levelsOk = pattern && JSON.stringify(pattern.levels) === JSON.stringify(tc.expectedLevels);
      const typeOk = pattern && pattern.typeName === tc.expectedType;
      const svgStr = createPitchSVG(tc.kana, tc.pitch);
      const svgOk = svgStr.startsWith('<svg') && svgStr.includes('</svg>');
      return {
        用例: tc.name,
        通过: Boolean(moraeOk && levelsOk && typeOk && svgOk),
        实际拆拍: morae.join('·'),
        实际高低序列: pattern ? pattern.levels.join('-') : 'ERR'
      };
    });

    // 边缘用例验证：超拍数 & 空值 & 多声调
    const invalidOver = validateWordPitch('はし', 3);
    const invalidEmpty = validateWordPitch('はし', '');
    const multiValid = validateWordPitch('はし', '0/2');
    const edgeOk = !invalidOver.valid && !invalidEmpty.valid && multiValid.valid && multiValid.values.length === 2;

    const allPassed = results.every(r => r.通过) && edgeOk;
    return { allPassed, results, edgeOk };
  }

  global.TangogoPitchAccent = {
    splitMora,
    parseSinglePitchToken,
    parsePitchValues,
    computePitchPattern,
    validateWordPitch,
    createPitchSVG,
    renderPitchHTML,
    mountPitchComponent,
    runPitchAccentTests
  };
})(window);
