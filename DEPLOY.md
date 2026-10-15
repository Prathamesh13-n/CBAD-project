# Deploying CDAD

CDAD is one container: the Express API, the static frontend and a SQLite file.
It needs a **persistent disk** (the `cdad-data` volume) and a **long-running
process**, so host it on anything that runs Docker — a VPS, a college server,
Render/Railway/Fly with a volume — not on a "static site" or "serverless"
host.

## 1. Run it with Docker Compose

```bash
cp .env.example .env        # then edit .env (see below)
docker compose up -d --build
```

Open `http://<server>:3000` (or the `PORT` you set). Useful commands:

```bash
docker compose logs -f cdad     # logs
docker compose up -d --build    # update after `git pull`
docker compose down             # stop; data stays in the cdad-data volume
```

Everything lives in the `cdad-data` volume (`/app/server/data`): the SQLite
database and, unless you use Appwrite, the uploaded files. **Back it up**:

```bash
docker run --rm -v cdad-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/cdad-data-$(date +%F).tgz -C /data .
```

## 2. Settings (`.env`)

| Variable | What it does |
|---|---|
| `PORT` | Host port to publish (default 3000) |
| `SKIP_SEED=true` | **Use this for a real deployment.** Skips the demo students/faculty. The default admin is still created |
| `COOKIE_SECURE=true` | Send the login cookie only over HTTPS (turn on once you have TLS) |
| `TRUST_PROXY=true` | Trust `X-Forwarded-*` headers from your reverse proxy |
| `APPWRITE_*` | Optional file storage in Appwrite — section 4 |

Never commit `.env` (it is gitignored).

## 3. First steps on a new server

1. Set `SKIP_SEED=true` in `.env`, then `docker compose up -d --build`.
2. Log in on the **Admin** tab: `ADMIN001` / `admin123`.
3. **Change the admin password right away** — it is the same on every install.
   Use **🔑 Change Password** at the bottom of the Admin Panel sidebar.
4. In the Admin Panel add faculty and import students (CSV).

> Without `SKIP_SEED`, the first start fills the database with demo data and
> demo logins (`FAC001`/`faculty123`, students/`PASS123`). Fine for a demo,
> not for real use. Note that changing `SEED_VERSION` in `server/seed.js`
> **wipes** the data tables on the next start of a server that isn't using
> `SKIP_SEED`.

### HTTPS

Put a reverse proxy (Caddy, nginx, Traefik, or the host's built-in TLS) in
front of port 3000, then set `COOKIE_SECURE=true` and `TRUST_PROXY=true`.
Caddy example (`Caddyfile`):

```
cdad.example.com {
    reverse_proxy localhost:3000
}
```

Sessions are kept in memory, so restarting the container logs everyone out.

## 4. Optional: store uploaded files in Appwrite

By default submitted files (project submissions and TA1/TA2/EndSem uploads)
are saved on the server's disk. To keep them in an Appwrite Storage bucket
instead:

1. Have an Appwrite instance. To self-host, follow Appwrite's installation
   guide (https://appwrite.io/docs/advanced/self-hosting) — ideally on the
   same server or network as CDAD. Appwrite Cloud also works.
2. In the Appwrite console: create a **project**, then a **Storage bucket**
   (allow the file extensions `pdf, ppt, pptx, csv, doc, docx` and a max file
   size of at least 10 MB), then an **API key** with the `files.read` and
   `files.write` scopes.
3. Put the four values in `.env`:

   ```
   APPWRITE_ENDPOINT=https://appwrite.example.com/v1
   APPWRITE_PROJECT_ID=...
   APPWRITE_API_KEY=...
   APPWRITE_BUCKET_ID=...
   ```
4. `docker compose up -d --build`. New uploads go to Appwrite; the database
   stores a reference like `appwrite:<fileId>`.

Notes:
- **Existing files are not moved.** Files uploaded before switching on
  Appwrite stay on local disk and keep working (the reference tells the
  server where each file is). Keep the volume until those are no longer needed.
- Students and faculty never talk to Appwrite directly — every download goes
  through CDAD's own permission checks, so the bucket can stay private.
- If Appwrite is unreachable when a student uploads, the upload is rejected
  with a clear error (nothing is half-saved).
- The database itself stays in SQLite; only files move.

## 5. Hosting on Render (managed)

`render.yaml` in the repo root describes the service, so Render can set it up for you.

1. Push the repo to GitHub (already done for `backend-migration`; use whichever branch you want live).
2. Render dashboard → **New → Blueprint** → connect the GitHub repo and branch.
3. Render reads `render.yaml` and asks for the three values marked `sync: false`:
   `APPWRITE_PROJECT_ID`, `APPWRITE_BUCKET_ID`, `APPWRITE_API_KEY`. Paste them there
   (not in git). Leave them empty to keep files on the disk instead.
4. Create. The first build takes a few minutes. You get a `https://cdad-xxxx.onrender.com` address.
5. Open it, log in on the **Admin** tab (`ADMIN001` / `admin123`), click
   **🔑 Change Password**, then add faculty and import students.

Important:
- **Use a paid instance (`starter` or above).** The database is a SQLite file on the
  persistent disk (`/app/server/data`), and Render only offers disks on paid instances.
  A free instance has no disk — data would be wiped on every restart.
- Only **one** instance: SQLite and in-memory sessions don't work across several. Don't scale out.
- Each deploy restarts the app, which logs everyone out (sessions are in memory).
- Render's disk is backed up as snapshots on its side; still export your own copy
  now and then (Render dashboard → Shell, or the backup command in section 1).
- For a custom domain, add it in the Render dashboard; HTTPS is automatic.

**Railway / Fly.io** work the same way: build from the `Dockerfile`, attach a volume
mounted at `/app/server/data`, run a single instance, and set the same environment
variables (`SKIP_SEED`, `COOKIE_SECURE`, `TRUST_PROXY`, `APPWRITE_*`).
