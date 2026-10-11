# VPS Setup — WebGIS Ekologis

## Minimum practical server
- Ubuntu 24.04 LTS
- 4 vCPU
- 8 GB RAM
- 80–160 GB SSD
- public IPv4
- domain/subdomain pointing to VPS

## 1. Install Docker
Use the official Docker Engine repository for Ubuntu, then verify:

~~~bash
docker --version
docker compose version
~~~

## 2. Clone

~~~bash
sudo mkdir -p /opt/webgisekologis
sudo chown "$USER":"$USER" /opt/webgisekologis
git clone --depth 1 https://github.com/XGamingTechnology/webgisekologis.git /opt/webgisekologis
cd /opt/webgisekologis
~~~

## 3. Environment

~~~bash
cp .env.example .env
nano .env
~~~

Required: DOMAIN, strong POSTGRES_PASSWORD, strong FIELD_WRITE_TOKEN, and CORS_ORIGINS=https://<DOMAIN>.
Never commit the .env file.

## 4. Final GIS Package
Extract Notebook 06 output under data/import/YYYYMMDD_FINAL_GIS_PACKAGE_D1/. The importer requires at minimum Final_Sites_Access_Review.gpkg.

## 5. Deploy

~~~bash
bash ops/deploy.sh
~~~

When DNS is active, Caddy requests HTTPS automatically.

## 6. Field device
Open the HTTPS site on the survey phone, fill surveyor name, enter the Field Write Token, save device settings, and optionally install the PWA. Records stay local when connection fails and are queued for synchronization.

## 7. Validation

~~~bash
bash ops/smoke-test.sh
~~~

The progress endpoint should report total=30 after the final package is imported.

## Backups
Back up PostGIS, data/import, data/rasters, and .env secrets in a secure secret store. Do not use Git for large GIS source files or secrets. The production frontend is isolated under frontend/, while data/import, data/rasters, and data/backups are runtime-only paths.
