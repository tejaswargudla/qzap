const { v4: uuid } = require('uuid');
const QRCode = require('qrcode');
const { supabase } = require('./_supabase');
const { cors, requireAdmin } = require('./_helpers');

// POST /api/queues — admin creates a new queue
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { name, category, lat, lng, radius = 100, description = '', demo = false } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!demo && (!lat || !lng)) return res.status(400).json({ error: 'lat and lng are required (or enable demo mode)' });

  try {
    const queueId = uuid();
    const baseUrl = process.env.BASE_URL ||
      (process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000');
    const queueUrl = `${baseUrl}/queue?id=${queueId}`;

    const qrCode = await QRCode.toDataURL(queueUrl, {
      width: 300, margin: 2,
      color: { dark: '#1A1A2E', light: '#FFFFFF' },
    });

    const row = {
      id:          queueId,
      name,
      category:    category || '📦 Other',
      lat:         parseFloat(lat) || 0,
      lng:         parseFloat(lng) || 0,
      radius:      parseInt(radius) || (demo ? 999999 : 100),
      description,
      demo:        !!demo,
      status:      'active',
      admin_id:    admin.uid,
      queue_url:   queueUrl,
    };

    const { data, error } = await supabase.from('queues').insert(row).select().single();
    if (error) throw error;

    res.status(201).json({
      queue: {
        ...data,
        adminId:  data.admin_id,
        queueUrl: data.queue_url,
        createdAt: data.created_at,
      },
      qrCode,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create queue' });
  }
};
