/* ============================================================
   WEB WORLD SERVICES — SERVER
   ------------------------------------------------------------
   A small Node.js server that:
     1. Serves the website (index.html, css, js, images...)
     2. Accepts contact form submissions and saves them into a
        real database file on disk (data/messages.json)
     3. Gives the admin dashboard a way to log in and read those
        messages (with the password checked on the SERVER this
        time, not in the browser)

   It uses ONLY Node's built-in modules — no npm install needed.
   That makes it easy to deploy on almost any free Node hosting
   (Render, Railway, Cyclic, a VPS, etc.) with zero setup steps.
   ============================================================ */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---------- Configuration ----------
const PORT = process.env.PORT || 3000;

// 🔑 Change this before you go live! You can also set it as an
// environment variable called ADMIN_PASSWORD on your host instead
// of editing this file (recommended — see README.md).
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'WebWorld@2026';

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DB_FILE = path.join(DATA_DIR, 'messages.json');

// ---------- Tiny JSON "database" ----------
// Every contact form submission is appended to this file as a
// JSON array. It's simple, human-readable, and needs no database
// server to run — a genuine, working data store for a site at
// this scale. (For very high traffic you'd swap this for a real
// database like PostgreSQL — see README.md for notes on that.)
function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '[]', 'utf8');
}

function readMessages() {
  ensureDb();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error('Failed to read database file:', err);
    return [];
  }
}

function writeMessages(messages) {
  ensureDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(messages, null, 2), 'utf8');
}

// ---------- Very small session store (in memory) ----------
// When an admin logs in successfully we hand back a random token
// and remember it here. Restarting the server logs everyone out,
// which is fine for a site this size.
const sessions = new Set();
const SESSION_TTL_MS = 1000 * 60 * 60 * 4; // 4 hours
const sessionExpiry = new Map();

function createSession() {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.add(token);
  sessionExpiry.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

function isValidSession(token) {
  if (!token || !sessions.has(token)) return false;
  if (Date.now() > sessionExpiry.get(token)) {
    sessions.delete(token);
    sessionExpiry.delete(token);
    return false;
  }
  return true;
}

// ---------- Helpers ----------
function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let tooBig = false;
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) { // 1MB limit — plenty for a contact form
        tooBig = true;
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (tooBig) return;
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getBearerToken(req) {
  const header = req.headers['authorization'] || '';
  const match = header.match(/^Bearer (.+)$/);
  return match ? match[1] : null;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

function serveStaticFile(req, res, urlPath) {
  let filePath = urlPath === '/' ? '/index.html' : urlPath;
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, ''); // basic traversal guard
  const fullPath = path.join(ROOT_DIR, filePath);

  // Never serve anything from /data (that's the database folder)
  if (fullPath.startsWith(DATA_DIR) || fullPath === path.join(ROOT_DIR, 'server.js')) {
    res.writeHead(404);
    return res.end('Not found');
  }

  fs.readFile(fullPath, (err, content) => {
    if (err) {
      // Fall back to a friendly 404 page if we have one, else plain text
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 - Page not found');
    }
    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

// ---------- Request handler ----------
const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const pathname = urlObj.pathname;

  try {
    // ---------- PUBLIC API: submit the contact form ----------
    if (pathname === '/api/contact' && req.method === 'POST') {
      const data = await readBody(req);
      const { name, email, phone, subject, message } = data;

      if (!name || !email || !subject || !message) {
        return sendJson(res, 400, { ok: false, error: 'Please fill in all required fields.' });
      }
      const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!emailLooksValid) {
        return sendJson(res, 400, { ok: false, error: 'Please enter a valid email address.' });
      }

      const messages = readMessages();
      const entry = {
        id: crypto.randomUUID(),
        name: escapeHtml(name).slice(0, 200),
        email: escapeHtml(email).slice(0, 200),
        phone: escapeHtml(phone || '').slice(0, 50),
        subject: escapeHtml(subject).slice(0, 200),
        message: escapeHtml(message).slice(0, 5000),
        createdAt: new Date().toISOString(),
        read: false,
      };
      messages.unshift(entry); // newest first
      writeMessages(messages);

      return sendJson(res, 200, { ok: true, message: 'Thanks! Your message has been received.' });
    }

    // ---------- ADMIN API: log in ----------
    if (pathname === '/api/admin/login' && req.method === 'POST') {
      const data = await readBody(req);
      if (data.password === ADMIN_PASSWORD) {
        const token = createSession();
        return sendJson(res, 200, { ok: true, token });
      }
      return sendJson(res, 401, { ok: false, error: 'Incorrect password.' });
    }

    // ---------- ADMIN API: log out ----------
    if (pathname === '/api/admin/logout' && req.method === 'POST') {
      const token = getBearerToken(req);
      if (token) { sessions.delete(token); sessionExpiry.delete(token); }
      return sendJson(res, 200, { ok: true });
    }

    // ---------- ADMIN API: everything below requires a valid session ----------
    if (pathname.startsWith('/api/admin/')) {
      const token = getBearerToken(req);
      if (!isValidSession(token)) {
        return sendJson(res, 401, { ok: false, error: 'Not logged in.' });
      }

      // List all messages
      if (pathname === '/api/admin/messages' && req.method === 'GET') {
        return sendJson(res, 200, { ok: true, messages: readMessages() });
      }

      // Stats for the dashboard cards
      if (pathname === '/api/admin/stats' && req.method === 'GET') {
        const messages = readMessages();
        return sendJson(res, 200, {
          ok: true,
          stats: {
            total: messages.length,
            unread: messages.filter((m) => !m.read).length,
          },
        });
      }

      // Mark one message as read: /api/admin/messages/<id>/read
      const readMatch = pathname.match(/^\/api\/admin\/messages\/([^/]+)\/read$/);
      if (readMatch && req.method === 'POST') {
        const id = readMatch[1];
        const messages = readMessages();
        const target = messages.find((m) => m.id === id);
        if (!target) return sendJson(res, 404, { ok: false, error: 'Message not found.' });
        target.read = true;
        writeMessages(messages);
        return sendJson(res, 200, { ok: true });
      }

      // Delete a message: /api/admin/messages/<id>
      const deleteMatch = pathname.match(/^\/api\/admin\/messages\/([^/]+)$/);
      if (deleteMatch && req.method === 'DELETE') {
        const id = deleteMatch[1];
        const messages = readMessages().filter((m) => m.id !== id);
        writeMessages(messages);
        return sendJson(res, 200, { ok: true });
      }

      return sendJson(res, 404, { ok: false, error: 'Unknown admin endpoint.' });
    }

    // ---------- Everything else: serve the static website ----------
    if (req.method === 'GET') {
      return serveStaticFile(req, res, pathname);
    }

    res.writeHead(405);
    res.end('Method not allowed');
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { ok: false, error: 'Something went wrong on our end.' });
  }
});

server.listen(PORT, () => {
  ensureDb();
  console.log(`Web World Services is running: http://localhost:${PORT}`);
  console.log(`Admin dashboard:               http://localhost:${PORT}/admin.html`);
});
