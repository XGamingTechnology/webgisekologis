CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS gis;
CREATE SCHEMA IF NOT EXISTS field;

CREATE TABLE IF NOT EXISTS field.site_observation (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid,
    site_id text NOT NULL,
    surveyor_name text,
    survey_status text,
    detection_status text,
    effort_minutes numeric,
    notes text,
    observed_at timestamptz DEFAULT now(),
    latitude double precision,
    longitude double precision,
    accuracy_m double precision,
    location geometry(Point,4326),
    payload jsonb DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_site_observation_client_id
ON field.site_observation(client_id);

CREATE INDEX IF NOT EXISTS idx_site_observation_site_id
ON field.site_observation(site_id);

CREATE INDEX IF NOT EXISTS idx_site_observation_observed_at
ON field.site_observation(observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_site_observation_location
ON field.site_observation USING GIST(location);
