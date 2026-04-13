import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || randomBytes(12).toString('hex');
const ROOT = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(ROOT, 'public');
const EMOJI_PALETTE = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
const EMOJI_SET = new Set(EMOJI_PALETTE);
const MAX_TEXT = 500;
const MAX_HISTORY = 500;

const messages = [];
const reactions = new Map();
const subscribers = new Set();

function shortHandle(userId) {
  return userId.replace(/-/g, '').slice(0, 6);
}

function reactionCounts(msgId) {
  const m = reactions.get(msgId);
  if (!m) return {};
  const out = {};
  for (const emoji of m.values()) out[emoji] = (out[emoji] || 0) + 1;
  return out;
}

function myReaction(msgId, userId) {
  return reactions.get(msgId)?.get(userId);
}

function messageView(msg, userId) {
  return {
    id: msg.id,
    userId: msg.userId,
    handle: shortHandle(msg.userId),
    text: msg.text,
    ts: msg.ts,
    reactions: reactionCounts(msg.id),
    myReaction: userId ? myReaction(msg.id, userId) : undefined,
  };
}

function sseWrite(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function broadcast(event, build) {
  for (const sub of subscribers) {
    try {
      sseWrite(sub.res, event, build(sub.userId));
    } catch {
      subscribers.delete(sub);
    }
  }
}

function readBody(req, limit = 8192) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function parseJson(req) {
  const raw = await readBody(req);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return null; }
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

async function sendStatic(res, relPath, contentType) {
  const safe = normalize(relPath).replace(/^(\.\.[/\\])+/, '');
  const full = join(PUBLIC_DIR, safe);
  if (!full.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(full);
    res.writeHead(200, {
      'content-type': contentType,
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}

function handleSse(req, res, userId) {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-store',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
  res.write(': connected\n\n');
  const sub = { res, userId };
  subscribers.add(sub);
  sseWrite(res, 'snapshot', {
    palette: EMOJI_PALETTE,
    messages: messages.map((m) => messageView(m, userId)),
  });
  const ping = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { /* ignore */ }
  }, 25000);
  req.on('close', () => {
    clearInterval(ping);
    subscribers.delete(sub);
  });
}

function validUserId(id) {
  return typeof id === 'string' && id.length >= 8 && id.length <= 64 && /^[\w-]+$/.test(id);
}

async function handleSend(req, res) {
  const body = await parseJson(req);
  if (!body) return sendJson(res, 400, { error: 'bad json' });
  const { userId, text } = body;
  if (!validUserId(userId)) return sendJson(res, 400, { error: 'bad userId' });
  if (typeof text !== 'string') return sendJson(res, 400, { error: 'bad text' });
  const trimmed = text.trim().slice(0, MAX_TEXT);
  if (!trimmed) return sendJson(res, 400, { error: 'empty' });
  const msg = { id: randomUUID(), userId, text: trimmed, ts: Date.now() };
  messages.push(msg);
  if (messages.length > MAX_HISTORY) {
    const removed = messages.splice(0, messages.length - MAX_HISTORY);
    for (const m of removed) reactions.delete(m.id);
  }
  broadcast('message', (uid) => messageView(msg, uid));
  sendJson(res, 200, { ok: true, id: msg.id });
}

async function handleReact(req, res) {
  const body = await parseJson(req);
  if (!body) return sendJson(res, 400, { error: 'bad json' });
  const { userId, msgId, emoji } = body;
  if (!validUserId(userId)) return sendJson(res, 400, { error: 'bad userId' });
  if (typeof msgId !== 'string') return sendJson(res, 400, { error: 'bad msgId' });
  if (!EMOJI_SET.has(emoji)) return sendJson(res, 400, { error: 'bad emoji' });
  const exists = messages.some((m) => m.id === msgId);
  if (!exists) return sendJson(res, 404, { error: 'unknown msg' });
  let map = reactions.get(msgId);
  if (!map) { map = new Map(); reactions.set(msgId, map); }
  const current = map.get(userId);
  if (current === emoji) map.delete(userId);
  else map.set(userId, emoji);
  const counts = reactionCounts(msgId);
  broadcast('reaction', (uid) => ({
    msgId,
    reactions: counts,
    myReaction: myReaction(msgId, uid),
  }));
  sendJson(res, 200, { ok: true });
}

function deleteMessage(msgId) {
  const idx = messages.findIndex((m) => m.id === msgId);
  if (idx < 0) return false;
  messages.splice(idx, 1);
  reactions.delete(msgId);
  broadcast('delete', () => ({ msgId }));
  return true;
}

async function handleDelete(req, res) {
  const body = await parseJson(req);
  if (!body) return sendJson(res, 400, { error: 'bad json' });
  const { userId, msgId } = body;
  if (!validUserId(userId)) return sendJson(res, 400, { error: 'bad userId' });
  if (typeof msgId !== 'string') return sendJson(res, 400, { error: 'bad msgId' });
  const msg = messages.find((m) => m.id === msgId);
  if (!msg) return sendJson(res, 404, { error: 'unknown msg' });
  if (msg.userId !== userId) return sendJson(res, 403, { error: 'not yours' });
  deleteMessage(msgId);
  sendJson(res, 200, { ok: true });
}

async function handleAdminDelete(req, res) {
  const body = await parseJson(req);
  if (!body || typeof body.msgId !== 'string') return sendJson(res, 400, { error: 'bad body' });
  if (!deleteMessage(body.msgId)) return sendJson(res, 404, { error: 'unknown msg' });
  sendJson(res, 200, { ok: true });
}

async function handleAdminLog(req, res) {
  const body = await parseJson(req);
  if (!body || typeof body.block !== 'string') return sendJson(res, 400, { error: 'bad body' });
  const stamp = new Date().toISOString();
  process.stdout.write(`\n--- forwarded ${stamp} ---\n${body.block}\n--- end ---\n`);
  sendJson(res, 200, { ok: true });
}

function parseQuery(url) {
  const q = url.split('?')[1];
  const out = {};
  if (!q) return out;
  for (const part of q.split('&')) {
    const [k, v = ''] = part.split('=');
    out[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return out;
}

const server = createServer(async (req, res) => {
  try {
    const url = req.url || '/';
    const path = url.split('?')[0];
    const query = parseQuery(url);
    const userId = query.uid || '';

    if (req.method === 'GET' && path === '/') {
      try {
        const body = await readFile(join(ROOT, 'index.html'));
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        res.end(body);
      } catch {
        res.writeHead(404).end('not found');
      }
      return;
    }
    if (req.method === 'GET' && (path === '/chat' || path === '/chat/')) {
      return sendStatic(res, 'chat.html', 'text/html; charset=utf-8');
    }
    if (req.method === 'GET' && path === '/chat/events') {
      return handleSse(req, res, validUserId(userId) ? userId : null);
    }
    if (req.method === 'POST' && path === '/chat/send') {
      return handleSend(req, res);
    }
    if (req.method === 'POST' && path === '/chat/react') {
      return handleReact(req, res);
    }
    if (req.method === 'POST' && path === '/chat/delete') {
      return handleDelete(req, res);
    }

    const adminPrefix = `/admin/${ADMIN_TOKEN}`;
    if (path === adminPrefix || path === `${adminPrefix}/`) {
      if (req.method !== 'GET') { res.writeHead(405).end(); return; }
      return sendStatic(res, 'admin.html', 'text/html; charset=utf-8');
    }
    if (path === `${adminPrefix}/events` && req.method === 'GET') {
      return handleSse(req, res, validUserId(userId) ? userId : null);
    }
    if (path === `${adminPrefix}/log` && req.method === 'POST') {
      return handleAdminLog(req, res);
    }
    if (path === `${adminPrefix}/delete` && req.method === 'POST') {
      return handleAdminDelete(req, res);
    }
    if (path.startsWith('/admin/')) {
      res.writeHead(403, { 'content-type': 'text/plain' });
      res.end('forbidden');
      return;
    }

    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  } catch (err) {
    console.error('handler error', err);
    if (!res.headersSent) res.writeHead(500).end('server error');
    else res.end();
  }
});

server.listen(PORT, () => {
  const base = `http://localhost:${PORT}`;
  console.log(`listening on ${base}`);
  console.log(`students: ${base}/chat`);
  console.log(`admin:    ${base}/admin/${ADMIN_TOKEN}`);
});
