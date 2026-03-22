# QueueZap — Full Stack on Vercel

Everything in one repo. Frontend HTML + serverless API all deployed to Vercel for free.

---

## 📁 Project Structure

```
queuezap/
│
├── public/                        ← All frontend pages (served as static files)
│   ├── index.html                 → yourapp.vercel.app/
│   ├── login.html                 → yourapp.vercel.app/login
│   ├── admin.html                 → yourapp.vercel.app/admin
│   └── queue.html                 → yourapp.vercel.app/queue?id=xxx
│
├── api/                           ← Serverless functions (Node.js)
│   ├── _firebase.js               → Firebase init (shared, not an endpoint)
│   ├── _helpers.js                → Auth, CORS, Haversine (shared)
│   ├── health.js                  → GET  /api/health
│   ├── queues.js                  → POST /api/queues  (create queue)
│   └── queues/
│       ├── list.js                → GET  /api/queues/list
│       ├── [id].js                → GET/PATCH/DELETE /api/queues/:id
│       └── [id]/
│           ├── join.js            → POST /api/queues/:id/join
│           ├── entries.js         → GET  /api/queues/:id/entries  (admin)
│           └── entries/
│               ├── [entryId].js   → GET  /api/queues/:id/entries/:entryId
│               └── [entryId]/
│                   ├── done.js    → PATCH  /api/queues/:id/entries/:entryId/done
│                   └── remove.js  → DELETE /api/queues/:id/entries/:entryId/remove
│
├── vercel.json                    ← Vercel config
├── package.json
└── .env.example
```

---

## 🛠️ Setup — Step by Step

### Step 1 — Firebase setup
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a project called **queuezap**
3. Go to **Firestore Database** → Create database → Start in **test mode**
4. Go to **Project Settings** → **Service Accounts** → **Generate new private key**
5. Open the downloaded `.json` file, copy **all** the content

### Step 2 — Push to GitHub
```bash
git init
git add .
git commit -m "QueueZap initial commit"
```
Create a new repo on GitHub (name it `queuezap`), then:
```bash
git remote add origin https://github.com/YOUR_USERNAME/queuezap.git
git push -u origin main
```

### Step 3 — Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) → Sign up with GitHub
2. Click **Add New Project** → Import your `queuezap` repo
3. Leave all build settings as default → click **Deploy**
4. You'll get a URL like `https://queuezap.vercel.app`

### Step 4 — Add environment variables on Vercel
Go to your project → **Settings** → **Environment Variables** → add these:

| Key | Value |
|-----|-------|
| `FIREBASE_SERVICE_ACCOUNT` | Paste the entire JSON content from Step 1 |
| `ADMIN_SECRET` | Any secret string e.g. `myapp-secret-2025` (used for Phase 1 login) |

Click **Save** → go to **Deployments** → **Redeploy** to apply the variables.

### Step 5 — Test it
Visit `https://queuezap.vercel.app/api/health` — you should see:
```json
{ "status": "ok", "app": "QueueZap" }
```

---

## 🔌 API Reference

### Public endpoints (no auth)
```
GET  /api/health                              Health check
GET  /api/queues/:id                          Get queue info (user scans QR)
POST /api/queues/:id/join                     User joins queue
GET  /api/queues/:id/entries/:entryId         User checks their position
```

### Admin endpoints (send Authorization: Bearer <ADMIN_SECRET>)
```
POST   /api/queues                            Create queue + get QR code
GET    /api/queues/list                       Get all queues
PATCH  /api/queues/:id                        Pause / close queue
DELETE /api/queues/:id                        Delete queue
GET    /api/queues/:id/entries                Get full entry list
PATCH  /api/queues/:id/entries/:id/done       Mark done + notify next person
DELETE /api/queues/:id/entries/:id/remove     Remove entry
```

---

## 🔐 Connecting the Frontend to the API

In your `admin.html`, add this at the top of the `<script>` tag:
```js
const API = 'https://queuezap.vercel.app'; // your Vercel URL
const TOKEN = 'myapp-secret-2025';         // your ADMIN_SECRET

// Example: fetch all queues
const res  = await fetch(`${API}/api/queues/list`, {
  headers: { Authorization: `Bearer ${TOKEN}` }
});
const data = await res.json();
```

In your `queue.html` (user page):
```js
const API     = 'https://queuezap.vercel.app';
const queueId = new URLSearchParams(location.search).get('id');

// Fetch queue info
const res  = await fetch(`${API}/api/queues/${queueId}`);
const data = await res.json();

// Join queue
const join = await fetch(`${API}/api/queues/${queueId}/join`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, email, userLat, userLng })
});
```

---

## 🗄️ Firestore data structure

```
queues/
  {queueId}
    id, name, category, lat, lng, radius
    status: 'active' | 'paused' | 'closed'
    adminId, queueUrl, createdAt

    entries/
      {entryId}
        id, name, email, fcmToken
        position, status: 'waiting' | 'done'
        joinedAt
```
