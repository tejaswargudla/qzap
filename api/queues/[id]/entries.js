const { db }     = require('../../_firebase');
const { cors, requireAdmin } = require('../../_helpers');

// GET /api/queues/[id]/entries — admin fetches full entry list
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { id: queueId } = req.query;

  try {
    const snap = await db
      .collection('queues').doc(queueId)
      .collection('entries')
      .where('status', '==', 'waiting')
      .orderBy('position', 'asc')
      .get();

    const entries = snap.docs.map(doc => {
      const e = doc.data();
      return { id: e.id, name: e.name, email: e.email, position: e.position, joinedAt: e.joinedAt };
    });

    res.json({ entries });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
};
