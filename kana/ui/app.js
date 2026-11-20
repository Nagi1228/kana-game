/* UI Controller & View Rendering (Instruction 5b-2) */
(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const MODE_INFO = {
    'kana-kata': { title: '平假名 × 片假名', subtitle: '找到同一个读音', points: 10 },
    romaji: { title: '罗马音 × 假名', subtitle: '读音与字形配对', points: 10 },
    triple: { title: '综合配对', subtitle: '平假名、片假名、罗马音任意两两配对', points: 10 },
    cascade: { title: '补位闯关', subtitle: `合成后补充新假名，每 ${CascadeEngine.CASCADE_PAIRS_PER_LEVEL} 对进入下一关`, points: 10 },
    mogura: { title: '假名打地鼠', subtitle: '敲出看到的读音，60 秒挑战', points: 10 }
  };

  const LABELS = { hiragana: '平假名', katakana: '片假名', romaji: '罗马音' };
  const GROUP_LABELS = {
    seion: '清音',
    dakuon: '浊音',
    handakuon: '半浊音',
    yoon: '拗音',
    special: '特殊组合',
    advanced: '进阶',
    all: '全部'
  };
  const MOLE_SCRIPT_LABELS = { hiragana: '平假名', katakana: '片假名', mixed: '混合' };
  const MOLE_DIR_LABELS = { h2k: '平→片', k2h: '片→平', mixed: '平片混合' };
  const MOLE_HINTS = {
    sound: '记住顶部的读音，在洞口敲出对应的假名（支持小键盘 1–9）。',
    pair: '看顶部的假名，敲出它对应的另一种假名（支持小键盘 1–9）。'
  };
  const MOLE_OPTION_GROUPS = [['.mole-dir', 'dir', 'moleDir'], ['.mole-speed', 'speed', 'moleSpeed']];

  const state = {
    selectedMode: 'kana-kata',
    scope: 'seion',
    romajiScript: 'hiragana',
    sound: true,
    paused: false,
    lock: false,
    finished: false,
    timerId: null,
    mismatchTimer: null,
    mode: 'kana-kata',
    score: 0,
    startedAt: 0,
    elapsed: 0,
    secondsLeft: 0,
    useTimer: false,
    timerDuration: 90,
    groupIds: [],
    matchedGroups: new Set(),
    firstTry: new Map(),
    mistakes: 0,
    errorGroupIds: new Set(),
    kanaErrors: new Map(),
    tiles: [],
    selectedTileId: null,
    cascadeSession: null,
    levelModalOpen: false,
    levelStartElapsed: 0,
    levelStartScore: 0,
    levelStartAttempts: 0,
    levelStartAccurate: 0,
    lastResultMode: 'kana-kata',
    moleScope: 'seion',
    moleRows: ['a', 'ka'],
    moleScript: 'mixed',
    moleSpeed: 'mid',
    molePlay: 'sound',
    moleDir: 'mixed',
    mole: null,
    confirmCallback: null
  };

  const screens = {
    home: $('#home-screen'),
    game: $('#game-screen'),
    result: $('#result-screen')
  };

  const rand = (items) => items[Math.floor(Math.random() * items.length)];
  const shuffled = PairEngine.shuffled;
  const pad = (n) => String(n).padStart(2, '0');
  const timeText = (seconds) => `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;

  function showScreen(which) {
    for (const [name, element] of Object.entries(screens)) {
      const active = name === which;
      element.classList.toggle('active', active);
      element.hidden = !active;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast.timeout);
    toast.timeout = setTimeout(() => el.classList.remove('show'), 1900);
  }

  /* ==================== In-page Confirm Modal ==================== */
  function openConfirmModal({ title, message, confirmLabel = '确定', onConfirm }) {
    $('#confirm-modal-title').textContent = title;
    $('#confirm-modal-message').textContent = message;
    $('#confirm-ok-label').textContent = confirmLabel;
    state.confirmCallback = onConfirm;
    $('#confirm-modal').classList.remove('hidden');
  }

  function closeConfirmModal() {
    $('#confirm-modal').classList.add('hidden');
    state.confirmCallback = null;
  }

  /* ==================== Audio Feedback ==================== */
  const audio = {
    ctx: null,
    master: null,
    unlock() {
      try {
        if (!this.ctx) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (!AudioContextClass) return;
          this.ctx = new AudioContextClass();
          this.master = this.ctx.createGain();
          this.master.gain.value = 0.9;
          this.master.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended' && this.ctx.resume) this.ctx.resume();
      } catch (_) {}
    }
  };

  const TONES = {
    good: { type: 'sine', peak: 0.34, notes: [[784, 0, 0.13], [1174.7, 0.075, 0.19]] },
    complete: { type: 'sine', peak: 0.36, notes: [[659.3, 0, 0.14], [880, 0.1, 0.16], [1318.5, 0.22, 0.32]] },
    bad: { type: 'triangle', peak: 0.32, notes: [[233.1, 0, 0.17], [174.6, 0.12, 0.26]] }
  };

  function playTone(kind) {
    if (!state.sound) return;
    audio.unlock();
    const context = audio.ctx;
    if (!context) return;
    const spec = TONES[kind] || TONES.good;
    const start = context.currentTime + 0.01;
    for (const [frequency, offset, duration] of spec.notes) {
      try {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = spec.type;
        oscillator.frequency.setValueAtTime(frequency, start + offset);
        gain.gain.setValueAtTime(0.0001, start + offset);
        gain.gain.linearRampToValueAtTime(spec.peak, start + offset + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + duration);
        oscillator.connect(gain);
        gain.connect(audio.master || context.destination);
        oscillator.start(start + offset);
        oscillator.stop(start + offset + duration + 0.03);
      } catch (_) {}
    }
  }

  function setSound(on) {
    const wasOn = state.sound;
    state.sound = on;
    $('#sound-toggle').checked = on;
    $('#header-sound-icon').textContent = on ? '♫' : '♪̸';
    $('#game-sound').innerHTML = on ? '♫ <span>音效开启</span>' : '♪̸ <span>音效关闭</span>';
    $('#header-sound').setAttribute('aria-pressed', String(on));
    if (on && !wasOn) playTone('good');
  }

  function setFeedback(message, type = '') {
    const line = $('#feedback-line');
    line.classList.remove('good', 'bad');
    if (type) line.classList.add(type);
    $('#feedback-text').textContent = message;
    $('.feedback-symbol').textContent = type === 'good' ? '✓' : type === 'bad' ? '×' : '✳';
  }

  function syncFullscreenButton() {
    const active = Boolean(document.fullscreenElement);
    $('#fullscreen-button').setAttribute('aria-pressed', String(active));
    $('#fullscreen-button').title = active ? '退出全屏' : '进入全屏';
    $('#fullscreen-label').textContent = active ? '退出全屏' : '全屏';
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else toast('当前浏览器不支持全屏模式');
    } catch (_) {
      toast('无法切换全屏，请检查浏览器权限');
    }
    syncFullscreenButton();
  }

  function updateModeUI() {
    $$('#mode-grid .mode-card').forEach((button) => {
      const active = button.dataset.mode === state.selectedMode;
      button.classList.toggle('selected', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const isMogura = state.selectedMode === 'mogura';
    const isRomaji = state.selectedMode === 'romaji';
    $('#scope-row').classList.toggle('hidden', isMogura);
    $('#romaji-script-row').classList.toggle('hidden', !isRomaji);
    $('#mole-setup').classList.toggle('hidden', !isMogura);
    if (isMogura) refreshMoleBest();
  }

  function recordKanaAttempt(targetItem, { correct = true, miss = false, confusedLabel = '' } = {}) {
    if (!targetItem) return;
    const id = targetItem.sourceId || targetItem.id;
    KanaRecorder.record({
      kanaId: id,
      correct,
      miss,
      mode: state.mode,
      confusedWith: confusedLabel || undefined
    });
  }

  function setTimerUi() {
    $('#timer-display').classList.toggle('hidden', !state.useTimer);
    $('#timer-display').textContent = timeText(Math.max(0, state.secondsLeft));
  }

  /* ==================== Start Game ==================== */
  function startGame(mode = state.selectedMode, review = null) {
    const info = MODE_INFO[mode];
    if (!info) return;

    clearInterval(state.timerId);
    clearTimeout(state.mismatchTimer);
    if (state.mole) clearMoleTimers();
    $('#pause-modal').classList.add('hidden');
    $('#level-modal').classList.add('hidden');
    closeConfirmModal();

    state.mode = mode;
    state.lastResultMode = mode;
    const runConfig = mode === 'mogura'
      ? { scope: state.moleScope, rows: state.moleRows.slice(), play: state.molePlay, script: state.moleScript, dir: state.moleDir, speed: state.moleSpeed }
      : { scope: state.scope, romajiScript: mode === 'romaji' ? state.romajiScript : null, review: Boolean(review) };
    KanaRecorder.startRun({ mode, config: runConfig });
    state.score = 0;
    state.startedAt = Date.now();
    state.elapsed = 0;
    state.paused = false;
    state.lock = false;
    state.finished = false;
    state.mistakes = 0;
    state.firstTry = new Map();
    state.errorGroupIds = new Set();
    state.kanaErrors = new Map();
    state.matchedGroups = new Set();
    state.selectedTileId = null;
    state.cascadeSession = null;
    state.levelModalOpen = false;
    state.levelStartElapsed = 0;
    state.levelStartScore = 0;
    state.levelStartAttempts = 0;
    state.levelStartAccurate = 0;

    state.useTimer = $('#timer-toggle').checked;
    state.timerDuration = Number($('#timer-duration').value) || 90;
    state.secondsLeft = state.useTimer ? state.timerDuration : 0;

    const isMole = mode === 'mogura';
    if (isMole) {
      state.useTimer = true;
      state.timerDuration = MoleEngine.MOLE_SECONDS;
      state.secondsLeft = MoleEngine.MOLE_SECONDS;
    }

    const scriptSuffix = mode === 'romaji' ? `（${LABELS[state.romajiScript]}）` : '';
    $('#game-title').textContent = info.title + scriptSuffix;
    $('#game-subtitle').textContent = isMole
      ? (state.molePlay === 'pair' ? '平片互认 · 找出对应的另一种假名' : '读音找字 · 地鼠举着假名，敲对就得分')
      : `${GROUP_LABELS[state.scope] || '自选范围'} · ${info.subtitle}`;

    $('#round-note').textContent = review
      ? '易错复习'
      : mode === 'cascade'
        ? `第 1 关 · 0 / ${CascadeEngine.CASCADE_PAIRS_PER_LEVEL} 对`
        : isMole ? '第 1 关 · 0 次命中' : '第 1 局';

    $('#tile-grid').classList.toggle('hidden', isMole);
    $('#mole-board').classList.toggle('hidden', !isMole);
    $('#play-area').classList.toggle('mole-mode', isMole);
    $('#play-area').classList.toggle('cascade-mode', mode === 'cascade');
    $('#stage-badge').classList.toggle('hidden', mode !== 'cascade');
    $('#pause-button').innerHTML = 'Ⅱ <span>暂停</span>';
    $('#progress-fill').style.height = '0%';
    $('#progress-fill').style.width = '100%';
    $('#pause-button').disabled = false;
    $('#celebration-burst').classList.add('hidden');

    setFeedback(
      isMole
        ? MOLE_HINTS[state.molePlay]
        : mode === 'cascade'
          ? `合成同音的平假名与片假名，${CascadeEngine.CASCADE_PAIRS_PER_LEVEL} 对进入下一关。`
          : '点选两个相同读音的字符，配对成功即可消除。'
    );

    if (isMole) {
      const pool = MoleEngine.getMolePool({
        rows: state.moleRows,
        scope: state.moleScope,
        play: state.molePlay,
        script: state.moleScript,
        level: 1
      });
      if (!pool.length) {
        toast('当前范围暂无可用假名，请至少选择一行或切换范围');
        return;
      }
      startMoleGame();
      showScreen('game');
      updateStats();
      setTimerUi();
      state.timerId = setInterval(tick, 1000);
      return;
    }

    if (mode === 'cascade') {
      const session = CascadeEngine.createCascadeSession(state.scope, review?.groupIds || null);
      if (!session) {
        toast('当前范围暂无可用假名');
        return;
      }
      state.cascadeSession = session;
      state.groupIds = session.groups.map((item) => item.id);
      state.tiles = PairEngine.buildPairTiles(session.groups, CascadeEngine.CASCADE_KINDS);
    } else {
      const round = PairEngine.createPairRound({
        mode,
        scope: state.scope,
        romajiScript: state.romajiScript,
        reviewGroupIds: review?.groupIds || null,
        maxPairs: 8
      });
      if (!round.chosen.length) {
        toast('当前范围暂无可用假名');
        return;
      }
      state.groupIds = round.groupIds;
      state.tiles = round.tiles;
    }

    renderPairTiles();
    showScreen('game');
    updateStats();
    setTimerUi();
    state.timerId = setInterval(tick, 1000);
  }

  function tick() {
    if (state.paused || state.finished || state.levelModalOpen || state.confirmCallback) return;
    state.elapsed += 1;
    if (state.useTimer) {
      state.secondsLeft = Math.max(0, state.secondsLeft - 1);
      setTimerUi();
      if (state.mode === 'mogura') {
        $('#mole-time').textContent = String(state.secondsLeft);
        $('#mole-time-meter').classList.toggle('urgent', state.secondsLeft <= 10);
      }
      if (state.secondsLeft <= 0) {
        finishGame('time');
        return;
      }
    }
    if (state.elapsed % 2 === 0) updateStats();
  }

  /* ==================== Pair & Cascade Rendering ==================== */
  function renderPairTiles() {
    const root = $('#tile-grid');
    root.replaceChildren();
    root.classList.toggle('triple-grid', state.mode === 'triple');
    for (const tile of state.tiles) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'kana-tile';
      button.dataset.tileId = tile.tileId;
      button.dataset.groupId = tile.groupId;
      button.dataset.kind = tile.kind;
      button.setAttribute('aria-label', `${LABELS[tile.kind]} ${tile.label}`);
      const label = document.createElement('span');
      label.className = 'tile-label';
      label.textContent = tile.label;
      button.append(label);
      if (state.mode === 'cascade') button.classList.add('cascade-tile');
      button.addEventListener('click', () => selectPairTile(tile));
      root.append(button);
    }
  }

  function showCelebration(message = '合成成功！') {
    const burst = $('#celebration-burst');
    $('#celebration-burst strong').textContent = message;
    burst.classList.remove('hidden', 'play');
    void burst.offsetWidth;
    burst.classList.add('play');
    clearTimeout(showCelebration.timeout);
    showCelebration.timeout = setTimeout(() => burst.classList.add('hidden'), 900);
  }

  function advanceCascade(matchedGroupId) {
    if (state.finished || !state.cascadeSession) return;
    const session = state.cascadeSession;
    const matched = session.groups.find((group) => group.id === matchedGroupId);
    session.groups = session.groups.filter((group) => group.id !== matchedGroupId);
    session.pairsInLevel += 1;

    if (session.pairsInLevel >= CascadeEngine.CASCADE_PAIRS_PER_LEVEL) {
      state.groupIds = session.groups.map((group) => group.id);
      updateStats();
      showLevelComplete();
      return;
    }

    const refilled = CascadeEngine.refillBoard(session, matched?.sourceId || null);
    state.groupIds = refilled.groupIds;
    state.tiles = refilled.tiles;
    state.selectedTileId = null;
    state.matchedGroups = new Set();
    renderPairTiles();
    state.lock = false;
    updateStats();
    setFeedback('新假名已补位，其他字符也重新排列了。', 'good');
  }

  function selectPairTile(tile) {
    if (state.paused || state.lock || state.finished || state.matchedGroups.has(tile.groupId)) return;
    const button = $(`[data-tile-id="${CSS.escape(tile.tileId)}"]`);
    if (!button || button.disabled) return;
    if (state.selectedTileId === tile.tileId) {
      button.classList.remove('selected');
      state.selectedTileId = null;
      return;
    }
    if (!state.selectedTileId) {
      state.selectedTileId = tile.tileId;
      button.classList.add('selected');
      return;
    }
    const first = state.tiles.find((item) => item.tileId === state.selectedTileId);
    const firstButton = $(`[data-tile-id="${CSS.escape(state.selectedTileId)}"]`);
    if (!first || !firstButton) { state.selectedTileId = null; return; }
    firstButton.classList.remove('selected');
    state.selectedTileId = null;
    state.lock = true;

    const isMatch = first.groupId === tile.groupId && first.kind !== tile.kind;
    if (isMatch) {
      if (!state.firstTry.has(first.groupId)) state.firstTry.set(first.groupId, true);
    } else {
      [first.groupId, tile.groupId].forEach((groupId) => {
        if (!state.firstTry.has(groupId) || state.firstTry.get(groupId) === true) state.firstTry.set(groupId, false);
      });
    }

    if (isMatch) {
      recordKanaAttempt(first.data, { correct: true });
      if (state.mode !== 'cascade') state.matchedGroups.add(tile.groupId);
      const groupButtons = $$(`[data-group-id="${CSS.escape(tile.groupId)}"]`);
      groupButtons.forEach((el) => { el.classList.add('matched'); el.disabled = true; });
      state.score += MODE_INFO[state.mode].points;
      playTone('good');
      showCelebration();
      const successMessage = state.mode === 'triple'
        ? '读音相同！同组的三种写法一起消除。'
        : state.mode === 'cascade' ? '合成成功！假名即将补位。' : '配对成功！继续找下一组。';
      setFeedback(successMessage, 'good');
      updateStats();
      if (state.mode === 'cascade') {
        setTimeout(() => advanceCascade(tile.groupId), 460);
      } else {
        state.lock = false;
        if (state.matchedGroups.size === state.groupIds.length) {
          setTimeout(() => finishGame('complete'), 420);
        }
      }
    } else {
      state.mistakes += 1;
      state.errorGroupIds.add(first.data.sourceId || first.data.id);
      state.errorGroupIds.add(tile.data.sourceId || tile.data.id);
      recordKanaAttempt(first.data, { correct: false, confusedLabel: tile.label });
      recordKanaAttempt(tile.data, { correct: false, confusedLabel: first.label });
      const secondButton = $(`[data-tile-id="${CSS.escape(tile.tileId)}"]`);
      firstButton.classList.add('mismatch');
      secondButton?.classList.add('mismatch');
      $('#play-area').classList.remove('error-flash');
      void $('#play-area').offsetWidth;
      $('#play-area').classList.add('error-flash');
      playTone('bad');
      setFeedback('配对不正确！这两个读音不同，再重新找一找。', 'bad');
      updateStats();
      state.mismatchTimer = setTimeout(() => {
        firstButton.classList.remove('mismatch');
        secondButton?.classList.remove('mismatch');
        $('#play-area').classList.remove('error-flash');
        state.lock = false;
        setFeedback(
          state.mode === 'cascade'
            ? `合成同音的平假名与片假名，${CascadeEngine.CASCADE_PAIRS_PER_LEVEL} 对进入下一关。`
            : '点选两个相同读音的字符，配对成功即可消除。'
        );
      }, 760);
    }
  }

  /* ==================== Whack-a-mole UI & Interaction ==================== */
  function buildMoleGrid() {
    const root = $('#mole-grid');
    root.replaceChildren();
    for (let i = 0; i < MoleEngine.MOLE_HOLES; i++) {
      const cell = document.createElement('div');
      cell.className = 'mole-hole';
      cell.dataset.hole = String(i);
      const body = document.createElement('button');
      body.type = 'button';
      body.className = 'mole-body';
      body.tabIndex = -1;
      body.setAttribute('aria-label', `洞口 ${i + 1}`);
      ['mole-eye l', 'mole-eye r', 'mole-nose', 'mole-cheek l', 'mole-cheek r'].forEach((cls) => {
        body.append(Object.assign(document.createElement('span'), { className: cls }));
      });
      body.append(Object.assign(document.createElement('span'), { className: 'mole-kana' }));
      // 使用 pointerdown 减少触屏与点击延迟
      body.addEventListener('pointerdown', (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        event.preventDefault();
        whackMole(cell);
      });
      const rim = document.createElement('span');
      rim.className = 'mole-hole-rim';
      cell.append(body, rim);
      root.append(cell);
    }
  }

  function clearMoleTimers() {
    if (!state.mole) return;
    clearTimeout(state.mole.roundTimer);
    state.mole.roundTimer = null;
    (state.mole.spawnTimers || []).forEach(clearTimeout);
    state.mole.spawnTimers = [];
  }

  function hideAllMoles() {
    $$('#mole-grid .mole-hole').forEach((cell) => {
      cell.classList.remove('up', 'hit', 'wrong');
      cell.removeAttribute('data-correct');
    });
  }

  function startMoleGame() {
    clearMoleTimers();
    state.mole = {
      target: null,
      hits: 0,
      wrong: 0,
      misses: 0,
      combo: 0,
      bestCombo: 0,
      level: 1,
      hitsInLevel: 0,
      roundTimer: null,
      spawnTimers: [],
      runningId: 0
    };
    $('#mole-level').textContent = '1';
    $('#mole-combo').textContent = '×1';
    $('#mole-time').textContent = String(MoleEngine.MOLE_SECONDS);
    $('#mole-time-meter').classList.remove('urgent');
    $('#mole-target-kana').textContent = '';
    buildMoleGrid();
    startMoleRound();
  }

  function startMoleRound() {
    if (!state.mole || state.paused || state.finished) return;
    clearMoleTimers();
    hideAllMoles();

    const pool = MoleEngine.getMolePool({
      rows: state.moleRows,
      scope: state.moleScope,
      play: state.molePlay,
      script: state.moleScript,
      level: state.mole.level
    });
    if (!pool.length) return;

    state.mole.runningId += 1;
    const runId = state.mole.runningId;
    const target = rand(pool);
    state.mole.target = target;
    MoleEngine.playKanaAudio(target.id);

    const pair = state.molePlay === 'pair';
    let answerScript = null;
    if (pair) {
      const dir = state.moleDir === 'mixed' ? (Math.random() < 0.5 ? 'h2k' : 'k2h') : state.moleDir;
      const promptScript = dir === 'h2k' ? 'hiragana' : 'katakana';
      answerScript = dir === 'h2k' ? 'katakana' : 'hiragana';
      $('#mole-target-romaji').textContent = target[promptScript];
      $('#mole-target-label').textContent = dir === 'h2k' ? '找出对应的片假名' : '找出对应的平假名';
    } else {
      $('#mole-target-romaji').textContent = target.romaji.toUpperCase();
      $('#mole-target-label').textContent = '看到的读音';
    }
    $('#mole-target-romaji').classList.toggle('kana-prompt', pair);
    $('#mole-target-kana').textContent = '';

    const timing = MoleEngine.calcMoleTiming(state.moleSpeed, state.mole.level);
    const decoys = shuffled(pool.filter((group) => group.id !== target.id))
      .slice(0, Math.min(pool.length - 1, timing.decoys));
    const lineup = shuffled([{ group: target, correct: true }, ...decoys.map((group) => ({ group, correct: false }))]);
    const cells = shuffled($$('#mole-grid .mole-hole')).slice(0, lineup.length);

    lineup.forEach((entry, index) => {
      const cell = cells[index];
      if (!cell) return;
      const script = pair
        ? answerScript
        : state.moleScript === 'hiragana'
          ? 'hiragana'
          : state.moleScript === 'katakana'
            ? 'katakana'
            : (Math.random() < 0.5 ? 'hiragana' : 'katakana');
      cell.querySelector('.mole-kana').textContent = entry.group[script];
      cell.dataset.correct = entry.correct ? '1' : '0';
      state.mole.spawnTimers.push(setTimeout(() => {
        if (runId !== state.mole.runningId) return;
        cell.classList.add('up');
      }, 60 + index * 150));
    });

    state.mole.roundTimer = setTimeout(() => {
      if (runId !== state.mole.runningId || state.paused || state.finished) return;
      state.mole.misses += 1;
      recordKanaAttempt(state.mole.target, { correct: false, miss: true });
      state.mole.combo = 0;
      setFeedback('地鼠缩回去了！下一个读音，抓紧一点。', 'bad');
      updateStats();
      state.mole.roundTimer = setTimeout(startMoleRound, 240);
    }, timing.life + decoys.length * 150 + 140);
  }

  function checkMoleLevelUp() {
    if (state.mole.hitsInLevel < MoleEngine.moleLevelNeed(state.mole.level) || state.mole.level >= 6) return;
    state.mole.level += 1;
    state.mole.hitsInLevel = 0;
    $('#mole-level').textContent = String(state.mole.level);
    showCelebration(`第 ${state.mole.level} 关 · 加速！`);
    playTone('complete');
    setFeedback(`进入第 ${state.mole.level} 关，地鼠躲得更快了！`, 'good');
  }

  function whackMole(cell) {
    if (!state.mole || state.paused || state.lock || state.finished) return;
    if (!cell.classList.contains('up') || cell.classList.contains('hit') || cell.classList.contains('wrong')) return;

    if (cell.dataset.correct === '1') {
      recordKanaAttempt(state.mole.target, { correct: true });
      state.mole.hits += 1;
      state.mole.hitsInLevel += 1;
      state.mole.combo += 1;
      state.mole.bestCombo = Math.max(state.mole.bestCombo, state.mole.combo);
      const points = 10 + Math.min(state.mole.combo - 1, 9) * 2 + (state.mole.level - 1) * 2;
      state.score += points;
      cell.classList.add('hit');
      showMoleGain(cell, `+${points}`, false);
      const target = state.mole.target;
      $('#mole-target-kana').textContent = target ? `${target.hiragana} / ${target.katakana} ✓` : '';
      playTone('good');
      checkMoleLevelUp();
      updateStats();
      state.lock = true;
      clearTimeout(state.mole.roundTimer);
      setTimeout(() => {
        state.lock = false;
        startMoleRound();
      }, 300);
    } else {
      // 点错扣 5 分，分数不低于 0；点错的洞口立即缩回，不能重复点
      state.mole.wrong += 1;
      state.score = Math.max(0, state.score - MoleEngine.WRONG_PENALTY);
      recordKanaAttempt(state.mole.target, {
        correct: false,
        confusedLabel: cell.querySelector('.mole-kana').textContent
      });
      state.mole.combo = 0;
      cell.classList.add('wrong');
      cell.classList.remove('up');
      cell.removeAttribute('data-correct');
      showMoleGain(cell, `-${MoleEngine.WRONG_PENALTY}`, true);
      playTone('bad');
      setFeedback(`敲错了，扣 ${MoleEngine.WRONG_PENALTY} 分！看清读音再下手。`, 'bad');
      updateStats();
      setTimeout(() => cell.classList.remove('wrong'), 340);
    }
  }



  function showMoleGain(cell, text, isPenalty) {
    const gain = document.createElement('span');
    gain.className = 'mole-gain' + (isPenalty ? ' penalty' : '');
    gain.textContent = text;
    cell.append(gain);
    setTimeout(() => gain.remove(), 640);
  }

  function pauseMoleRound() {
    clearMoleTimers();
    hideAllMoles();
  }

  function moleScopeDisplayLabel() {
    if (state.moleScope !== 'seion') {
      return GROUP_LABELS[state.moleScope] || state.moleScope;
    }
    if (state.moleRows.includes('all') || state.moleRows.length >= KANA_ROWS.length) return '清音·全部行';
    const rowNames = KANA_ROWS.filter((r) => state.moleRows.includes(r.id)).map((r) => r.label).join('+');
    return `清音·${rowNames}`;
  }

  function finishMoleGame(reason) {
    clearMoleTimers();
    hideAllMoles();
    const mole = state.mole || { hits: 0, wrong: 0, misses: 0, level: 1, bestCombo: 0 };
    const total = mole.hits + mole.wrong + mole.misses;
    const accuracy = total ? Math.round(mole.hits / total * 100) : 0;
    const usedSeconds = Math.max(0, MoleEngine.MOLE_SECONDS - state.secondsLeft);

    $('#final-score').textContent = String(state.score).padStart(3, '0');
    $('#final-completion-label').textContent = '命中次数';
    $('#final-completion').textContent = `${mole.hits} 次`;
    $('#final-accuracy-label').textContent = '命中率';
    $('#final-accuracy').textContent = `${accuracy}%`;
    $('#final-time').textContent = timeText(usedSeconds);
    $('#result-title').textContent = mole.hits >= 30 ? '地鼠猎手！' : mole.hits >= 15 ? '敲得很准！' : '时间到！';
    $('#review-hint').classList.add('hidden');

    const configKey = MoleEngine.buildMoleConfigKey({
      play: state.molePlay,
      dir: state.moleDir,
      script: state.moleScript,
      scope: state.moleScope,
      rows: state.moleRows,
      speed: state.moleSpeed
    });

    const entry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      key: configKey,
      score: state.score,
      level: mole.level,
      hits: mole.hits,
      accuracy,
      script: state.moleScript,
      play: state.molePlay,
      speed: state.moleSpeed,
      scope: state.moleScope,
      rows: state.moleRows.slice(),
      date: new Date().toISOString()
    };

    const ranking = KanaStorage.saveMoleRanking(entry);
    refreshMoleBest();
    const rank = ranking.findIndex((item) => item.id === entry.id);
    const rankText = rank >= 0 ? `本机排名第 ${rank + 1}。` : '';
    $('#result-description').textContent = `60 秒内命中 ${mole.hits} 次，最高连击 ×${mole.bestCombo}，最高打到第 ${mole.level} 关。${rankText}`;
    $('#mole-ranking').classList.remove('hidden');
    renderMoleRanking(ranking, entry.id);
    KanaRecorder.finishRun({
      score: state.score,
      hits: mole.hits,
      accuracy,
      durationMs: usedSeconds * 1000,
      level: mole.level
    }).then((savedRun) => {
      renderKanaErrors(savedRun.perKana);
    });
    if (reason && reason !== 'time') playTone('complete');
    showScreen('result');
  }

  function renderMoleRanking(list, currentId) {
    const kindText = state.molePlay === 'pair'
      ? `平片互认 ${MOLE_DIR_LABELS[state.moleDir] || ''}`
      : `读音找字 ${MOLE_SCRIPT_LABELS[state.moleScript] || '混合'}`;
    const speedText = (MoleEngine.MOLE_SPEEDS[state.moleSpeed] || MoleEngine.MOLE_SPEEDS.mid).label;
    $('#ranking-scope').textContent = `${kindText} · ${moleScopeDisplayLabel()} · ${speedText}速 · ${MoleEngine.MOLE_SECONDS} 秒`;
    const root = $('#ranking-list');
    root.replaceChildren();
    const top = list.slice(0, 8);
    if (!top.length) {
      const empty = document.createElement('li');
      empty.className = 'ranking-item empty';
      empty.textContent = '还没有记录，玩一局就能上榜。';
      root.append(empty);
      return;
    }
    top.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'ranking-item' + (index < 3 ? ' top' : '') + (item.id === currentId ? ' current' : '');
      const rank = document.createElement('span');
      rank.className = 'rank-no';
      rank.textContent = String(index + 1);
      const meta = document.createElement('span');
      meta.className = 'rank-meta';
      meta.textContent = `第 ${item.level} 关 · 命中 ${item.hits} · 正确率 ${item.accuracy}%`;
      const score = document.createElement('strong');
      score.textContent = String(item.score);
      const date = document.createElement('span');
      date.className = 'rank-date';
      const d = item.date ? new Date(item.date) : null;
      date.textContent = d && !Number.isNaN(d.getTime())
        ? `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        : '';
      li.append(rank, meta, score, date);
      root.append(li);
    });
  }

  function refreshMoleBest() {
    const best = KanaStorage.loadMoleRanking().reduce((max, item) => Math.max(max, item.score || 0), 0);
    $('#mole-best').innerHTML = `本机最高分 <b>${best}</b>`;
  }

  /* ==================== Result & Error List Rendering ==================== */
  function renderKanaErrors(perKanaObj) {
    const box = $('#mole-errors');
    if (!box) return;
    box.classList.remove('hidden');
    const list = $('#mole-error-list');
    list.replaceChildren();
    const kanaLookup = new Map((window.KANA_DATA || []).map((k) => [k.id, k]));
    const rows = Object.entries(perKanaObj || {})
      .map(([kanaId, stat]) => {
        const item = kanaLookup.get(kanaId) || { id: kanaId, hiragana: '', katakana: kanaId, romaji: '' };
        const wrong = Number(stat.wrong || 0);
        const miss = Number(stat.miss || 0);
        return {
          item,
          wrong,
          miss,
          confused: stat.confused || {},
          total: wrong + miss
        };
      })
      .filter((rec) => rec.total > 0)
      .sort((a, b) => b.total - a.total || b.wrong - a.wrong || a.item.romaji.localeCompare(b.item.romaji));
    $('#mole-errors-note').textContent = rows.length ? `共 ${rows.length} 个假名出错 · 错得最多的排第一` : '本局没有出错';
    if (!rows.length) {
      const empty = document.createElement('li');
      empty.className = 'error-item empty';
      empty.textContent = '太棒了，本局没有错误的假名！';
      list.append(empty);
      return;
    }
    const max = rows[0].total;
    rows.slice(0, 10).forEach((rec, index) => {
      const li = document.createElement('li');
      li.className = 'error-item' + (index < 3 ? ' top' : '');
      const rank = document.createElement('span');
      rank.className = 'rank-no';
      rank.textContent = String(index + 1);
      const kana = document.createElement('span');
      kana.className = 'error-kana';
      kana.textContent = `${rec.item.hiragana || ''}${rec.item.katakana || ''}`;
      const info = document.createElement('span');
      info.className = 'error-info';
      const name = document.createElement('b');
      name.textContent = (rec.item.romaji || '').toUpperCase();
      const confusedTop = Object.entries(rec.confused || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([text, count]) => (count > 1 ? `${text}×${count}` : text))
        .join('、');
      const parts = [];
      if (rec.wrong) parts.push(`错误 ${rec.wrong} 次`);
      if (rec.miss) parts.push(`超时 ${rec.miss} 次`);
      const detail = document.createElement('small');
      detail.textContent = parts.join(' · ') + (confusedTop ? ` · 混淆：${confusedTop}` : '');
      info.append(name, detail);
      const bar = document.createElement('span');
      bar.className = 'error-bar';
      const fill = document.createElement('i');
      fill.style.width = `${Math.max(8, Math.round(rec.total / max * 100))}%`;
      bar.append(fill);
      const count = document.createElement('strong');
      count.textContent = `${rec.total} 次`;
      li.append(rank, kana, info, bar, count);
      list.append(li);
    });
    if (rows.length > 10) {
      const more = document.createElement('li');
      more.className = 'error-item empty';
      more.textContent = `另有 ${rows.length - 10} 个假名出错次数较少`;
      list.append(more);
    }
  }

  /* ==================== Cascade Level Modal ==================== */
  const LEVEL_PRAISE = ['漂亮通关！', '这一关稳住了！', '手感越来越好了！', '节奏掌握得很棒！', '继续，别停下来！'];
  const LEVEL_ENCOURAGE = [
    '下一关棋盘会增加对数（不超过可用假名总数），注意别混淆。',
    '难度再升一点，保持这个正确率。',
    '新的一关，先看清字形再下判断。',
    '已经很熟练了，试着一次就配对成功。',
    '每过一关，假名记得就更牢一点。'
  ];

  function showLevelComplete() {
    const session = state.cascadeSession;
    state.levelModalOpen = true;
    state.paused = true;
    const levelSeconds = Math.max(0, state.elapsed - state.levelStartElapsed);
    const levelScore = Math.max(0, state.score - state.levelStartScore);
    const attempts = state.firstTry.size - state.levelStartAttempts;
    const accurate = Array.from(state.firstTry.values()).filter(Boolean).length - state.levelStartAccurate;
    const accuracy = attempts > 0 ? Math.round(accurate / attempts * 100) : 100;
    const index = (session.level - 1) % LEVEL_PRAISE.length;

    $('#level-modal-badge').textContent = `第 ${session.level} 关 · 完成`;
    $('#level-modal-title').textContent = LEVEL_PRAISE[index];
    $('#level-modal-message').textContent = LEVEL_ENCOURAGE[index];
    $('#level-modal-score').textContent = String(levelScore);
    $('#level-modal-time').textContent = timeText(levelSeconds);
    $('#level-modal-accuracy').textContent = `${accuracy}%`;
    $('#level-next-label').textContent = `进入第 ${session.level + 1} 关`;
    $('#level-modal').classList.remove('hidden');
    playTone('complete');
  }

  function beginNextLevel() {
    const session = state.cascadeSession;
    if (!session) return;
    $('#level-modal').classList.add('hidden');
    state.levelModalOpen = false;
    state.paused = false;
    state.levelStartElapsed = state.elapsed;
    state.levelStartScore = state.score;
    state.levelStartAttempts = state.firstTry.size;
    state.levelStartAccurate = Array.from(state.firstTry.values()).filter(Boolean).length;

    const nextBoard = CascadeEngine.advanceLevel(session);
    state.groupIds = nextBoard.groupIds;
    state.tiles = nextBoard.tiles;
    state.selectedTileId = null;
    state.matchedGroups = new Set();
    renderPairTiles();
    state.lock = false;
    setFeedback(`第 ${session.level} 关开始！当前棋盘 ${session.targetPairs} 对，加油。`, 'good');
    updateStats();
  }

  function updateStats() {
    $('#score-value').textContent = String(state.score).padStart(3, '0');
    if (state.mode === 'mogura') {
      const mole = state.mole || { hits: 0, wrong: 0, misses: 0, combo: 0, level: 1, hitsInLevel: 0 };
      const total = mole.hits + mole.wrong + mole.misses;
      $('#accuracy-value').textContent = `${total ? Math.round(mole.hits / total * 100) : 100}%`;
      $('#mistake-count').textContent = `${mole.wrong} 次敲错`;
      $('#mole-time').textContent = String(Math.max(0, state.secondsLeft));
      $('#mole-combo').textContent = `×${Math.max(1, mole.combo)}`;
      $('#mole-level').textContent = String(mole.level);
      $('#progress-fill').style.height = `${Math.min(100, mole.hitsInLevel / MoleEngine.moleLevelNeed(mole.level) * 100)}%`;
      $('#round-note').textContent = `第 ${mole.level} 关 · ${mole.hits} 次命中`;
      return;
    }

    $('#mistake-count').textContent = `${state.mistakes} 次失误`;
    const attempts = state.firstTry.size;
    const accurate = Array.from(state.firstTry.values()).filter(Boolean).length;
    $('#accuracy-value').textContent = `${attempts ? Math.round(accurate / attempts * 100) : 100}%`;

    let progress = 0;
    if (state.mode === 'cascade' && state.cascadeSession) {
      const session = state.cascadeSession;
      progress = session.pairsInLevel / CascadeEngine.CASCADE_PAIRS_PER_LEVEL * 100;
      $('#side-progress-kicker').textContent = '闯关进度';
      $('#progress-label').textContent = `${session.pairsInLevel} / ${CascadeEngine.CASCADE_PAIRS_PER_LEVEL}`;
      $('#side-progress-detail').textContent = '本关已合成配对';
      $('#stage-badge').textContent = `第 ${session.level} 关`;
      $('#round-note').textContent = `第 ${session.level} 关 · ${session.pairsInLevel} / ${CascadeEngine.CASCADE_PAIRS_PER_LEVEL} 对`;
    } else {
      const total = state.groupIds.length;
      const done = state.matchedGroups.size;
      progress = total ? done / total * 100 : 0;
      $('#side-progress-kicker').textContent = '配对进度';
      $('#progress-label').textContent = `${done} / ${total}`;
      $('#side-progress-detail').textContent = '完成配对';
    }
    $('#progress-fill').style.height = `${progress}%`;
  }

  function finishGame(reason) {
    if (state.finished) return;
    state.finished = true;
    state.lock = true;
    clearInterval(state.timerId);
    clearTimeout(state.mismatchTimer);
    if (state.mode === 'mogura') return finishMoleGame(reason);

    $('#pause-modal').classList.add('hidden');
    $('#level-modal').classList.add('hidden');
    closeConfirmModal();
    state.levelModalOpen = false;
    $('#mole-ranking').classList.add('hidden');
    $('#final-completion-label').textContent = '完成进度';
    $('#final-accuracy-label').textContent = '首次尝试正确率';

    const session = state.cascadeSession;
    const total = state.mode === 'cascade' ? CascadeEngine.CASCADE_PAIRS_PER_LEVEL : state.groupIds.length;
    const completed = state.mode === 'cascade' && session ? session.pairsInLevel : state.matchedGroups.size;
    const accuracyAttempts = state.firstTry.size;
    const accuracy = accuracyAttempts
      ? Math.round(Array.from(state.firstTry.values()).filter(Boolean).length / accuracyAttempts * 100)
      : 0;
    const usedSeconds = state.useTimer ? Math.max(0, state.timerDuration - state.secondsLeft) : state.elapsed;

    $('#final-score').textContent = String(state.score).padStart(3, '0');
    $('#final-completion').textContent = state.mode === 'cascade' && session
      ? `第 ${session.level} 关 · ${completed} / ${CascadeEngine.CASCADE_PAIRS_PER_LEVEL} 对`
      : `${completed} / ${total}`;
    $('#final-accuracy').textContent = `${accuracy}%`;
    $('#final-time').textContent = timeText(usedSeconds);
    $('#result-title').textContent = reason === 'time' ? '时间到！' : completed === total ? '挑战完成！' : '这一轮先到这里。';
    $('#result-description').textContent = reason === 'time'
      ? '时间结束了，看看本局的练习成果。'
      : completed === total ? '配得漂亮！把这份手感带到下一轮。' : '每一次尝试都在加深记忆，再来一局会更熟悉。';

    const hasErrors = state.errorGroupIds.size > 0;
    $('#review-hint').classList.toggle('hidden', !hasErrors);
    if (hasErrors) {
      $('#review-description').textContent = `${state.errorGroupIds.size} 项出现过错误，复习一遍会记得更牢。`;
      $('#review-button').textContent = '复习易错 →';
    }
    const totalHits = state.mode === 'cascade' && session
      ? (session.level - 1) * CascadeEngine.CASCADE_PAIRS_PER_LEVEL + session.pairsInLevel
      : state.matchedGroups.size;
    KanaRecorder.finishRun({
      score: state.score,
      hits: totalHits,
      accuracy,
      durationMs: usedSeconds * 1000,
      level: state.mode === 'cascade' && session ? session.level : 1
    }).then((savedRun) => {
      renderKanaErrors(savedRun.perKana);
    });
    if (reason === 'complete') playTone('complete');
    state.lastResultMode = state.mode;
    showScreen('result');
  }

  function goHome(force = false) {
    if (!force && !state.finished && state.score > 0) {
      openConfirmModal({
        title: '返回首页？',
        message: '本局进度还没有完成，确定返回首页吗？',
        confirmLabel: '确定返回',
        onConfirm: () => goHome(true)
      });
      return;
    }
    clearInterval(state.timerId);
    clearTimeout(state.mismatchTimer);
    if (state.mode === 'mogura') {
      clearMoleTimers();
      hideAllMoles();
      state.mole = null;
    }
    $('#pause-modal').classList.add('hidden');
    $('#level-modal').classList.add('hidden');
    closeConfirmModal();
    state.levelModalOpen = false;
    state.paused = false;
    showScreen('home');
  }

  function togglePause() {
    if (state.finished || state.levelModalOpen || state.confirmCallback) return;
    state.paused = !state.paused;
    $('#pause-modal').classList.toggle('hidden', !state.paused);
    $('#pause-button').innerHTML = state.paused ? '▶ <span>继续</span>' : 'Ⅱ <span>暂停</span>';
    if (state.mode === 'mogura') {
      if (state.paused) pauseMoleRound();
      else startMoleRound();
    }
    if (state.paused) setFeedback('游戏已暂停。');
    else setFeedback(state.mode === 'mogura' ? MOLE_HINTS[state.molePlay] : '点选两个相同读音的字符，配对成功即可消除。');
  }

  function startReview() {
    const mode = state.lastResultMode === 'cascade' ? 'kana-kata' : state.lastResultMode;
    if (state.errorGroupIds.size) startGame(mode, { groupIds: Array.from(state.errorGroupIds) });
  }

  /* ==================== Home Controls & Keyboard Bindings ==================== */
  $$('#mode-grid .mode-card').forEach((button) => button.addEventListener('click', () => {
    state.selectedMode = button.dataset.mode;
    updateModeUI();
  }));

  $$('#scope-row .scope-chip').forEach((button) => button.addEventListener('click', () => {
    state.scope = button.dataset.scope;
    $$('#scope-row .scope-chip').forEach((chip) => {
      const active = chip === button;
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-pressed', String(active));
    });
  }));

  $$('.romaji-script-btn').forEach((button) => button.addEventListener('click', () => {
    state.romajiScript = button.dataset.rscript;
    $$('.romaji-script-btn').forEach((chip) => {
      const active = chip === button;
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-pressed', String(active));
    });
  }));

  function syncMoleChips() {
    const isSeion = state.moleScope === 'seion';
    const isAllRows = state.moleRows.includes('all');

    $$('.mole-scope-chip').forEach((chip) => {
      const active = chip.dataset.mscope === state.moleScope;
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-pressed', String(active));
    });

    $('#mole-rows-wrap').classList.toggle('hidden', !isSeion);
    $$('.row-chip').forEach((chip) => {
      const row = chip.dataset.row;
      const active = row === 'all' ? isAllRows : !isAllRows && state.moleRows.includes(row);
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-pressed', String(active));
    });

    $$('.mole-script').forEach((chip) => {
      const active = chip.dataset.script === state.moleScript;
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-pressed', String(active));
    });

    MOLE_OPTION_GROUPS.forEach(([selector, key, prop]) => {
      $$(selector).forEach((chip) => {
        const active = chip.dataset[key] === state[prop];
        chip.classList.toggle('active', active);
        chip.setAttribute('aria-pressed', String(active));
      });
    });

    $('#mole-dir-opt').classList.toggle('hidden', state.moleScript !== 'pair');
  }

  $$('.mole-scope-chip').forEach((button) => button.addEventListener('click', () => {
    state.moleScope = button.dataset.mscope;
    if (state.moleScope === 'seion' && !state.moleRows.length) {
      state.moleRows = ['a', 'ka'];
    }
    syncMoleChips();
  }));

  $$('.row-chip').forEach((button) => button.addEventListener('click', () => {
    const row = button.dataset.row;
    if (row === 'all') {
      state.moleRows = ['all'];
    } else {
      const base = state.moleRows.includes('all') ? [] : state.moleRows.slice();
      const index = base.indexOf(row);
      if (index >= 0) base.splice(index, 1);
      else base.push(row);
      state.moleRows = base;
    }
    syncMoleChips();
  }));

  $$('.mole-script').forEach((button) => button.addEventListener('click', () => {
    state.moleScript = button.dataset.script;
    state.molePlay = state.moleScript === 'pair' ? 'pair' : 'sound';
    syncMoleChips();
  }));

  MOLE_OPTION_GROUPS.forEach(([selector, key, prop]) => $$(selector).forEach((button) => button.addEventListener('click', () => {
    state[prop] = button.dataset[key];
    syncMoleChips();
  })));

  $('#timer-toggle').addEventListener('change', (event) => $('#timer-select-wrap').classList.toggle('hidden', !event.target.checked));
  $('#sound-toggle').addEventListener('change', (event) => setSound(event.target.checked));
  $('#start-button').addEventListener('click', () => startGame());
  $('#header-sound').addEventListener('click', () => setSound(!state.sound));
  $('#fullscreen-button').addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', syncFullscreenButton);

  ['pointerdown', 'touchstart', 'keydown'].forEach((type) => {
    document.addEventListener(type, () => audio.unlock(), { capture: true, passive: true });
  });

  $('#game-sound').addEventListener('click', () => setSound(!state.sound));
  $('#game-home').addEventListener('click', () => goHome());
  $('#brand-home').addEventListener('click', (event) => {
    event.preventDefault();
    if (screens.game.classList.contains('active')) goHome();
    else showScreen('home');
  });

  $('#restart-button').addEventListener('click', () => {
    openConfirmModal({
      title: '重新开始本局？',
      message: '当前进度与得分将会清零，确定重开吗？',
      confirmLabel: '重新开始',
      onConfirm: () => startGame(state.mode)
    });
  });

  $('#confirm-ok-button').addEventListener('click', () => {
    const cb = state.confirmCallback;
    closeConfirmModal();
    if (typeof cb === 'function') cb();
  });
  $('#confirm-cancel-button').addEventListener('click', closeConfirmModal);

  $('#pause-button').addEventListener('click', togglePause);
  $('#level-next-button').addEventListener('click', beginNextLevel);
  $('#level-replay-button').addEventListener('click', () => startGame('cascade'));
  $('#level-exit-button').addEventListener('click', () => goHome(true));
  $('#resume-button').addEventListener('click', togglePause);
  $('#paused-exit-button').addEventListener('click', () => goHome(true));
  $('#result-home').addEventListener('click', () => goHome(true));
  $('#result-home-secondary').addEventListener('click', () => goHome(true));
  $('#play-again-button').addEventListener('click', () => startGame(state.lastResultMode));
  $('#review-button').addEventListener('click', startReview);

  document.addEventListener('keydown', (event) => {
    if (!screens.game.classList.contains('active')) return;
    if (event.key === 'Escape') {
      if (state.confirmCallback) closeConfirmModal();
      else togglePause();
      return;
    }
    if (state.mode === 'mogura' && !state.paused && !state.lock && !state.finished && !state.confirmCallback) {
      const holeIdx = MoleEngine.NUMPAD_TO_HOLE_INDEX[event.code] ?? MoleEngine.NUMPAD_TO_HOLE_INDEX[event.key];
      if (holeIdx !== undefined) {
        event.preventDefault();
        const cell = $(`#mole-grid .mole-hole[data-hole="${holeIdx}"]`);
        if (cell) whackMole(cell);
      }
    }
  });


  /* ==================== Tangogo Main Site Auth & Theme Sync ==================== */
  const sbClient = KanaRecorder.getSbClient();
  let currentUser = null;

  function updateAuthUI() {
    const avatarEl = $('#tgo-avatar-glyph');
    const nameEl = $('#tgo-user-name');
    const unauthView = $('#tgo-unauth-view');
    const authedView = $('#tgo-authed-view');
    const titleEl = $('#tgo-auth-title');

    if (currentUser) {
      const savedAv = localStorage.getItem('tangogo_avatar') || '桜';
      const savedNick = localStorage.getItem('tangogo_nickname') || currentUser.email.split('@')[0];
      avatarEl.textContent = savedAv;
      nameEl.textContent = savedNick;
      titleEl.textContent = '账号与云端同步';
      $('#tgo-authed-email').textContent = currentUser.email;
      const pendingCnt = KanaRecorder.getPendingCount();
      $('#tgo-sync-status-text').textContent = pendingCnt > 0
        ? `当前有 ${pendingCnt} 条离线记录待上传`
        : '所有五十音练习记录已与云端同步';
      unauthView.classList.add('hidden');
      authedView.classList.remove('hidden');
    } else {
      avatarEl.textContent = '桜';
      nameEl.textContent = '登录 / 注册';
      titleEl.textContent = '登录 / 注册';
      unauthView.classList.remove('hidden');
      authedView.classList.add('hidden');
    }
  }

  $('#theme-toggle-btn').addEventListener('click', () => {
    const root = document.documentElement;
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('kana-theme', next); } catch (_) {}
  });

  $('#tgo-user-btn').addEventListener('click', () => {
    updateAuthUI();
    $('#tgo-auth-modal').classList.remove('hidden');
  });

  $('#tgo-auth-close-btn').addEventListener('click', () => {
    $('#tgo-auth-modal').classList.add('hidden');
  });

  let kanaResendTimer = null;
  function showKanaAuthNotice(msg, { isError = false, showResend = false } = {}) {
    const box = $('#tgo-auth-feedback');
    const txt = $('#tgo-auth-feedback-text');
    const btn = $('#tgo-resend-btn');
    box.classList.remove('hidden');
    box.style.borderColor = isError ? 'rgba(239, 68, 68, 0.45)' : 'var(--line)';
    box.style.color = isError ? '#dc2626' : 'var(--ink)';
    txt.textContent = msg;
    btn.classList.toggle('hidden', !showResend);
  }

  function startKanaResendCooldown(sec = 60) {
    const btn = $('#tgo-resend-btn');
    clearInterval(kanaResendTimer);
    let left = sec;
    btn.disabled = true;
    btn.textContent = `重新发送验证邮件 (${left}s)`;
    kanaResendTimer = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(kanaResendTimer);
        btn.disabled = false;
        btn.textContent = '重新发送验证邮件';
      } else {
        btn.textContent = `重新发送验证邮件 (${left}s)`;
      }
    }, 1000);
  }

  $('#tgo-signin-btn').addEventListener('click', async () => {
    const email = $('#tgo-email-input').value.trim();
    const password = $('#tgo-pwd-input').value;
    if (!email || !password) return toast('请填写邮箱和密码');
    if (!sbClient) return toast('数据库连接未就绪');
    const { data, error } = await sbClient.auth.signInWithPassword({ email, password });
    if (error) {
      const msg = error.message.includes('Email not confirmed')
        ? '该邮箱尚未验证，请查收验证邮件或点击下方重新发送。'
        : '登录失败: ' + error.message;
      showKanaAuthNotice(msg, { isError: true, showResend: error.message.includes('Email not confirmed') });
      return toast(msg);
    }
    currentUser = data.user;
    await KanaRecorder.syncAllLocalRunsOnLogin();
    updateAuthUI();
    $('#tgo-auth-modal').classList.add('hidden');
    toast('登录成功，五十音记录已同步至云端');
  });

  $('#tgo-signup-btn').addEventListener('click', async () => {
    const email = $('#tgo-email-input').value.trim();
    const password = $('#tgo-pwd-input').value;
    if (!email || !password) return toast('请填写邮箱和密码');
    if (password.length < 6) return toast('密码不少于 6 位');
    if (!sbClient) return toast('数据库连接未就绪');
    const { data, error } = await sbClient.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + '/' }
    });
    if (error) {
      showKanaAuthNotice('注册失败: ' + error.message, { isError: true });
      return toast('注册失败: ' + error.message);
    }
    if (data && data.session && data.user) {
      currentUser = data.user;
      await KanaRecorder.syncAllLocalRunsOnLogin();
      updateAuthUI();
      $('#tgo-auth-modal').classList.add('hidden');
      toast('注册成功！');
    } else {
      showKanaAuthNotice(`验证邮件已发送到 ${email}，请查收（也请看看垃圾邮件箱）。`, { showResend: true });
      startKanaResendCooldown(60);
    }
  });

  $('#tgo-resend-btn').addEventListener('click', async () => {
    const email = $('#tgo-email-input').value.trim();
    if (!email) return toast('请先输入注册邮箱');
    const { error } = await sbClient.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: window.location.origin + '/' }
    });
    if (error) {
      showKanaAuthNotice('重发失败: ' + error.message, { isError: true, showResend: true });
      return;
    }
    showKanaAuthNotice(`验证邮件已重新发送到 ${email}，请查收（也请看看垃圾邮件箱）。`, { showResend: true });
    startKanaResendCooldown(60);
  });

  $('#tgo-forgot-btn').addEventListener('click', async () => {
    const email = $('#tgo-email-input').value.trim();
    if (!email) {
      showKanaAuthNotice('请先在上方输入注册邮箱，再点击“忘记密码”。', { isError: true });
      return;
    }
    const { error } = await sbClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password/'
    });
    if (error) {
      showKanaAuthNotice('发送重置邮件失败: ' + error.message, { isError: true });
      return;
    }
    showKanaAuthNotice(`密码重置邮件已发送到 ${email}，请查收邮件设置新密码。`);
  });

  $('#tgo-sync-now-btn').addEventListener('click', async () => {
    await KanaRecorder.syncAllLocalRunsOnLogin();
    updateAuthUI();
    toast('云端同步完成');
  });

  $('#tgo-signout-btn').addEventListener('click', async () => {
    if (sbClient) await sbClient.auth.signOut();
    currentUser = null;
    updateAuthUI();
    $('#tgo-auth-modal').classList.add('hidden');
    toast('已退出登录');
  });

  (async function initAuthSync() {
    if (!sbClient) return;
    const { data: { session } } = await sbClient.auth.getSession();
    if (session && session.user) {
      currentUser = session.user;
      updateAuthUI();
      await KanaRecorder.syncAllLocalRunsOnLogin();
      updateAuthUI();
    } else {
      updateAuthUI();
    }
    sbClient.auth.onAuthStateChange(async (_event, newSession) => {
      currentUser = newSession ? newSession.user : null;
      updateAuthUI();
      if (currentUser) {
        await KanaRecorder.syncAllLocalRunsOnLogin();
        updateAuthUI();
      }
    });
  })();

  setSound(true);
  syncMoleChips();
  refreshMoleBest();
  updateModeUI();
})();
