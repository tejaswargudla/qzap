const { supabase } = require('../../../../_supabase');
const { cors, requireAdmin } = require('../../../../_helpers');

// DELETE /api/queues/[id]/entries/[entryId]/remove
// Admin removes a person from the queue
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { entryId } = req.query;

  try {
    const { error } = await supabase.from('entries').delete().eq('id', entryId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove entry' });
  }
};
