/**
 * Tangogo FSRS 间隔重复与云端/本地同步引擎
 * 1. 动态加载官方 ts-fsrs 库（ESM via jsDelivr / esm.sh）
 * 2. 支持未登录 localStorage 存储，登录后按 last_review 较新一方自动双向合并迁移
 * 3. 凌晨 4:00 作为"一天"的逻辑分界线
 */
(function (global) {
  const SUPABASE_URL = 'https://zbfjbtzvnhmfzyvooact.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_AP0YnQLgzmB3d63_4zbpjg_vHeTyo8Z';

  const STORAGE_KEYS = {
    CARDS: 'tangogo_fsrs_cards_v1',
    LOGS: 'tangogo_fsrs_logs_v1',
    SETTINGS: 'tangogo_fsrs_settings_v1',
    LEGACY_MISTAKES: 'tangogo_mistakes'
  };

  const DEFAULT_SETTINGS = {
    daily_new_limit: 20,
    daily_review_limit: 200,
    request_retention: 0.90
  };

  let tsFsrsModule = null;

  async function loadTsFsrs() {
    if (tsFsrsModule) return tsFsrsModule;
    const urls = [
      '/vendor/ts-fsrs-4.5.1.js?v=4.5.1',
      'https://cdn.jsdelivr.net/npm/ts-fsrs@4.5.1/+esm',
      'https://esm.sh/ts-fsrs@4.5.1'
    ];
    for (const url of urls) {
      try {
        tsFsrsModule = await import(url);
        if (tsFsrsModule && tsFsrsModule.fsrs) return tsFsrsModule;
      } catch (e) {
        console.warn('ts-fsrs CDN fallback:', url, e);
      }
    }
    throw new Error('无法加载 ts-fsrs 算法库，请检查网络连接');
  }

  function getSbClient() {
    if (global.__tangogoSbClient) return global.__tangogoSbClient;
    if (global.supabase && global.supabase.createClient) {
      global.__tangogoSbClient = global.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      return global.__tangogoSbClient;
    }
    return null;
  }

  /**
   * 获取当前"学习日"的起始时间戳（本地时间凌晨 4:00 分界）
   */
  function getStudyDayBounds(now = new Date()) {
    const start = new Date(now);
    if (start.getHours() < 4) {
      start.setDate(start.getDate() - 1);
    }
    start.setHours(4, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  function getSettings() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
      return {
        daily_new_limit: Math.max(1, parseInt(raw.daily_new_limit ?? DEFAULT_SETTINGS.daily_new_limit, 10)),
        daily_review_limit: Math.max(1, parseInt(raw.daily_review_limit ?? DEFAULT_SETTINGS.daily_review_limit, 10)),
        request_retention: Math.min(0.99, Math.max(0.70, parseFloat(raw.request_retention ?? DEFAULT_SETTINGS.request_retention)))
      };
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  async function saveSettings(newSettings, user) {
    const merged = { ...getSettings(), ...newSettings };
    merged.daily_new_limit = Math.max(1, Math.min(500, parseInt(merged.daily_new_limit, 10) || 20));
    merged.daily_review_limit = Math.max(1, Math.min(2000, parseInt(merged.daily_review_limit, 10) || 200));
    merged.request_retention = Math.min(0.99, Math.max(0.70, Number(merged.request_retention) || 0.90));
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));

    const sb = getSbClient();
    if (user && sb) {
      await sb.from('profiles').upsert({
        id: user.id,
        daily_new_limit: merged.daily_new_limit,
        daily_review_limit: merged.daily_review_limit,
        request_retention: merged.request_retention,
        updated_at: new Date().toISOString()
      });
    }
    return merged;
  }

  function getLocalCardsMap() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.CARDS) || '{}');
    } catch (e) {
      return {};
    }
  }

  function setLocalCardsMap(map) {
    localStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(map));
  }

  function getLocalLogs() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.LOGS) || '[]');
    } catch (e) {
      return [];
    }
  }

  function appendLocalLog(logItem) {
    const logs = getLocalLogs();
    logs.push(logItem);
    // 保留最近 5000 条本地日志防溢出
    if (logs.length > 5000) logs.splice(0, logs.length - 5000);
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
  }

  /**
   * 构造统一 word_id（优先使用数据库主键 id，无 id 时按 kana|kanji 稳定生成）
   */
  function resolveWordId(w) {
    if (!w) return '';
    if (w.word_id) return String(w.word_id);
    if (w.id && typeof w.id === 'string' && w.id.length > 8) return String(w.id);
    const kana = (w.kana || w.word || '').trim();
    const kanji = (w.kanji || '').trim();
    return kanji ? `${kana}__${kanji}` : kana;
  }

  /**
   * 将数据库或本地行转换为 ts-fsrs Card 对象
   */
  function toFsrsCard(row, lib, now = new Date()) {
    if (!row || !row.last_review && (!row.reps || row.reps === 0) && (!row.stability || row.stability === 0)) {
      const empty = lib.createEmptyCard(now);
      if (row && row.due) empty.due = new Date(row.due);
      return empty;
    }
    return {
      due: row.due ? new Date(row.due) : now,
      stability: Number(row.stability || 0),
      difficulty: Number(row.difficulty || 0),
      elapsed_days: Number(row.elapsed_days || 0),
      scheduled_days: Number(row.scheduled_days || 0),
      reps: Number(row.reps || 0),
      lapses: Number(row.lapses || 0),
      state: Number(row.state ?? 0),
      last_review: row.last_review ? new Date(row.last_review) : undefined
    };
  }

  /**
   * 兼容旧版 tangogo_mistakes 数据，自动升级为 card_states 中的错词记录
   */
  function migrateLegacyMistakesIfNeeded() {
    const legacyRaw = localStorage.getItem(STORAGE_KEYS.LEGACY_MISTAKES);
    if (!legacyRaw) return;
    try {
      const arr = JSON.parse(legacyRaw);
      if (!Array.isArray(arr) || arr.length === 0) return;
      const map = getLocalCardsMap();
      const nowIso = new Date().toISOString();
      let changed = false;
      arr.forEach(item => {
        const kana = typeof item === 'string' ? item : (item.kana || item.word || '');
        const kanji = typeof item === 'string' ? '' : (item.kanji || '');
        const meaning = typeof item === 'string' ? '' : (item.meaning || item.trans || '');
        const wid = resolveWordId({ id: item.word_id || item.id, kana, kanji });
        if (!wid) return;
        if (!map[wid]) {
          map[wid] = {
            word_id: wid,
            due: nowIso,
            stability: 0,
            difficulty: 0,
            elapsed_days: 0,
            scheduled_days: 0,
            reps: 0,
            lapses: 1,
            state: 0,
            last_review: null,
            manual_mistake: true,
            kanji,
            kana,
            pitch: item.pitch || '',
            pos: item.pos || '',
            meaning,
            book_id: item.book_id || '',
            grade_id: item.grade_id || '',
            lesson_id: item.lesson_id || ''
          };
          changed = true;
        }
      });
      if (changed) setLocalCardsMap(map);
      localStorage.removeItem(STORAGE_KEYS.LEGACY_MISTAKES);
    } catch (e) {
      console.warn('Legacy mistakes migration skipped:', e);
    }
  }

  /**
   * 登录后与 Supabase 双向同步 card_states & profiles
   * 冲突解决规则：以 last_review 较新的一方为准（若均无 last_review，则以 updated_at / due 较新为准）
   */
  async function syncWithCloud(user) {
    migrateLegacyMistakesIfNeeded();
    const sb = getSbClient();
    if (!user || !sb) return getLocalCardsMap();

    try {
      // 1. 同步用户配置
      const { data: profileData } = await sb
        .from('profiles')
        .select('daily_new_limit, daily_review_limit, request_retention')
        .eq('id', user.id)
        .maybeSingle();

      if (profileData) {
        const syncedSettings = {
          daily_new_limit: profileData.daily_new_limit ?? DEFAULT_SETTINGS.daily_new_limit,
          daily_review_limit: profileData.daily_review_limit ?? DEFAULT_SETTINGS.daily_review_limit,
          request_retention: Number(profileData.request_retention ?? DEFAULT_SETTINGS.request_retention)
        };
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(syncedSettings));
      } else {
        const localSet = getSettings();
        await sb.from('profiles').upsert({
          id: user.id,
          daily_new_limit: localSet.daily_new_limit,
          daily_review_limit: localSet.daily_review_limit,
          request_retention: localSet.request_retention,
          updated_at: new Date().toISOString()
        });
      }

      // 2. 拉取云端所有 card_states
      const { data: cloudRows, error } = await sb
        .from('card_states')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.warn('拉取云端 card_states 失败:', error.message);
        return getLocalCardsMap();
      }

      const localMap = getLocalCardsMap();
      const cloudMap = {};
      (cloudRows || []).forEach(r => { cloudMap[r.word_id] = r; });

      const allIds = new Set([...Object.keys(localMap), ...Object.keys(cloudMap)]);
      const mergedMap = {};
      const toUpsertCloud = [];

      allIds.forEach(wid => {
        const loc = localMap[wid];
        const cld = cloudMap[wid];

        if (loc && !cld) {
          mergedMap[wid] = loc;
          toUpsertCloud.push(formatRowForCloud(loc, user.id));
        } else if (!loc && cld) {
          mergedMap[wid] = formatRowFromCloud(cld);
        } else if (loc && cld) {
          const locTime = loc.last_review ? new Date(loc.last_review).getTime() : 0;
          const cldTime = cld.last_review ? new Date(cld.last_review).getTime() : 0;

          if (locTime > cldTime) {
            // 本地较新 -> 覆盖云端
            const mergedItem = {
              ...loc,
              manual_mistake: Boolean(loc.manual_mistake || cld.manual_mistake)
            };
            mergedMap[wid] = mergedItem;
            toUpsertCloud.push(formatRowForCloud(mergedItem, user.id));
          } else if (cldTime > locTime) {
            // 云端较新 -> 覆盖本地
            const mergedItem = formatRowFromCloud(cld);
            mergedItem.manual_mistake = Boolean(loc.manual_mistake || cld.manual_mistake);
            mergedMap[wid] = mergedItem;
          } else {
            // 均无 last_review（如游戏答错刚入库），合并 lapses 与 manual_mistake
            const base = cldTime >= locTime ? formatRowFromCloud(cld) : loc;
            base.lapses = Math.max(Number(loc.lapses || 0), Number(cld.lapses || 0));
            base.manual_mistake = Boolean(loc.manual_mistake || cld.manual_mistake);
            mergedMap[wid] = base;
            if (loc.lapses > (cld.lapses || 0) || (loc.manual_mistake && !cld.manual_mistake)) {
              toUpsertCloud.push(formatRowForCloud(base, user.id));
            }
          }
        }
      });

      setLocalCardsMap(mergedMap);

      if (toUpsertCloud.length > 0) {
        const batchSize = 200;
        for (let i = 0; i < toUpsertCloud.length; i += batchSize) {
          await sb.from('card_states').upsert(toUpsertCloud.slice(i, i + batchSize), {
            onConflict: 'user_id,word_id'
          });
        }
      }

      // 3. 同步未上传的本地 review_logs
      const localLogs = getLocalLogs();
      const unsyncedLogs = localLogs.filter(l => !l._synced);
      if (unsyncedLogs.length > 0) {
        const payload = unsyncedLogs.map(l => ({
          user_id: user.id,
          word_id: l.word_id,
          rating: l.rating,
          state: l.state,
          due: l.due,
          stability: l.stability,
          difficulty: l.difficulty,
          elapsed_days: l.elapsed_days,
          scheduled_days: l.scheduled_days,
          reviewed_at: l.reviewed_at,
          duration_ms: l.duration_ms || 0
        }));
        const { error: logErr } = await sb.from('review_logs').insert(payload);
        if (!logErr) {
          localLogs.forEach(l => { l._synced = true; });
          localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(localLogs));
        }
      }

      return mergedMap;
    } catch (err) {
      console.warn('FSRS 云端同步异常:', err);
      return getLocalCardsMap();
    }
  }

  function formatRowForCloud(item, userId) {
    return {
      user_id: userId,
      word_id: item.word_id,
      due: item.due || new Date().toISOString(),
      stability: Number(item.stability || 0),
      difficulty: Number(item.difficulty || 0),
      elapsed_days: Number(item.elapsed_days || 0),
      scheduled_days: Number(item.scheduled_days || 0),
      reps: Number(item.reps || 0),
      lapses: Number(item.lapses || 0),
      state: Number(item.state ?? 0),
      last_review: item.last_review || null,
      manual_mistake: Boolean(item.manual_mistake),
      kanji: item.kanji || '',
      kana: item.kana || '',
      pitch: item.pitch || '',
      pos: item.pos || '',
      meaning: item.meaning || '',
      book_id: item.book_id || '',
      grade_id: item.grade_id || '',
      lesson_id: item.lesson_id || '',
      updated_at: new Date().toISOString()
    };
  }

  function formatRowFromCloud(row) {
    return {
      word_id: row.word_id,
      due: row.due,
      stability: Number(row.stability || 0),
      difficulty: Number(row.difficulty || 0),
      elapsed_days: Number(row.elapsed_days || 0),
      scheduled_days: Number(row.scheduled_days || 0),
      reps: Number(row.reps || 0),
      lapses: Number(row.lapses || 0),
      state: Number(row.state ?? 0),
      last_review: row.last_review || null,
      manual_mistake: Boolean(row.manual_mistake),
      kanji: row.kanji || '',
      kana: row.kana || '',
      pitch: row.pitch || '',
      pos: row.pos || '',
      meaning: row.meaning || '',
      book_id: row.book_id || '',
      grade_id: row.grade_id || '',
      lesson_id: row.lesson_id || ''
    };
  }

  /**
   * 四个游戏模式答错衔接函数：
   * - 该词已有卡片：按 FSRS Again 处理（增加 lapses，重设 due 为立即/近期到期）
   * - 没有卡片：作为新卡加入且立即到期（due = now, lapses = 1）
   */
  async function recordGameMistake(wordObj, context = {}) {
    migrateLegacyMistakesIfNeeded();
    const wid = resolveWordId(wordObj);
    if (!wid) return;

    const now = new Date();
    const map = getLocalCardsMap();
    const existing = map[wid];
    let updatedRecord = null;

    try {
      const lib = await loadTsFsrs();
      const settings = getSettings();
      const params = lib.generatorParameters({ request_retention: settings.request_retention });
      const f = lib.fsrs(params);

      if (existing) {
        // 已有卡片 -> 按 Again 处理
        const card = toFsrsCard(existing, lib, now);
        const scheduling = f.repeat(card, now);
        const againOutcome = scheduling[lib.Rating.Again];
        const nextCard = againOutcome.card;
        // 保障游戏答错后卡片立刻处于可复习到期状态
        const immediateDue = nextCard.due.getTime() > now.getTime() ? now : nextCard.due;

        updatedRecord = {
          ...existing,
          due: immediateDue.toISOString(),
          stability: nextCard.stability,
          difficulty: nextCard.difficulty,
          elapsed_days: nextCard.elapsed_days,
          scheduled_days: nextCard.scheduled_days,
          reps: nextCard.reps,
          lapses: Math.max((existing.lapses || 0) + 1, nextCard.lapses || 1),
          state: nextCard.state,
          last_review: now.toISOString(),
          kanji: existing.kanji || wordObj.kanji || '',
          kana: existing.kana || wordObj.kana || wordObj.word || '',
          pitch: existing.pitch || wordObj.pitch || '',
          pos: existing.pos || wordObj.pos || '',
          meaning: existing.meaning || wordObj.meaning || '',
          book_id: existing.book_id || context.book_id || '',
          grade_id: existing.grade_id || context.grade_id || '',
          lesson_id: existing.lesson_id || context.lesson_id || ''
        };
      } else {
        // 没有卡片 -> 作为新卡加入且立即到期
        const emptyCard = lib.createEmptyCard(now);
        updatedRecord = {
          word_id: wid,
          due: now.toISOString(),
          stability: emptyCard.stability,
          difficulty: emptyCard.difficulty,
          elapsed_days: 0,
          scheduled_days: 0,
          reps: 0,
          lapses: 1,
          state: lib.State.New,
          last_review: null,
          manual_mistake: false,
          kanji: wordObj.kanji || '',
          kana: wordObj.kana || wordObj.word || '',
          pitch: wordObj.pitch || '',
          pos: wordObj.pos || '',
          meaning: wordObj.meaning || '',
          book_id: context.book_id || '',
          grade_id: context.grade_id || '',
          lesson_id: context.lesson_id || ''
        };
      }
    } catch (e) {
      // 离线无 CDN 兜底
      updatedRecord = {
        word_id: wid,
        due: now.toISOString(),
        stability: existing ? existing.stability : 0,
        difficulty: existing ? existing.difficulty : 0,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: existing ? existing.reps : 0,
        lapses: (existing ? (existing.lapses || 0) : 0) + 1,
        state: existing ? 3 : 0,
        last_review: existing ? now.toISOString() : null,
        manual_mistake: existing ? Boolean(existing.manual_mistake) : false,
        kanji: (existing && existing.kanji) || wordObj.kanji || '',
        kana: (existing && existing.kana) || wordObj.kana || wordObj.word || '',
        pitch: (existing && existing.pitch) || wordObj.pitch || '',
        pos: (existing && existing.pos) || wordObj.pos || '',
        meaning: (existing && existing.meaning) || wordObj.meaning || '',
        book_id: (existing && existing.book_id) || context.book_id || '',
        grade_id: (existing && existing.grade_id) || context.grade_id || '',
        lesson_id: (existing && existing.lesson_id) || context.lesson_id || ''
      };
    }

    map[wid] = updatedRecord;
    setLocalCardsMap(map);

    const sb = getSbClient();
    if (sb) {
      try {
        const { data: { session } } = await sb.auth.getSession();
        if (session && session.user) {
          await sb.from('card_states').upsert(formatRowForCloud(updatedRecord, session.user.id), {
            onConflict: 'user_id,word_id'
          });
        }
      } catch (err) {
        console.warn('云端写入游戏错词失败:', err);
      }
    }
    return updatedRecord;
  }

  /**
   * 统计今日到期卡片数量（due <= 当前时间）
   */
  function getDueCardsCount() {
    migrateLegacyMistakesIfNeeded();
    const nowMs = Date.now();
    const map = getLocalCardsMap();
    return Object.values(map).filter(c => c.due && new Date(c.due).getTime() <= nowMs).length;
  }

  /**
   * 获取错词本筛选视图（lapses > 0 或 manual_mistake === true）
   */
  function getMistakeFilterList() {
    migrateLegacyMistakesIfNeeded();
    const map = getLocalCardsMap();
    return Object.values(map).filter(c => Number(c.lapses || 0) > 0 || Boolean(c.manual_mistake));
  }

  /**
   * 从错词本视图中移除（清零 lapses 与 manual_mistake，保留 FSRS 记忆调度或按需重置）
   */
  async function removeFromMistakes(wordId, user) {
    const map = getLocalCardsMap();
    if (!map[wordId]) return;
    map[wordId].lapses = 0;
    map[wordId].manual_mistake = false;
    setLocalCardsMap(map);

    const sb = getSbClient();
    if (user && sb) {
      await sb.from('card_states')
        .update({ lapses: 0, manual_mistake: false, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('word_id', wordId);
    }
  }

  /**
   * 格式化间隔预览文本（如 "1分钟"、"10分钟"、"1天"、"4天"）
   */
  function formatIntervalPreview(dueDate, nowDate) {
    const diffMs = Math.max(0, dueDate.getTime() - nowDate.getTime());
    const diffMins = Math.round(diffMs / 60000);
    if (diffMins < 1) return '<1分钟';
    if (diffMins < 60) return `${diffMins}分钟`;
    const diffHours = Math.round(diffMins / 60);
    if (diffHours < 24) return `${diffHours}小时`;
    const diffDays = Math.round(diffHours / 24);
    if (diffDays < 30) return `${diffDays}天`;
    const diffMonths = Math.round(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths}个月`;
    const diffYears = (diffDays / 365).toFixed(1).replace(/\.0$/, '');
    return `${diffYears}年`;
  }

  global.TangogoFSRS = {
    STORAGE_KEYS,
    DEFAULT_SETTINGS,
    loadTsFsrs,
    getSbClient,
    getStudyDayBounds,
    getSettings,
    saveSettings,
    getLocalCardsMap,
    setLocalCardsMap,
    getLocalLogs,
    appendLocalLog,
    resolveWordId,
    toFsrsCard,
    migrateLegacyMistakesIfNeeded,
    syncWithCloud,
    formatRowForCloud,
    recordGameMistake,
    getDueCardsCount,
    getMistakeFilterList,
    removeFromMistakes,
    formatIntervalPreview
  };
})(window);
