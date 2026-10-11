ALTER TABLE field.site_observation
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS detection_status text,
  ADD COLUMN IF NOT EXISTS effort_minutes numeric,
  ADD COLUMN IF NOT EXISTS location geometry(Point,4326);

DROP INDEX IF EXISTS field.uq_site_observation_client_id;
CREATE UNIQUE INDEX uq_site_observation_client_id
ON field.site_observation(client_id);

CREATE INDEX IF NOT EXISTS idx_site_observation_observed_at
ON field.site_observation(observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_site_observation_location
ON field.site_observation USING GIST(location);
