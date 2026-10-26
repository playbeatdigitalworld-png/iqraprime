CREATE TABLE IF NOT EXISTS catalog_channels (
  channel_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  raw_name TEXT,
  logo_url TEXT,
  group_title TEXT NOT NULL DEFAULT 'General',
  category TEXT NOT NULL DEFAULT 'Entertainment',
  epg_id TEXT,
  stream_id TEXT NOT NULL,
  last_synced_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_catalog_channels_group
  ON catalog_channels(group_title);

CREATE INDEX IF NOT EXISTS idx_catalog_channels_category
  ON catalog_channels(category);

CREATE TABLE IF NOT EXISTS epg_programs (
  channel_id TEXT NOT NULL,
  programme_id TEXT NOT NULL,
  title TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  description TEXT,
  category TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (channel_id, programme_id),
  FOREIGN KEY (channel_id) REFERENCES catalog_channels(channel_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_epg_programs_channel_time
  ON epg_programs(channel_id, start_at, end_at);
