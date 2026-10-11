CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS gis;
CREATE SCHEMA IF NOT EXISTS field;

CREATE TABLE IF NOT EXISTS field.site_observation (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id text NOT NULL,
    surveyor_name text,
    survey_status text,
    notes text,
    observed_at timestamptz DEFAULT now(),
    latitude double precision,
    longitude double precision,
    accuracy_m double precision,
    payload jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_site_observation_site_id
ON field.site_observation(site_id);
