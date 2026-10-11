# Existing Host Caddy Deployment

Use this mode when ports 80/443 are already owned by a host-level Caddy service.

## Why
The bundled Docker Caddy service must NOT be started in this case, otherwise Docker will fail to bind ports 80/443.

## Internal localhost ports
- FastAPI: 127.0.0.1:8010
- Martin: 127.0.0.1:3010
- TiTiler: 127.0.0.1:8011
- Frontend: served directly by the existing host Caddy from /opt/webgisekologis/frontend

These ports are loopback-only and are not exposed publicly.

## Deploy
~~~bash
cd /opt/webgisekologis
cp .env.example .env
# edit .env
bash ops/deploy-external-caddy.sh
~~~

## Caddy
Copy the site block from:
~~~text
infra/Caddyfile.external.example
~~~
into the host Caddy configuration, replace gis.example.com with the real domain, validate, then reload:

~~~bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
~~~

If your host Caddy configuration uses import files or another config path, add the block to the appropriate imported file instead of overwriting /etc/caddy/Caddyfile.

## Do not
Do not run:
~~~bash
bash ops/deploy.sh
~~~
on a host where ports 80/443 are already occupied.
