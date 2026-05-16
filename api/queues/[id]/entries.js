const { supabase } = require('../../_supabase');
const { cors, requireAdmin } = require('../../_helpers');

// GET /api/queues/[id]/entries — admin fetches full waiting list
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { id: queueId } = req.query;

  try {
    const { data, error } = await supabase
      .from('entries')
      .select('id, name, email, position, joined_at')
      .eq('queue_id', queueId)
      .eq('status', 'waiting')
      .order('position', { ascending: true });

    if (error) throw error;

    const entries = data.map(e => ({ ...e, joinedAt: e.joined_at }));
    res.json({ entries });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
};
