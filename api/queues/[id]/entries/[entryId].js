const { supabase } = require('../../../_supabase');
const { cors } = require('../../../_helpers');

// GET /api/queues/[id]/entries/[entryId]
// Public — user polls their current position
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { entryId } = req.query;

  try {
    const { data: entry, error } = await supabase.from('entries').select('*').eq('id', entryId).single();
    if (error || !entry) return res.status(404).json({ error: 'Entry not found' });

    // Count waiting entries still ahead of this person
    const { count: aheadCount } = await supabase
      .from('entries')
      .select('*', { count: 'exact', head: true })
      .eq('queue_id', entry.queue_id)
      .eq('status', 'waiting')
      .lt('position', entry.position);

    const currentPosition = (aheadCount ?? 0) + 1;

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
