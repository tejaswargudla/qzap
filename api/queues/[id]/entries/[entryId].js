const { db }  = require('../../../_firebase');
const { cors } = require('../../../_helpers');

// GET /api/queues/[id]/entries/[entryId]
// Public — user polls their current position
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id: queueId, entryId } = req.query;

  try {
    const entryDoc = await db
      .collection('queues').doc(queueId)
      .collection('entries').doc(entryId).get();

    if (!entryDoc.exists) return res.status(404).json({ error: 'Entry not found' });

    const entry = entryDoc.data();

    // Count how many waiting entries are still ahead of this person
    const aheadSnap = await db
      .collection('queues').doc(queueId)
      .collection('entries')
      .where('status', '==', 'waiting')
      .where('position', '<', entry.position)
      .get();

    const currentPosition = aheadSnap.size + 1;

    res.json({
      entryId:       entry.id,
      name:          entry.name,
      position:      currentPosition,
      status:        entry.status,
      estimatedWait: currentPosition * 4,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch position' });
  }
};
