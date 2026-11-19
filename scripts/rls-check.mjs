/**
 * Tangogo 自动化权限矩阵验收脚本 (scripts/rls-check.mjs)
 *
 * 使用三种身份连接 Supabase 并验证所有表与 RPC 策略：
 * 1. 匿名访客 (anon)
 * 2. 普通登录账号 (regular user)
 * 3. 管理员账号 (admin user)
 *
 * 运行方式：
 *   SUPABASE_URL="https://zbfjbtzvnhmfzyvooact.supabase.co" \
 *   SUPABASE_ANON_KEY="sb_publishable_AP0YnQLgzmB3d63_4zbpjg_vHeTyo8Z" \
 *   USER_EMAIL="normal@example.com" USER_PASSWORD="password123" \
 *   ADMIN_EMAIL="admin@example.com" ADMIN_PASSWORD="password123" \
 *   node scripts/rls-check.mjs
 */
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zbfjbtzvnhmfzyvooact.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_AP0YnQLgzmB3d63_4zbpjg_vHeTyo8Z';

const USER_EMAIL = process.env.USER_EMAIL;
const USER_PASSWORD = process.env.USER_PASSWORD;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!USER_EMAIL || !USER_PASSWORD || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('❌ 缺少环境变量，请提供：USER_EMAIL, USER_PASSWORD, ADMIN_EMAIL, ADMIN_PASSWORD');
  process.exit(1);
}

function makeClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

const matrix = [];
let hasFailure = false;

function recordCheck(role, target, action, expected, actual, detail = '') {
  const pass = expected === actual;
  if (!pass) hasFailure = true;
  matrix.push({
    角色: role,
    对象: target,
    操作: action,
    预期: expected ? '允许' : '拒绝',
    实际: actual ? '允许' : '拒绝',
    结果: pass ? 'PASS' : 'FAIL',
    备注: detail
  });
}

