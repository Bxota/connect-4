# Deployment (Docker + Caddy)

1) Copy this folder to `/opt/connect-4` on the VPS.
2) Create a `.env` file from `.env.example` and set `ALLOWED_ORIGINS` to your domain.
3) Ensure the shared Docker network exists (one-time):

```bash
docker network create web
```

4) Run:

```bash
cd /opt/connect-4
sudo docker compose up -d
```

Notes:
- Add this site block to your existing Caddyfile:

```
power-4.bxota.com {
  reverse_proxy app:8080
}
```

- Make sure your existing Caddy container is also attached to the `web` network.

## GitHub Actions auto-deploy

The workflow `.github/workflows/docker-publish.yml` builds/pushes and then deploys via SSH.
Add these secrets to the repo:
- `VPS_HOST` (server IP or hostname)
- `VPS_USER` (SSH user)
- `VPS_SSH_KEY` (private key content)
