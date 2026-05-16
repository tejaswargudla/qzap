const { supabase } = require('../_supabase');
const { cors, requireAdmin } = require('../_helpers');

// GET /api/queues/list — admin fetches all their queues
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  try {
    const { data: queues, error } = await supabase
      .from('queues')
      .select('*')
      .eq('admin_id', admin.uid)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const queuesWithCount = await Promise.all(queues.map(async q => {
      const { count } = await supabase
        .from('entries')
        .select('*', { count: 'exact', head: true })
        .eq('queue_id', q.id)
        .eq('status', 'waiting');
      return { ...q, adminId: q.admin_id, queueUrl: q.queue_url, createdAt: q.created_at, waitingCount: count ?? 0 };
    }));

    res.json({ queues: queuesWithCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch queues' });
  }
};
