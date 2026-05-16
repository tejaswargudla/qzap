const { supabase } = require('../_supabase');
const { cors, requireAdmin } = require('../_helpers');

// /api/queues/[id]
// GET    — public, fetch queue info
// PATCH  — admin updates queue status
// DELETE — admin deletes queue + all entries (cascade)
module.exports = async (req, res) => {
  if (cors(req, res)) return;

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Queue id is required' });

  // ── GET (public) ───────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const { data: q, error } = await supabase.from('queues').select('*').eq('id', id).single();
      if (error || !q) return res.status(404).json({ error: 'Queue not found' });

      const { count: waitingCount } = await supabase
        .from('entries')
        .select('*', { count: 'exact', head: true })
        .eq('queue_id', id)
        .eq('status', 'waiting');

      return res.json({
        id:            q.id,
        name:          q.name,
        category:      q.category,
        description:   q.description,
        status:        q.status,
        waitingCount:  waitingCount ?? 0,
        estimatedWait: (waitingCount ?? 0) * 4,
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
      const { error } = await supabase.from('queues').update({ status }).eq('id', id);
      if (error) throw error;
      return res.json({ success: true, status });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update queue' });
    }
  }

  // ── DELETE (admin — cascade deletes entries via FK) ───────────────────────
  if (req.method === 'DELETE') {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    try {
      const { error } = await supabase.from('queues').delete().eq('id', id);
      if (error) throw error;
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to delete queue' });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
};
