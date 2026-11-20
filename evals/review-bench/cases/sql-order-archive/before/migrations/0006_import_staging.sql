-- Scratch table for the nightly import: each run fills it, merges it into orders
-- and leaves it behind. Nothing else reads it.
CREATE TABLE import_staging (
  external_id TEXT NOT NULL,
  payload JSONB NOT NULL
);
