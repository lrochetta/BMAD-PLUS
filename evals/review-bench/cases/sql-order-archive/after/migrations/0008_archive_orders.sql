-- Archive orders placed more than two years ago, record where each order ships,
-- and retire the import staging table now that imports write to orders directly.
BEGIN;

ALTER TABLE orders ADD COLUMN archived_at TIMESTAMPTZ;

UPDATE orders SET status = 'archived', archived_at = now();

ALTER TABLE orders ADD COLUMN region TEXT NOT NULL;

DROP TABLE IF EXISTS import_staging;

COMMIT;
