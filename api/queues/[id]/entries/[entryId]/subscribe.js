const { supabase } = require('../../../../_supabase');
const { cors } = require('../../../../_helpers');

// POST /api/queues/[id]/entries/[entryId]/subscribe
// Save a Web Push subscription for an entry so we can notify the user later
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { entryId } = req.query;
  const { subscription } = req.body;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'subscription is required' });
  }

  try {
    const { error } = await supabase
      .from('entries')
      .update({ push_subscription: JSON.stringify(subscription) })
      .eq('id', entryId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
};
