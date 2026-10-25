ALTER TABLE proposals ADD COLUMN design_json TEXT;
CREATE TABLE design_references (
  proposal_id TEXT PRIMARY KEY REFERENCES proposals(id) ON DELETE CASCADE,
  bytes BLOB NOT NULL
);
