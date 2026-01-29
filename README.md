# connect-4

Vue Web + Go WebSocket backend for real-time Connect 4.

## Backend (Go)

```bash
cd server
# Go 1.24+
go run .
```

By default the server listens on `:8060` and exposes:

- `GET /health`
- `WS /ws`
- static web files (if available)

## Web frontend

```bash
cd webapp
npm install
npm run dev
```

Build + serve with Go:

```bash
cd webapp
npm run build
cd ../server
WEB_DIR=../webapp/dist go run .
```

### WebSocket override

```text
VITE_WS_URL=wss://power-4.bxota.com/ws npm run build
```

## Deployment (Docker + Caddy + GitHub Actions)

Includes:
- `deploy/docker-compose.yml` (app only, shared Caddy)
- `deploy/Caddyfile` (site block template)
- `.github/workflows/docker-publish.yml` (build + push + deploy)

### Configure the deployment folder

Copy `deploy/` to `/opt/connect-4` on the VPS and update:
- `deploy/Caddyfile` with your domain
- `deploy/.env` (from `.env.example`) with `ALLOWED_ORIGINS`

Then:

```bash
cd /opt/connect-4
docker compose up -d
```

### GitHub Actions secrets

Add these repo secrets for auto-deploy:
- `VPS_HOST` (server IP or hostname)
- `VPS_USER` (SSH user)
- `VPS_SSH_KEY` (private key content)

## Notes

- Rooms are private (6-letter code).
- Rules are enforced server-side.
- Reconnect: a player has 1 minute to reconnect before the room closes.
