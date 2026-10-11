import json
import os
import secrets
from typing import Any
from uuid import UUID

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from psycopg_pool import ConnectionPool

DATABASE_URL = os.environ["DATABASE_URL"]
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")
FIELD_WRITE_TOKEN = os.getenv("FIELD_WRITE_TOKEN", "").strip()

pool = ConnectionPool(DATABASE_URL, min_size=1, max_size=8)

app = FastAPI(title="WebGIS Ekologis API", version="0.3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[x.strip() for x in CORS_ORIGINS.split(",")] if CORS_ORIGINS != "*" else ["*"],
    allow_credentials=CORS_ORIGINS != "*",
    allow_methods=["*"],
    allow_headers=["*"],
)

class ObservationIn(BaseModel):
    client_id: UUID | None = None
    site_id: str
    surveyor_name: str | None = None
    survey_status: str | None = None
    detection_status: str | None = None
    effort_minutes: float | None = Field(default=None, ge=0)
    notes: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    accuracy_m: float | None = Field(default=None, ge=0)
    payload: dict[str, Any] = Field(default_factory=dict)

def check_write_token(value: str | None) -> None:
    if FIELD_WRITE_TOKEN and (not value or not secrets.compare_digest(value, FIELD_WRITE_TOKEN)):
        raise HTTPException(401, "Field write token required")

@app.get("/api/health")
def health():
    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT PostGIS_Version()")
        postgis = cur.fetchone()[0]
        cur.execute("SELECT to_regclass('gis.final_sites')")
        final_sites = cur.fetchone()[0] is not None
    return {
        "ok": True,
        "postgis": postgis,
        "final_sites_loaded": final_sites,
        "write_protected": bool(FIELD_WRITE_TOKEN),
    }

@app.get("/api/sites")
def sites():
    sql = """
    SELECT jsonb_build_object(
      'type','Feature',
      'id', site_id::text,
      'geometry', ST_AsGeoJSON(ST_Transform(geometry,4326), 6)::jsonb,
      'properties', to_jsonb(t) - 'geometry'
    )
    FROM gis.final_sites t
    ORDER BY site_id
    """
    try:
        with pool.connection() as conn, conn.cursor() as cur:
            cur.execute(sql)
            features = [r[0] for r in cur.fetchall()]
    except Exception as exc:
        raise HTTPException(503, f"Final GIS layer belum diimport: {exc}") from exc
    return {"type": "FeatureCollection", "features": features}

@app.get("/api/site/{site_id}")
def site_detail(site_id: str):
    sql = """
    SELECT jsonb_build_object(
      'type','Feature',
      'geometry', ST_AsGeoJSON(ST_Transform(geometry,4326), 6)::jsonb,
      'properties', to_jsonb(t) - 'geometry'
    )
    FROM gis.final_sites t
    WHERE site_id = %s
    LIMIT 1
    """
    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT 1 FROM gis.final_sites WHERE site_id = %s LIMIT 1", (body.site_id,))
        if not cur.fetchone():
            raise HTTPException(404, "Unknown final survey site")

        cur.execute(sql, (site_id,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Site not found")
    return row[0]

@app.get("/api/progress")
def progress():
    sql = """
    SELECT
      fs.site_id,
      o.survey_status,
      o.detection_status,
      o.observed_at
    FROM gis.final_sites fs
    LEFT JOIN LATERAL (
      SELECT survey_status, detection_status, observed_at
      FROM field.site_observation
      WHERE site_id = fs.site_id
      ORDER BY observed_at DESC
      LIMIT 1
    ) o ON TRUE
    ORDER BY fs.site_id
    """
    try:
        with pool.connection() as conn, conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()
    except Exception as exc:
        raise HTTPException(503, f"Progress belum tersedia: {exc}") from exc

    latest = []
    status_counts: dict[str, int] = {}
    visited = 0
    for site_id, survey_status, detection_status, observed_at in rows:
        status = survey_status or "Belum dikunjungi"
        if status != "Belum dikunjungi":
            visited += 1
        status_counts[status] = status_counts.get(status, 0) + 1
        latest.append({
            "site_id": site_id,
            "survey_status": status,
            "detection_status": detection_status,
            "observed_at": observed_at,
        })

    return {
        "total": len(rows),
        "visited": visited,
        "remaining": max(len(rows) - visited, 0),
        "status_counts": status_counts,
        "latest": latest,
    }

@app.post("/api/observations")
def create_observation(
    body: ObservationIn,
    x_field_token: str | None = Header(default=None),
):
    check_write_token(x_field_token)

    sql = """
      INSERT INTO field.site_observation
      (
        client_id, site_id, surveyor_name, survey_status, detection_status,
        effort_minutes, notes, latitude, longitude, accuracy_m, location, payload
      )
      VALUES (
        %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
        CASE
          WHEN %s IS NOT NULL AND %s IS NOT NULL
          THEN ST_SetSRID(ST_MakePoint(%s,%s),4326)
          ELSE NULL
        END,
        %s::jsonb
      )
      ON CONFLICT (client_id) DO UPDATE SET
        surveyor_name = EXCLUDED.surveyor_name,
        survey_status = EXCLUDED.survey_status,
        detection_status = EXCLUDED.detection_status,
        effort_minutes = EXCLUDED.effort_minutes,
        notes = EXCLUDED.notes,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        accuracy_m = EXCLUDED.accuracy_m,
        location = EXCLUDED.location,
        payload = EXCLUDED.payload,
        observed_at = now()
      RETURNING id, observed_at
    """
    cid = str(body.client_id) if body.client_id else None
    payload = json.dumps(body.payload)

    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute(sql, (
            cid,
            body.site_id,
            body.surveyor_name,
            body.survey_status,
            body.detection_status,
            body.effort_minutes,
            body.notes,
            body.latitude,
            body.longitude,
            body.accuracy_m,
            body.longitude,
            body.latitude,
            body.longitude,
            body.latitude,
            payload,
        ))
        row = cur.fetchone()
        conn.commit()

    if not row:
        raise HTTPException(500, "Failed to save observation")
    return {"id": str(row[0]), "observed_at": row[1], "client_id": cid}
