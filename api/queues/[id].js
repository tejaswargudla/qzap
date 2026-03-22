const { db }     = require('../../_firebase');
const { cors, requireAdmin } = require('../../_helpers');

// /api/queues/[id]
// GET    — public, user fetches queue info after scanning QR
// PATCH  — admin updates queue status
// DELETE — admin deletes queue + all entries
module.exports = async (req, res) => {
  if (cors(req, res)) return;

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Queue id is required' });

  // ── GET (public) ───────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const doc = await db.collection('queues').doc(id).get();
      if (!doc.exists) return res.status(404).json({ error: 'Queue not found' });

      const q = doc.data();
      const entriesSnap = await db
        .collection('queues').doc(id)
        .collection('entries')
        .where('status', '==', 'waiting').get();

      // Only return public-safe fields — no adminId, no other users' info
      return res.json({
        id:            q.id,
        name:          q.name,
        category:      q.category,
        description:   q.description,
        status:        q.status,
        waitingCount:  entriesSnap.size,
        estimatedWait: entriesSnap.size * 4,
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch queue' });
    }
  }

  // ── PATCH (admin — update status) ─────────────────────────────────────────
  if (req.method === 'PATCH') {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const { status } = req.body;
    if (!['active', 'paused', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'Status must be active, paused or closed' });
    }
    try {
      await db.collection('queues').doc(id).update({ status });
      return res.json({ success: true, status });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update queue' });
    }
  }

  // ── DELETE (admin) ─────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    try {
      const entriesSnap = await db
        .collection('queues').doc(id)
        .collection('entries').get();

      const batch = db.batch();
      entriesSnap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(db.collection('queues').doc(id));
      await batch.commit();

      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to delete queue' });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
};
