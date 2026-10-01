import os
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from psycopg_pool import ConnectionPool

DATABASE_URL = os.environ["DATABASE_URL"]
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")

pool = ConnectionPool(DATABASE_URL, min_size=1, max_size=5)

app = FastAPI(title="WebGIS Ekologis API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[x.strip() for x in CORS_ORIGINS.split(",")] if CORS_ORIGINS != "*" else ["*"],
    allow_credentials=True,
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
    payload: dict[str, Any] = {}

@app.get("/api/health")
def health():
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT PostGIS_Version()")
            postgis = cur.fetchone()[0]
    return {"ok": True, "postgis": postgis}

@app.post("/api/observations")
def create_observation(body: ObservationIn):
    sql = """
        INSERT INTO field.site_observation
        (site_id, surveyor_name, survey_status, notes, latitude, longitude, accuracy_m, payload)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s::jsonb)
        RETURNING id, observed_at
    """
    import json
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (
                body.site_id, body.surveyor_name, body.survey_status, body.notes,
                body.latitude, body.longitude, body.accuracy_m, json.dumps(body.payload)
            ))
            row = cur.fetchone()
        conn.commit()
    if not row:
        raise HTTPException(500, "Failed to save observation")
    return {"id": str(row[0]), "observed_at": row[1]}
