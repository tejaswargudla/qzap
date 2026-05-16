require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());

// Vercel puts dynamic path segments in req.query; merge Express params so handlers work unchanged
function h(fn) {
  return (req, res) => {
    req.query = { ...req.params, ...req.query };
    return fn(req, res);
  };
}

const root = path.join(__dirname, '..');

// Static assets (JS, CSS, images, etc.)
app.use(express.static(path.join(root, 'public')));

// API routes — specific paths must come before wildcard param routes
app.all('/api/health',                                    h(require('../api/health')));
app.all('/api/queues/list',                               h(require('../api/queues/list')));
app.all('/api/queues/stats',                              h(require('../api/queues/stats')));
app.all('/api/queues/:id/entries/:entryId/done',          h(require('../api/queues/[id]/entries/[entryId]/done')));
app.all('/api/queues/:id/entries/:entryId/remove',        h(require('../api/queues/[id]/entries/[entryId]/remove')));
app.all('/api/queues/:id/entries/:entryId/subscribe',     h(require('../api/queues/[id]/entries/[entryId]/subscribe')));
app.all('/api/queues/:id/entries/:entryId',               h(require('../api/queues/[id]/entries/[entryId]')));
app.all('/api/queues/:id/entries',                        h(require('../api/queues/[id]/entries')));
app.all('/api/queues/:id/join',                           h(require('../api/queues/[id]/join')));
app.all('/api/queues/:id',                                h(require('../api/queues/[id]')));
app.all('/api/queues',                                    h(require('../api/queues')));

// Named HTML pages (mirrors vercel.json routes)
app.get('/admin', (req, res) => res.sendFile(path.join(root, 'public', 'admin.html')));
app.get('/login', (req, res) => res.sendFile(path.join(root, 'public', 'login.html')));
app.get('/queue', (req, res) => res.sendFile(path.join(root, 'public', 'queue.html')));
app.get('/',      (req, res) => res.sendFile(path.join(root, 'public', 'index.html')));

const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, () => {
  console.log(`\nQueueZap → http://localhost:${PORT}\n`);
});
