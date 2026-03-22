const { db }     = require('../_firebase');
const { cors, requireAdmin } = require('../_helpers');

// GET /api/queues/list — admin fetches all their queues
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  try {
    const snap = await db.collection('queues')
      .where('adminId', '==', admin.uid)
      .orderBy('createdAt', 'desc')
      .get();

    const queues = await Promise.all(snap.docs.map(async doc => {
      const q = doc.data();
      const entriesSnap = await db
        .collection('queues').doc(doc.id)
        .collection('entries')
        .where('status', '==', 'waiting').get();
      return { ...q, waitingCount: entriesSnap.size };
    }));

    res.json({ queues });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch queues' });
  }
};
