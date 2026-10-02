import json
import os
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from psycopg_pool import ConnectionPool

DATABASE_URL = os.environ["DATABASE_URL"]
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")
pool = ConnectionPool(DATABASE_URL, min_size=1, max_size=8)

app = FastAPI(title="WebGIS Ekologis API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[x.strip() for x in CORS_ORIGINS.split(",")] if CORS_ORIGINS != "*" else ["*"],
    allow_credentials=CORS_ORIGINS != "*",
    allow_methods=["*"],
    allow_headers=["*"],
)

class ObservationIn(BaseModel):
    site_id: str
    surveyor_name: str | None = None
    survey_status: str | None = None
    notes: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    accuracy_m: float | None = None
    payload: dict[str, Any] = Field(default_factory=dict)

@app.get("/api/health")
def health():
    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT PostGIS_Version()")
        postgis = cur.fetchone()[0]
        cur.execute("SELECT to_regclass('gis.final_sites')")
        final_sites = cur.fetchone()[0] is not None
    return {"ok": True, "postgis": postgis, "final_sites_loaded": final_sites}

@app.get("/api/sites")
def sites():
    sql = """
    SELECT jsonb_build_object(
      'type','Feature',
      'id', COALESCE(site_id::text, candidate_id::text),
      'geometry', ST_AsGeoJSON(ST_Transform(geometry,4326), 6)::jsonb,
      'properties', to_jsonb(t) - 'geometry'
    )
    FROM gis.final_sites t
    ORDER BY site_id NULLS LAST, candidate_id NULLS LAST
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
        cur.execute(sql, (site_id,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Site not found")
    return row[0]

@app.post("/api/observations")
def create_observation(body: ObservationIn):
    sql = """
      INSERT INTO field.site_observation
      (site_id, surveyor_name, survey_status, notes, latitude, longitude, accuracy_m, payload)
      VALUES (%s,%s,%s,%s,%s,%s,%s,%s::jsonb)
      RETURNING id, observed_at
    """
    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute(sql, (
            body.site_id, body.surveyor_name, body.survey_status, body.notes,
            body.latitude, body.longitude, body.accuracy_m, json.dumps(body.payload)
        ))
        row = cur.fetchone()
        conn.commit()
    if not row:
        raise HTTPException(500, "Failed to save observation")
    return {"id": str(row[0]), "observed_at": row[1]}
