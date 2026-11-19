/* Kana Answer Recorder, Offline Queue & Cloud Sync Engine (Instruction 5b-3) */
(function (global) {
  'use strict';

  const SUPABASE_URL = 'https://zbfjbtzvnhmfzyvooact.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_AP0YnQLgzmB3d63_4zbpjg_vHeTyo8Z';

  const KEYS = {
    RUNS: 'tangogo:kana:runs:v1',
    STATS: 'tangogo:kana:stats:v1',
    PENDING_QUEUE: 'tangogo:kana:pending_runs:v1',
    SYNCED_IDS: 'tangogo:kana:synced_run_ids:v1'
  };

  function getSbClient() {
    if (global.__tangogoSbClient) return global.__tangogoSbClient;
    if (global.supabase && global.supabase.createClient) {
      global.__tangogoSbClient = global.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      return global.__tangogoSbClient;
    }
    return null;
  }

  function generateUUID() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
      return global.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  // Active in-memory session state
  let activeSession = null;
  let isSyncing = false;

  /**
   * 开始一局新的记录会话（不依赖网络）
   */
  function startRun({ mode, config = {} }) {
    activeSession = {
      id: generateUUID(),
      mode,
      config,
      startedAtMs: Date.now(),
      perKana: {} // { [kanaId]: { right, wrong, miss, confused: {} } }
    };
    return activeSession.id;
  }

  function ensurePerKanaEntry(kanaId) {
    if (!activeSession) {
      startRun({ mode: 'unknown', config: {} });
    }
    const cleanId = String(kanaId);
    if (!activeSession.perKana[cleanId]) {
      activeSession.perKana[cleanId] = {
        right: 0,
        wrong: 0,
        miss: 0,
        confused: {}
      };
    }
    return activeSession.perKana[cleanId];
  }

  /**
   * 记录单次作答（不依赖网络）
   * @param {Object} params
   * @param {string} params.kanaId - 规范假名 ID（如 kana_a_3042，补位模式需传入 sourceId）
   * @param {boolean} [params.correct] - 是否答对（miss 为 true 时忽略）
   * @param {boolean} [params.miss=false] - 打地鼠超时未点记为 miss，单独计数，不计入 wrong
   * @param {string} [params.mode] - 当前模式
   * @param {string} [params.confusedWith] - 误选/混淆的字符或读音
   */
  function record({ kanaId, correct, miss = false, mode, confusedWith } = {}) {
    if (!kanaId) return;
    if (mode && activeSession && !activeSession.mode) {
      activeSession.mode = mode;
    }
    const entry = ensurePerKanaEntry(kanaId);
    if (miss) {
      entry.miss += 1;
    } else if (correct) {
      entry.right += 1;
    } else {
      entry.wrong += 1;
      if (confusedWith) {
        const key = String(confusedWith);
        entry.confused[key] = (entry.confused[key] || 0) + 1;
      }
    }
  }

  /**
   * 累加单局 perKana 到本地累计统计 tangogo:kana:stats:v1
   */
  function mergeIntoLocalStats(run) {
    const stats = readJSON(KEYS.STATS, {});
    const perKana = run.perKana || {};
    for (const [kanaId, delta] of Object.entries(perKana)) {
      if (!stats[kanaId]) {
        stats[kanaId] = { right: 0, wrong: 0, miss: 0, confused: {}, lastSeen: run.playedAt };
      }
      stats[kanaId].right += Number(delta.right || 0);
      stats[kanaId].wrong += Number(delta.wrong || 0);
      stats[kanaId].miss += Number(delta.miss || 0);
      stats[kanaId].lastSeen = run.playedAt;
      if (delta.confused) {
        for (const [ck, cv] of Object.entries(delta.confused)) {
          stats[kanaId].confused[ck] = (stats[kanaId].confused[ck] || 0) + Number(cv || 0);
        }
      }
    }
    writeJSON(KEYS.STATS, stats);
    return stats;
  }

  /**
   * 局结束时生成标准 run 对象，保存到本地并入队尝试同步云端
   */
  async function finishRun({ score = 0, hits = 0, accuracy = 100, durationMs, level = 1, config } = {}) {
    if (!activeSession) {
      startRun({ mode: 'unknown', config: config || {} });
    }
    const nowIso = new Date().toISOString();
    const computedDuration = typeof durationMs === 'number'
      ? Math.max(0, Math.round(durationMs))
      : Math.max(0, Date.now() - activeSession.startedAtMs);

    const run = {
      id: activeSession.id,
      mode: activeSession.mode,
      config: config || activeSession.config || {},
      score: Math.round(Number(score) || 0),
      hits: Math.round(Number(hits) || 0),
      accuracy: Math.round(Number(accuracy) || 0),
      durationMs: computedDuration,
      level: Math.max(1, Math.round(Number(level) || 1)),
      playedAt: nowIso,
      perKana: activeSession.perKana
    };

    // 清空当前活跃会话，防止重复结算
    activeSession = null;

    // 1. 存入本地历史 runs（按 id 去重）
    const localRuns = readJSON(KEYS.RUNS, []);
    if (!localRuns.some((r) => r.id === run.id)) {
      localRuns.unshift(run);
      if (localRuns.length > 500) localRuns.length = 500;
      writeJSON(KEYS.RUNS, localRuns);
      mergeIntoLocalStats(run);
    }

    // 2. 加入待同步离线队列（tangogo:kana:pending_runs:v1）
    const pending = readJSON(KEYS.PENDING_QUEUE, []);
    if (!pending.some((r) => r.id === run.id)) {
      pending.push(run);
      writeJSON(KEYS.PENDING_QUEUE, pending);
    }

    // 3. 若已登录且在线，立即尝试同步到 Supabase（失败则保留在 pending 队列中）
    await flushPendingRuns();
    return run;
  }

  /**
   * 登录后将本地历史 runs 与待传队列合并同步至云端（数据库端按 run.id 幂等去重）
   */
  async function syncAllLocalRunsOnLogin() {
    const sb = getSbClient();
    if (!sb) return;
    const { data: { session } } = await sb.auth.getSession();
    if (!session || !session.user) return;

    const localRuns = readJSON(KEYS.RUNS, []);
    const syncedSet = new Set(readJSON(KEYS.SYNCED_IDS, []));
    const pending = readJSON(KEYS.PENDING_QUEUE, []);
    const pendingIds = new Set(pending.map((r) => r.id));

    let added = false;
    for (const r of localRuns) {
      if (r && r.id && !syncedSet.has(r.id) && !pendingIds.has(r.id)) {
        pending.push(r);
        pendingIds.add(r.id);
        added = true;
      }
    }
    if (added) {
      writeJSON(KEYS.PENDING_QUEUE, pending);
    }

    await flushPendingRuns();
  }

  /**
   * 逐条调用数据库 RPC record_kana_run(run jsonb) 上传待同步队列
   */
  async function flushPendingRuns() {
    if (isSyncing) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    const sb = getSbClient();
    if (!sb) return;

    const pending = readJSON(KEYS.PENDING_QUEUE, []);
    if (!pending.length) return;

    isSyncing = true;
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session || !session.user) {
        return;
      }

      const syncedSet = new Set(readJSON(KEYS.SYNCED_IDS, []));
      const remaining = [];

      for (const run of pending) {
        if (!run || !run.id) continue;
        if (syncedSet.has(run.id)) continue;

        try {
          const { error } = await sb.rpc('record_kana_run', { run });
          if (error) {
            console.warn('[KanaRecorder] record_kana_run 上传失败，已保留离线队列等待重试:', error.message);
            remaining.push(run);
          } else {
            syncedSet.add(run.id);
          }
        } catch (err) {
          console.warn('[KanaRecorder] 网络异常，保留队列等待下次联网补传:', err);
          remaining.push(run);
        }
      }

      writeJSON(KEYS.PENDING_QUEUE, remaining);
      writeJSON(KEYS.SYNCED_IDS, Array.from(syncedSet));
    } finally {
      isSyncing = false;
    }
  }

  function getLocalStats() {
    return readJSON(KEYS.STATS, {});
  }

  function getLocalRuns() {
    return readJSON(KEYS.RUNS, []);
  }

  function getPendingCount() {
    return readJSON(KEYS.PENDING_QUEUE, []).length;
  }

  // 监听网络恢复事件，自动补传断网期间产生的练习记录
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      flushPendingRuns();
    });
  }

  global.KanaRecorder = {
    KEYS,
    getSbClient,
    startRun,
    record,
    finishRun,
    flushPendingRuns,
    syncAllLocalRunsOnLogin,
    getLocalStats,
    getLocalRuns,
    getPendingCount
  };
})(window);
