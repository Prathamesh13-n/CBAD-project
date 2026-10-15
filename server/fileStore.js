/* ============================================================
   CDAD server :: fileStore.js
   Where uploaded submission files live. Two backends behind one API:

   - local disk  (default)  -> server/data/uploads/, stored ref = the file name
   - Appwrite Storage       -> used when all four APPWRITE_* variables are set,
                               stored ref = "appwrite:<fileId>"

   The ref goes into the existing file_path columns, so files saved before
   Appwrite was switched on keep working: send()/remove() look at the ref's
   prefix, not at the current setting.

   Env (server/.env, or real environment variables in Docker):
     APPWRITE_ENDPOINT    e.g. https://appwrite.example.com/v1
     APPWRITE_PROJECT_ID
     APPWRITE_API_KEY     server key with the "files.read" and "files.write" scopes
     APPWRITE_BUCKET_ID
   ============================================================ */
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');

// Plain `node index.js` has no dotenv any more: load server/.env ourselves (Node 20.12+).
try { process.loadEnvFile(path.join(__dirname, '.env')); } catch { /* no .env file — fine */ }

const UPLOAD_DIR = path.join(__dirname, 'data', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const PREFIX = 'appwrite:';

function config() {
  const { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY, APPWRITE_BUCKET_ID } = process.env;
  if (!(APPWRITE_ENDPOINT && APPWRITE_PROJECT_ID && APPWRITE_API_KEY && APPWRITE_BUCKET_ID)) return null;
  return {
    endpoint: APPWRITE_ENDPOINT.replace(/\/+$/, ''), project: APPWRITE_PROJECT_ID,
    key: APPWRITE_API_KEY, bucket: APPWRITE_BUCKET_ID
  };
}

const isAppwrite = () => !!config();
const isRemoteRef = (ref) => typeof ref === 'string' && ref.startsWith(PREFIX);

function appwriteFetch(cfg, pathname, init = {}) {
  return fetch(`${cfg.endpoint}${pathname}`, {
    ...init,
    headers: { 'X-Appwrite-Project': cfg.project, 'X-Appwrite-Key': cfg.key, ...(init.headers || {}) }
  });
}

/** Uploads one multer file (already on disk) to Appwrite and returns its ref. */
async function uploadToAppwrite(cfg, file) {
  const fileId = crypto.randomBytes(9).toString('hex'); // 18 chars, valid Appwrite id
  const form = new FormData();
  form.append('fileId', fileId);
  form.append('file', new Blob([await fs.promises.readFile(path.join(UPLOAD_DIR, file.filename))]), file.originalname);
  const res = await appwriteFetch(cfg, `/storage/buckets/${cfg.bucket}/files`, { method: 'POST', body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Appwrite upload failed (${res.status}): ${body.message || 'unknown error'}`);
  }
  return PREFIX + fileId;
}

/**
 * Express middleware, placed right after multer. With Appwrite on, moves every uploaded
 * file there and rewrites file.filename to the remote ref; handlers downstream then
 * store/delete/serve it exactly like a local name. On failure nothing is kept anywhere.
 */
async function persistUploads(req, res, next) {
  const files = req.files || (req.file ? [req.file] : []);
  const cfg = config();
  if (!cfg || !files.length) return next();
  const uploaded = [];
  try {
    for (const f of files) {
      const ref = await uploadToAppwrite(cfg, f);
      uploaded.push(ref);
      fs.unlink(path.join(UPLOAD_DIR, f.filename), () => {});
      f.filename = ref;
    }
    next();
  } catch (e) {
    console.error(e);
    await Promise.all(uploaded.map(remove));
    files.filter((f) => !isRemoteRef(f.filename)).forEach((f) => fs.unlink(path.join(UPLOAD_DIR, f.filename), () => {}));
    res.status(502).json({ error: 'Could not store the file. Please try again.' });
  }
}

/** Best-effort delete of a stored file, local or remote. */
async function remove(ref) {
  if (!ref) return;
  if (isRemoteRef(ref)) {
    const cfg = config();
    if (!cfg) return;
    try { await appwriteFetch(cfg, `/storage/buckets/${cfg.bucket}/files/${ref.slice(PREFIX.length)}`, { method: 'DELETE' }); }
    catch (e) { console.error('Appwrite delete failed:', e.message); }
    return;
  }
  fs.unlink(path.join(UPLOAD_DIR, ref), () => {});
}

/**
 * Sends a stored file to the client. opts.inline + opts.contentType = show in the
 * browser instead of downloading (used by the exam-file preview).
 */
async function send(res, ref, downloadName, opts = {}) {
  if (isRemoteRef(ref)) {
    const cfg = config();
    if (!cfg) return res.status(503).json({ error: 'File storage is not configured on this server.' });
    const upstream = await appwriteFetch(cfg, `/storage/buckets/${cfg.bucket}/files/${ref.slice(PREFIX.length)}/download`);
    if (!upstream.ok) return res.status(upstream.status === 404 ? 404 : 502).json({ error: 'File could not be retrieved.' });
    res.setHeader('Content-Type', opts.contentType || upstream.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Content-Disposition', opts.inline ? 'inline' : `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return Readable.fromWeb(upstream.body).pipe(res);
  }
  const full = path.join(UPLOAD_DIR, ref);
  if (opts.inline) {
    res.setHeader('Content-Type', opts.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.sendFile(full);
  }
  return res.download(full, downloadName);
}

module.exports = { UPLOAD_DIR, isAppwrite, isRemoteRef, persistUploads, remove, send };
