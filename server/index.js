/* ============================================================
   CDAD server :: index.js
   Single Node process serving both the REST API (/api/*) and the
   static frontend — same-origin, so the session cookie "just works"
   with no CORS/SameSite complications.
   ============================================================ */
const path = require('node:path');
const express = require('express');
const cookieParser = require('cookie-parser');

require('./seed').seedIfEmpty();

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/students', require('./routes/students'));
app.use('/api/faculty', require('./routes/faculty'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/marks', require('./routes/marks'));
app.use('/api/presentations', require('./routes/presentations'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/group-join-requests', require('./routes/groupJoinRequests'));
app.use('/api/peer-requests', require('./routes/peerRequests'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/activity', require('./routes/activity'));

const FRONTEND_DIR = path.join(__dirname, '..');
app.use(express.static(FRONTEND_DIR));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CDAD server listening on http://localhost:${PORT}`));
