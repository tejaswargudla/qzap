const { v4: uuid } = require('uuid');
const { db }       = require('../../_firebase');
const { cors, getDistanceMeters } = require('../../_helpers');

// POST /api/queues/[id]/join
// User joins a queue — location is verified server-side
// Body: { name, email?, userLat, userLng, fcmToken? }
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id: queueId } = req.query;
  const { name, email = '', userLat, userLng, fcmToken = '' } = req.body;

  if (!name || !userLat || !userLng) {
    return res.status(400).json({ error: 'name, userLat and userLng are required' });
  }

  try {
    // 1. Fetch queue
    const queueDoc = await db.collection('queues').doc(queueId).get();
    if (!queueDoc.exists) return res.status(404).json({ error: 'Queue not found' });
    const queue = queueDoc.data();

    // 2. Queue must be active
    if (queue.status !== 'active') {
      return res.status(403).json({ error: `Queue is currently ${queue.status}` });
    }

    // 3. Location check
    const distance = getDistanceMeters(
      parseFloat(userLat), parseFloat(userLng),
      queue.lat, queue.lng
    );
    if (distance > queue.radius) {
      return res.status(403).json({
        error: `You are ${Math.round(distance)}m away. Must be within ${queue.radius}m.`,
        distance: Math.round(distance),
        allowed: false,
      });
    }

    // 4. Count waiting entries to assign position
    const waitingSnap = await db
      .collection('queues').doc(queueId)
      .collection('entries')
      .where('status', '==', 'waiting').get();
    const position = waitingSnap.size + 1;

    // 5. Save entry
    const entryId = uuid();
    await db.collection('queues').doc(queueId)
      .collection('entries').doc(entryId)
      .set({
        id: entryId, queueId, name, email, fcmToken,
        position, status: 'waiting',
        joinedAt: new Date().toISOString(),
      });

    res.status(201).json({
      entryId,
      position,
      estimatedWait: position * 4,
      message: `You are #${position} in the queue`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to join queue' });
  }
};
