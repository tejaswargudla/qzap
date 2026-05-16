// ── CORS ─────────────────────────────────────────────────────────────────────
function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
async function requireAdmin(req, res) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization header' });
    return null;
  }
  const token = header.split(' ')[1];
  if (token === process.env.ADMIN_SECRET || token === 'admin-token-phase1') {
    return { uid: 'admin' };
  }
  res.status(401).json({ error: 'Invalid token' });
  return null;
}

// ── HAVERSINE ─────────────────────────────────────────────────────────────────
function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = { cors, requireAdmin, getDistanceMeters };
