const { supabase } = require('../_supabase');
const { cors, requireAdmin } = require('../_helpers');

// GET /api/queues/stats — dashboard summary for the logged-in admin
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  try {
    // All queues for this admin
    const { data: queues, error: qErr } = await supabase
      .from('queues')
      .select('id, status')
      .eq('admin_id', admin.uid);
    if (qErr) throw qErr;

    const queueIds = queues.map(q => q.id);
    const activeCount = queues.filter(q => q.status === 'active').length;

    if (queueIds.length === 0) {
      return res.json({ servedToday: 0, totalQueues: 0, activeCount: 0, totalWaiting: 0, avgWaitMinutes: 0 });
    }

    // Start of today (local midnight → UTC)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Served today = done entries joined today across all admin queues
    const { count: servedToday } = await supabase
      .from('entries')
      .select('*', { count: 'exact', head: true })
      .in('queue_id', queueIds)
      .eq('status', 'done')
      .gte('joined_at', todayStart.toISOString());

    // Total currently waiting
    const { count: totalWaiting } = await supabase
      .from('entries')
      .select('*', { count: 'exact', head: true })
      .in('queue_id', queueIds)
      .eq('status', 'waiting');

    // Avg wait = (totalWaiting / activeQueues) * 4 min per person
    const avgWaitMinutes = activeCount > 0
      ? Math.round((totalWaiting / activeCount) * 4)
      : 0;

    res.json({
      totalQueues:    queues.length,
      activeCount,
      totalWaiting:   totalWaiting ?? 0,
      servedToday:    servedToday  ?? 0,
      avgWaitMinutes,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};
