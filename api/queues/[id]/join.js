const { v4: uuid } = require('uuid');
const { supabase } = require('../../_supabase');
const { cors, getDistanceMeters } = require('../../_helpers');

// POST /api/queues/[id]/join
// User joins a queue — location is verified server-side
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id: queueId } = req.query;
  const { name, email = '', userLat, userLng, fcmToken = '' } = req.body;

  if (!name || userLat == null || userLng == null) {
    return res.status(400).json({ error: 'name, userLat and userLng are required' });
  }

  try {
    // 1. Fetch queue
    const { data: queue, error: qErr } = await supabase.from('queues').select('*').eq('id', queueId).single();
    if (qErr || !queue) return res.status(404).json({ error: 'Queue not found' });

    // 2. Queue must be active
    if (queue.status !== 'active') {
      return res.status(403).json({ error: `Queue is currently ${queue.status}` });
    }

    // 3. Location check
    const distance = getDistanceMeters(parseFloat(userLat), parseFloat(userLng), queue.lat, queue.lng);
    if (distance > queue.radius) {
      return res.status(403).json({
        error:    `You are ${Math.round(distance)}m away. Must be within ${queue.radius}m.`,
        distance: Math.round(distance),
        allowed:  false,
      });
    }

    // 4. Count waiting entries to assign position
    const { count: waitingCount } = await supabase
      .from('entries')
      .select('*', { count: 'exact', head: true })
      .eq('queue_id', queueId)
      .eq('status', 'waiting');

    const position = (waitingCount ?? 0) + 1;

    // 5. Save entry
    const entryId = uuid();
    const { error: iErr } = await supabase.from('entries').insert({
      id:        entryId,
      queue_id:  queueId,
      name,
      email,
      fcm_token: fcmToken,
      position,
      status:    'waiting',
    });
    if (iErr) throw iErr;

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
