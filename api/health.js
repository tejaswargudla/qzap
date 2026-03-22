const { cors } = require('./_helpers');

// GET /api/health
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  res.json({ status: 'ok', app: 'QueueZap', time: new Date().toISOString() });
};
