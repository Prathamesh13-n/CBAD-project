/* ============================================================
   CDAD server :: upload.js
   Multer config for the Submission tab's file attachment (PDF,
   PPT/PPTX, CSV, DOC/DOCX). Files land under server/data/uploads —
   the same directory the SQLite file lives in, so the existing
   Docker volume (-v cdad-data:/app/server/data) already covers
   persistence here with no extra config.
   ============================================================ */
const path = require('node:path');
const fs = require('node:fs');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, 'data', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_EXTENSIONS = ['.pdf', '.ppt', '.pptx', '.csv', '.doc', '.docx'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, unique);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error('Only PDF, PPT/PPTX, CSV, and DOC/DOCX files are allowed.'));
    }
    cb(null, true);
  }
});

function deleteUploadedFile(fileName) {
  if (!fileName) return;
  fs.unlink(path.join(UPLOAD_DIR, fileName), () => {}); // best-effort, ignore errors
}

module.exports = { upload, UPLOAD_DIR, deleteUploadedFile, ALLOWED_EXTENSIONS, MAX_FILE_SIZE };
