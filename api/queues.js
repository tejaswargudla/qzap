const { v4: uuid } = require('uuid');
const QRCode = require('qrcode');
const { db } = require('./_firebase');
const { cors, requireAdmin } = require('./_helpers');

// POST /api/queues — admin creates a new queue
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { name, category, lat, lng, radius = 100, description = '', demo = false } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (!demo && (!lat || !lng)) {
    return res.status(400).json({ error: 'lat and lng are required (or enable demo mode)' });
  }

  try {
    const queueId = uuid();
    const queueUrl = `${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/queue?id=${queueId}`;

    // Generate QR code as base64 image
    const qrCode = await QRCode.toDataURL(queueUrl, {
      width: 300, margin: 2,
      color: { dark: '#1A1A2E', light: '#FFFFFF' },
    });

    const queue = {
      id: queueId, name,
      category: category || '📦 Other',
      lat: parseFloat(lat) || 0,
      lng: parseFloat(lng) || 0,
      radius: parseInt(radius) || (demo ? 999999 : 100),
      description, demo: !!demo,
      status: 'active',
      adminId: admin.uid,
      queueUrl,
      createdAt: new Date().toISOString(),
    };

    await db.collection('queues').doc(queueId).set(queue);
    res.status(201).json({ queue, qrCode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create queue' });
  }
};