/* API smoke tests. Run: npm test  (Node 22.5+). Boots the real server on a
   throwaway port with a temp data dir, so live data is never touched. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PORT = 3400 + Math.floor(Math.random() * 400);
const BASE = `http://localhost:${PORT}/api`;
let proc, dataDir;

async function api(method, url, { jar, json, form } = {}) {
  const headers = {};
  let body;
  if (jar && jar.cookie) headers.cookie = jar.cookie;
  if (json !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(json); }
  if (form) body = form;
  const res = await fetch(BASE + url, { method, headers, body });
  const set = res.headers.get('set-cookie');
  if (jar && set) jar.cookie = set.split(';')[0];
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON body */ }
  return { status: res.status, data };
}
async function login(role, id, password) {
  const jar = {};
  const r = await api('POST', '/auth/login', { jar, json: { role, id, password } });
  assert.equal(r.status, 200, `login ${id}`);
  return jar;
}
function fileForm(name, content, extra = {}) {
  const f = new FormData();
  f.append('file', new Blob([content]), name);
  for (const [k, v] of Object.entries(extra)) f.append(k, v);
  return f;
}

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdad-test-'));
  proc = spawn(process.execPath, ['index.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT), CDAD_DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server did not start')), 15000);
    proc.stdout.on('data', (d) => { if (String(d).includes('listening')) { clearTimeout(t); resolve(); } });
    proc.on('exit', (c) => reject(new Error('server exited early: ' + c)));
  });
});
after(() => {
  if (proc) proc.kill();
  try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* best effort */ }
});

test('login succeeds per role and rejects bad credentials', async () => {
  await login('admin', 'ADMIN001', 'admin123');
  await login('faculty', 'FAC001', 'faculty123');
  await login('student', 'ADT24SOCB0001', 'PASS123');
  const bad = await api('POST', '/auth/login', { json: { role: 'faculty', id: 'FAC001', password: 'nope' } });
  assert.equal(bad.status, 401);
  const inj = await api('POST', '/auth/login', { json: { role: 'student', id: "' OR 1=1 --", password: 'x' } });
  assert.equal(inj.status, 401);
});

test('unauthenticated requests get 401 (no crash)', async () => {
  for (const p of ['/students', '/groups', '/projects', '/marks', '/activity', '/exam-submissions']) {
    assert.equal((await api('GET', p)).status, 401, p);
  }
});

test('role boundaries: students cannot use faculty/admin routes', async () => {
  const stu = await login('student', 'ADT24SOCB0001', 'PASS123');
  assert.equal((await api('GET', '/activity', { jar: stu })).status, 401);
  assert.equal((await api('GET', '/admin/overview', { jar: stu })).status, 401);
  assert.equal((await api('DELETE', '/students/2', { jar: stu })).status, 401);
  const adm = await login('admin', 'ADMIN001', 'admin123');
  assert.equal((await api('GET', '/admin/overview', { jar: adm })).status, 200);
});

test('faculty can add a student; duplicate ID is rejected', async () => {
  const fac = await login('faculty', 'FAC001', 'faculty123');
  const s = { displayId: 'TEST001', name: 'Test One', email: 't1@x.com', password: 'PASS123' };
  assert.equal((await api('POST', '/students', { jar: fac, json: s })).status, 201);
  assert.equal((await api('POST', '/students', { jar: fac, json: s })).status, 400);
  await login('student', 'TEST001', 'PASS123');
});

test('submission upload rules and team-leader enforcement', async () => {
  const leader = await login('student', 'ADT24SOCB0001', 'PASS123');
  const fac = await login('faculty', 'FAC001', 'faculty123');
  const loner = await login('student', 'TEST001', 'PASS123');
  const url = '/projects/1/submission';

  assert.equal((await api('POST', url, { jar: leader, form: fileForm('bad.exe', 'x') })).status, 400);
  assert.equal((await api('POST', url, { jar: loner, form: fileForm('a.pdf', '%PDF-1.4') })).status, 403);
  const big = await api('POST', url, { jar: leader, form: fileForm('big.pdf', Buffer.alloc(11 * 1024 * 1024)) });
  assert.equal(big.status, 400);
  assert.equal((await api('POST', url, { jar: leader, form: fileForm('ok.pdf', '%PDF-1.4 test') })).status, 200);

  // Review decision validation
  const rev = '/projects/1/submission/review';
  assert.equal((await api('PUT', rev, { jar: fac, json: { decision: 'Banana' } })).status, 400);
  assert.equal((await api('PUT', rev, { jar: fac, json: {} })).status, 400);
  const ok = await api('PUT', rev, { jar: fac, json: { decision: 'Approved', facultyNote: 'good' } });
  assert.equal(ok.status, 200);
  const notes = await api('GET', '/notifications', { jar: leader });
  assert.ok(notes.data.some((n) => n.title === 'Submission Approved'));
});

test('marks stay hidden from students until released', async () => {
  const fac = await login('faculty', 'FAC001', 'faculty123');
  const stu = await login('student', 'ADT24SOCB0001', 'PASS123');
  await api('POST', '/marks/release-all', { jar: fac, json: { released: false } });
  assert.deepEqual((await api('GET', '/marks', { jar: stu })).data, []);
  await api('POST', '/marks/release-all', { jar: fac, json: { released: true } });
  assert.ok((await api('GET', '/marks', { jar: stu })).data.length > 0);
});

test('exam deadline validation and forgot-password captcha', async () => {
  const fac = await login('faculty', 'FAC001', 'faculty123');
  assert.equal((await api('PUT', '/exam-submissions/deadlines/TA9', { jar: fac, json: { deadline: '2030-01-01' } })).status, 400);
  assert.equal((await api('PUT', '/exam-submissions/deadlines/TA1', { jar: fac, json: { deadline: 'garbage' } })).status, 400);
  assert.equal((await api('PUT', '/exam-submissions/deadlines/TA1', { jar: fac, json: { deadline: '2030-01-01T10:00:00Z' } })).status, 200);
  const cap = await api('GET', '/auth/captcha');
  assert.equal(cap.status, 200);
  const reset = await api('POST', '/auth/forgot-password/reset', {
    json: { role: 'student', id: 'ADT24SOCB0001', email: 'hanfa@cdad.edu', captchaId: 'x', captchaText: 'zzzz', newPassword: 'abc12345' },
  });
  assert.equal(reset.status, 400);
  assert.equal(reset.data.captchaFailed, true);
});

test('logout invalidates the session', async () => {
  const stu = await login('student', 'ADT24SOCB0001', 'PASS123');
  assert.equal((await api('GET', '/auth/me', { jar: stu })).data.displayId, 'ADT24SOCB0001');
  await api('POST', '/auth/logout', { jar: stu });
  assert.equal((await api('GET', '/auth/me', { jar: stu })).data, null);
});
