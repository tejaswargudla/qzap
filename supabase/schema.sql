-- QueueZap schema — run this in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS queues (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  category    TEXT        NOT NULL DEFAULT '📦 Other',
  lat         FLOAT       NOT NULL DEFAULT 0,
  lng         FLOAT       NOT NULL DEFAULT 0,
  radius      INTEGER     NOT NULL DEFAULT 100,
  description TEXT        NOT NULL DEFAULT '',
  demo        BOOLEAN     NOT NULL DEFAULT FALSE,
  status      TEXT        NOT NULL DEFAULT 'active',  -- active | paused | closed
  admin_id    TEXT        NOT NULL,
  queue_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entries (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id   UUID        NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  email      TEXT        NOT NULL DEFAULT '',
  fcm_token  TEXT        NOT NULL DEFAULT '',
  position   INTEGER     NOT NULL,
  status     TEXT        NOT NULL DEFAULT 'waiting',  -- waiting | done
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_entries_queue_status    ON entries(queue_id, status);
CREATE INDEX IF NOT EXISTS idx_entries_queue_pos       ON entries(queue_id, status, position);
CREATE INDEX IF NOT EXISTS idx_queues_admin_created    ON queues(admin_id, created_at DESC);
