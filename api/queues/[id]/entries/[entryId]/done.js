const { db, admin } = require('../../../_firebase');
const { cors, requireAdmin } = require('../../../_helpers');

// PATCH /api/queues/[id]/entries/[entryId]/done
// Admin marks entry as done → sends push notification to next person in line
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  const adminUser = await requireAdmin(req, res);
  if (!adminUser) return;

  const { id: queueId, entryId } = req.query;

  try {
    // 1. Mark this entry as done
    await db.collection('queues').doc(queueId)
      .collection('entries').doc(entryId)
      .update({ status: 'done' });

    // 2. Get remaining waiting entries in order
    const waitingSnap = await db
      .collection('queues').doc(queueId)
      .collection('entries')
      .where('status', '==', 'waiting')
      .orderBy('position', 'asc')
      .get();

    // 3. Send push notification to next person (position 1)
    if (!waitingSnap.empty) {
      const next = waitingSnap.docs[0].data();
      if (next.fcmToken) {
        try {
          await admin.messaging().send({
            token: next.fcmToken,
            notification: {
              title: "⚡ You're next!",
              body:  `Get ready ${next.name}, it's almost your turn!`,
            },
          });
        } catch (e) { console.warn('FCM next failed:', e.message); }
      }

      // 4. Also notify the person who is now 2nd ("get ready soon")
      if (waitingSnap.docs.length >= 2) {
        const second = waitingSnap.docs[1].data();
        if (second.fcmToken) {
          try {
            await admin.messaging().send({
              token: second.fcmToken,
              notification: {
                title: '🔔 Almost your turn',
                body:  `${second.name}, 2 more ahead of you — get ready!`,
              },
            });
          } catch (e) { console.warn('FCM 2nd failed:', e.message); }
        }
      }
    }

    res.json({ success: true, remaining: waitingSnap.size });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark entry as done' });
  }
};
