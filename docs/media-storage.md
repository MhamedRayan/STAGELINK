# Media storage (internships)

Uploaded final submissions are the only binary data in STAGELINK. This document
covers where they live, how they are protected, and how to back them up.

## What is stored

The internships service stores one file per submission version:

```text
<MEDIA_ROOT>/submissions/<internship_uuid>/v<version>/<sanitised_filename>
```

- `MEDIA_ROOT` defaults to `services/internships/media` locally and is
  `/app/media` in Docker Compose.
- The database stores the relative path and the original filename separately.
- Allowed extensions: `.pdf`, `.docx`, `.pptx`, `.jpg`, `.jpeg`, `.png`, `.csv`,
  case-insensitive.
- Maximum size: 10 MB (`MAX_SUBMISSION_SIZE_BYTES=10485760`).
- Files are created with permissions `0640`; version directories use `0750`.

## Access rules

- `MEDIA_URL` is configured but deliberately **not** routed in `config/urls.py`.
  There is no public media URL.
- Downloads go through
  `GET /api/internships/{id}/submissions/{submission_id}/download/`, which
  enforces the same visibility as the submission list: the student on the
  internship, the assigned supervisor and university administration. The
  company receives `404`.
- The download response is an attachment with the original filename and
  `X-Content-Type-Options: nosniff`.
- Never expose `MEDIA_ROOT` through Nginx, Apache, or a cloud bucket without an
  authorisation layer.

## Docker Compose

The `internships` service mounts the named volume `internships-media` at
`/app/media`. The image pre-creates the directory and gives it to `appuser`, so
a fresh volume inherits the correct ownership.

```bash
# Inspect the volume
docker volume inspect stagelink_internships-media

# List stored files
docker compose --env-file .env -f infra/docker/docker-compose.yml \
  exec internships find /app/media -type f
```

An upload must survive `docker compose ... up -d --force-recreate internships`.

## Reverse proxy

If a proxy sits in front of the service, allow slightly more than the application
limit, for example:

```nginx
client_max_body_size 12m;
```

The application returns a structured `400 validation_error` when the limit is
exceeded; a proxy rejection may return its own HTML error page instead.

## Backup

A complete backup needs **both** the PostgreSQL database and the media volume.
Backing up only one of them produces dangling rows or orphaned files.

```bash
# 1. Database (adjust the container name if needed)
docker compose --env-file .env -f infra/docker/docker-compose.yml \
  exec -T db-internships pg_dump -U "$POSTGRES_USER" internships \
  > internships-$(date +%F).sql

# 2. Media volume
docker run --rm \
  -v stagelink_internships-media:/data:ro \
  -v "$PWD":/backup \
  alpine tar czf /backup/internships-media-$(date +%F).tgz -C /data .
```

Store both artefacts off-host. A backup that only exists on the same machine is
not a backup. Test a restore periodically in a disposable environment.

## Restore

1. Stop the internships service so no upload or download is in progress.
2. Restore the database dump.
3. Restore the media archive into the volume:

   ```bash
   docker run --rm \
     -v stagelink_internships-media:/data \
     -v "$PWD":/backup \
     alpine sh -c "rm -rf /data/* && tar xzf /backup/internships-media-YYYY-MM-DD.tgz -C /data"
   ```

4. Start the service and check that a known submission downloads correctly and
   that the stored bytes match the original.

## Retention

- Deletion is not exposed by the API. The foreign key from submissions to
  internships uses `PROTECT`, so an internship with files cannot be deleted by
  accident.
- Do not delete files while their database row exists. If a manual purge is ever
  required, remove the rows and files together and record the action.
- Keep backups according to the university's data-retention policy. Student
  reports may contain personal data.

## Place-release retry

Approving a cancellation releases the reserved place through Applications. The
call is best effort; when Applications is unavailable, the marker
`place_released_at` stays null and the following command retries it:

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml \
  exec internships python manage.py release_cancelled_places --limit 100
```

Run it from cron or the platform scheduler until no cancelled internship has
`place_released_at = null`. The Applications endpoint is idempotent, so repeated
runs are safe.
