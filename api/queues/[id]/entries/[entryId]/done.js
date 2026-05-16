const webpush = require('web-push');
const { Resend } = require('resend');
const { supabase } = require('../../../../_supabase');
const { cors, requireAdmin } = require('../../../../_helpers');

webpush.setVapidDetails(
  'mailto:admin@queuezap.app',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendEmail(to, name, isNext, queueName) {
  if (!to || !process.env.RESEND_API_KEY) return;
  const subject = isNext ? "It's your turn! 🎉" : "Get ready — you're almost up ⏳";
  const body = isNext
    ? `Hi ${name},<br><br>It's your turn now! Please proceed to the counter.<br><br>— ${queueName} via QueueZap ⚡`
    : `Hi ${name},<br><br>One more person ahead of you — get ready!<br><br>— ${queueName} via QueueZap ⚡`;

  await resend.emails.send({
    from: 'QueueZap <notifications@queuezap.app>',
    to,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem;">
        <div style="background:#FF6B35;color:#fff;border-radius:12px 12px 0 0;padding:1.2rem 1.5rem;">
          <strong style="font-size:1.2rem;">QueueZap ⚡</strong>
        </div>
        <div style="background:#f9f9f9;border:1px solid #eee;border-radius:0 0 12px 12px;padding:1.5rem;">
          <h2 style="margin:0 0 0.75rem;">${subject}</h2>
          <p style="color:#555;line-height:1.6;">${body}</p>
        </div>
      </div>`,
  }).catch(err => console.warn('Email failed:', err.message));
}

// PATCH /api/queues/[id]/entries/[entryId]/done
// Admin marks entry as done, then notifies next 2 people via push + email
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  const adminUser = await requireAdmin(req, res);
  if (!adminUser) return;

  const { id: queueId, entryId } = req.query;

  try {
    const { error } = await supabase.from('entries').update({ status: 'done' }).eq('id', entryId);
    if (error) throw error;

    // Fetch queue name for email
    const { data: queue } = await supabase.from('queues').select('name').eq('id', queueId).single();
    const queueName = queue?.name || 'Queue';

    // Fetch next 2 waiting entries
    const { data: next } = await supabase
      .from('entries')
      .select('id, name, email, push_subscription, position')
      .eq('queue_id', queueId)
      .eq('status', 'waiting')
      .order('position', { ascending: true })
      .limit(2);

    const remaining = next ? next.length : 0;

    if (next && next.length > 0) {
      const notifications = next.flatMap((entry, i) => {
        const isNext = i === 0;
        const tasks = [];

        // Push notification
        if (entry.push_subscription) {
          try {
            const sub = JSON.parse(entry.push_subscription);
            const payload = JSON.stringify({
              title: isNext ? "You're next! 🎉" : "Almost your turn ⏳",
              body: isNext
                ? `${entry.name}, head to the counter now!`
                : `${entry.name}, one more person ahead. Get ready!`,
            });
            tasks.push(webpush.sendNotification(sub, payload).catch(err =>
              console.warn(`Push failed for ${entry.id}:`, err.message)
            ));
          } catch (e) { /* invalid subscription JSON */ }
        }

        // Email notification
        if (entry.email) {
          tasks.push(sendEmail(entry.email, entry.name, isNext, queueName));
        }

        return tasks;
      });

      await Promise.allSettled(notifications);
    }

    res.json({ success: true, remaining });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark entry as done' });
  }
};
