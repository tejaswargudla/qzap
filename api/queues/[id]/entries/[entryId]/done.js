const webpush = require('web-push');
const { supabase } = require('../../../../_supabase');
const { cors, requireAdmin } = require('../../../../_helpers');

webpush.setVapidDetails(
  'mailto:admin@queuezap.app',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// PATCH /api/queues/[id]/entries/[entryId]/done
// Admin marks entry as done, then notifies the next people in line
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  const adminUser = await requireAdmin(req, res);
  if (!adminUser) return;

  const { id: queueId, entryId } = req.query;

  try {
    const { error } = await supabase.from('entries').update({ status: 'done' }).eq('id', entryId);
    if (error) throw error;

    // Fetch next 2 waiting entries to notify them
    const { data: next } = await supabase
      .from('entries')
      .select('id, name, push_subscription, position')
      .eq('queue_id', queueId)
      .eq('status', 'waiting')
      .order('position', { ascending: true })
      .limit(2);

    const remaining = next ? next.length : 0;

    if (next && next.length > 0) {
      const notifications = next.map((entry, i) => {
        if (!entry.push_subscription) return null;
        try {
          const sub = JSON.parse(entry.push_subscription);
          const isNext = i === 0;
          const payload = JSON.stringify({
            title: isNext ? "You're next! 🎉" : "Almost your turn ⏳",
            body: isNext
              ? `${entry.name}, head to the counter now — it's your turn!`
              : `${entry.name}, one more person ahead of you. Get ready!`,
          });
          return webpush.sendNotification(sub, payload).catch(err => {
            console.warn(`Push failed for entry ${entry.id}:`, err.message);
          });
        } catch (e) {
          return null;
        }
      }).filter(Boolean);

      await Promise.allSettled(notifications);
    }

    res.json({ success: true, remaining });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark entry as done' });
  }
};
