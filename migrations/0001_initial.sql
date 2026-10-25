CREATE TABLE IF NOT EXISTS proposals (
 id TEXT PRIMARY KEY, owner TEXT NOT NULL, place_id TEXT NOT NULL, style_id TEXT NOT NULL,
 author TEXT NOT NULL, title TEXT NOT NULL, instructions TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'queued', brief TEXT, caption TEXT, image_key TEXT, error TEXT,
 created_at INTEGER NOT NULL, published_at INTEGER, votes INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS proposals_published ON proposals(published_at DESC);
CREATE INDEX IF NOT EXISTS proposals_owner ON proposals(owner,created_at DESC);
CREATE TABLE IF NOT EXISTS votes(proposal_id TEXT NOT NULL REFERENCES proposals(id), visitor TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(proposal_id,visitor));
CREATE TABLE IF NOT EXISTS image_parts(proposal_id TEXT NOT NULL REFERENCES proposals(id), part INTEGER NOT NULL, bytes BLOB NOT NULL, PRIMARY KEY(proposal_id,part));