async function main() {
  const anonClient = makeClient();
  const userClient = makeClient();
  const adminClient = makeClient();

  const { data: userAuth, error: userLoginErr } = await userClient.auth.signInWithPassword({
    email: USER_EMAIL,
    password: USER_PASSWORD
  });
  if (userLoginErr || !userAuth.user) {
    console.error('❌ 普通账号登录失败:', userLoginErr?.message);
    process.exit(1);
  }

  const { data: adminAuth, error: adminLoginErr } = await adminClient.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD
  });
  if (adminLoginErr || !adminAuth.user) {
    console.error('❌ 管理员账号登录失败:', adminLoginErr?.message);
    process.exit(1);
  }

  const probePrefix = `_rls_test_${Date.now()}_`;
  let adminSeededWordId = null;

  try {
    // -------------------------------------------------------------------------
    // 1. 验证 is_admin() RPC 在三种身份下的返回值
    // -------------------------------------------------------------------------
    const { data: anonIsAdmin } = await anonClient.rpc('is_admin');
    recordCheck('anon', 'rpc:is_admin', 'CALL', false, anonIsAdmin === true, `返回 ${anonIsAdmin}`);

    const { data: userIsAdmin } = await userClient.rpc('is_admin');
    recordCheck('user', 'rpc:is_admin', 'CALL', false, userIsAdmin === true, `返回 ${userIsAdmin}`);

    const { data: adminIsAdmin } = await adminClient.rpc('is_admin');
    recordCheck('admin', 'rpc:is_admin', 'CALL', true, adminIsAdmin === true, `返回 ${adminIsAdmin}`);

    // -------------------------------------------------------------------------
    // 2. 验证 public.admins 表对所有前端角色不可读写
    // -------------------------------------------------------------------------
    for (const [roleName, client] of [['anon', anonClient], ['user', userClient], ['admin', adminClient]]) {
      const { data, error } = await client.from('admins').select('*');
      const allowed = !error && Array.isArray(data) && data.length > 0;
      recordCheck(roleName, 'public.admins', 'SELECT', false, allowed, error ? error.message : `rows=${data?.length ?? 0}`);
    }

    // -------------------------------------------------------------------------
    // 3. 管理员先插入一条带前缀的临时词库记录，供后续 UPDATE / DELETE 交叉测试
    // -------------------------------------------------------------------------
    const { data: insertedAdminRows, error: adminInsErr } = await adminClient
      .from('words')
      .insert([{
        book_id: probePrefix,
        grade_id: probePrefix,
        lesson_id: probePrefix,
        kanji: 'テスト',
        kana: 'てすと',
        pitch: '①',
        pos: '名',
        meaning: 'RLS自动化测试临时词条'
      }])
      .select('id');

    const adminCanInsert = !adminInsErr && Array.isArray(insertedAdminRows) && insertedAdminRows.length === 1;
    recordCheck('admin', 'public.words', 'INSERT', true, adminCanInsert, adminInsErr?.message || '');
    if (adminCanInsert) {
      adminSeededWordId = insertedAdminRows[0].id;
    }

    // -------------------------------------------------------------------------
    // 4. 词库表 public.words 权限矩阵（SELECT / INSERT / UPDATE / DELETE）
    // -------------------------------------------------------------------------
    for (const [roleName, client, canWrite] of [
      ['anon', anonClient, false],
      ['user', userClient, false],
      ['admin', adminClient, true]
    ]) {
      // SELECT
      const { data: selRows, error: selErr } = await client.from('words').select('id').limit(1);
      recordCheck(roleName, 'public.words', 'SELECT', true, !selErr && Array.isArray(selRows), selErr?.message || '');

      // INSERT (skip admin because already tested above)
      if (roleName !== 'admin') {
        const { data: insRows, error: insErr } = await client
          .from('words')
          .insert([{
            book_id: probePrefix,
            grade_id: probePrefix,
            lesson_id: probePrefix,
            kana: 'てすと',
            meaning: 'unauthorized'
          }])
          .select('id');
        const actuallyInserted = !insErr && Array.isArray(insRows) && insRows.length > 0;
        if (actuallyInserted) {
          await adminClient.from('words').delete().eq('id', insRows[0].id);
        }
        recordCheck(roleName, 'public.words', 'INSERT', canWrite, actuallyInserted, insErr?.message || `rows=${insRows?.length ?? 0}`);
      }

      // UPDATE (must include .select() to verify affected row count!)
      if (adminSeededWordId) {
        const { data: updRows, error: updErr } = await client
          .from('words')
          .update({ meaning: `updated_by_${roleName}` })
          .eq('id', adminSeededWordId)
          .select('id');
        const actuallyUpdated = !updErr && Array.isArray(updRows) && updRows.length > 0;
        recordCheck(roleName, 'public.words', 'UPDATE', canWrite, actuallyUpdated, updErr?.message || `rows=${updRows?.length ?? 0}`);
      }

      // DELETE (for anon/user try deleting adminSeededWordId; for admin delete at cleanup)
      if (roleName !== 'admin' && adminSeededWordId) {
        const { data: delRows, error: delErr } = await client
          .from('words')
          .delete()
          .eq('id', adminSeededWordId)
          .select('id');
        const actuallyDeleted = !delErr && Array.isArray(delRows) && delRows.length > 0;
        recordCheck(roleName, 'public.words', 'DELETE', false, actuallyDeleted, delErr?.message || `rows=${delRows?.length ?? 0}`);
      }
    }

    // -------------------------------------------------------------------------
    // 5. 函数与 RPC 安全校验（handle_new_user 不可直接调用；record_kana_run 仅限本人）
    // -------------------------------------------------------------------------
    const { error: triggerRpcErr } = await userClient.rpc('handle_new_user');
    recordCheck('user', 'rpc:handle_new_user', 'CALL', false, !triggerRpcErr, triggerRpcErr?.message || '意外允许');

    const { error: anonKanaRpcErr } = await anonClient.rpc('record_kana_run', {
      run: { id: crypto.randomUUID(), mode: 'test', score: 0, hits: 0, accuracy: 0, durationMs: 0, level: 1, perKana: {} }
    });
    recordCheck('anon', 'rpc:record_kana_run', 'CALL', false, !anonKanaRpcErr, anonKanaRpcErr?.message || '意外允许');

    // -------------------------------------------------------------------------
    // 6. 跨账号数据隔离校验（普通账号读取管理员的私有表必须返回 0 行）
    // -------------------------------------------------------------------------
    const privateTables = ['card_states', 'review_logs', 'kana_runs', 'kana_stats', 'user_mistakes'];
    for (const tbl of privateTables) {
      const { data: otherRows, error: otherErr } = await userClient
        .from(tbl)
        .select('*')
        .eq('user_id', adminAuth.user.id);
      const leaked = !otherErr && Array.isArray(otherRows) && otherRows.length > 0;
      recordCheck('user', `public.${tbl}`, 'SELECT_OTHER_USER', false, leaked, otherErr?.message || `leakedRows=${otherRows?.length ?? 0}`);
    }
  } finally {
    // 清理测试创建的临时记录，绝不污染真实词库
    if (adminSeededWordId) {
      const { data: cleanupRows, error: cleanupErr } = await adminClient
        .from('words')
        .delete()
        .eq('id', adminSeededWordId)
        .select('id');
      const cleaned = !cleanupErr && Array.isArray(cleanupRows) && cleanupRows.length === 1;
      recordCheck('admin', 'public.words', 'DELETE', true, cleaned, cleanupErr?.message || '');
    }
    await adminClient.from('words').delete().eq('book_id', probePrefix);
  }

  console.table(matrix);

  if (hasFailure) {
    console.error('❌ 权限矩阵验收存在失败项（FAIL），请立即检查上述不通过项！');
    process.exit(1);
  } else {
    console.log('✅ 全部权限矩阵与跨账号隔离校验均已通过（PASS）！');
  }
}

main().catch((err) => {
  console.error('运行异常:', err);
  process.exit(1);
});
