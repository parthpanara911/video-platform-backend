# Video Platform Backend

A backend API for a video sharing platform. Users can sign up, upload videos, and watch, like, comment on, and subscribe to channels. Creators get a dashboard with stats for their channel.

Built with **Node.js, Express, MongoDB, Redis, and Cloudinary**.

---

## What it can do

- **Accounts:** register with an avatar and optional cover image, log in, log out, refresh sessions, update profile details, and change password.
- **Video uploads:** upload videos and thumbnails, track processing status, edit title and description, replace thumbnails, publish or unpublish, and delete.
- **Watching:** browse, search, sort, and paginate videos. Views are counted once per viewer, for both logged-in and anonymous users.
- **Social features:** like videos and comments, comment with replies, subscribe to channels, and view watch history.
- **Playlists:** create public, unlisted, or private playlists and add or remove videos.
- **Creator dashboard:** total videos, views, likes, and subscribers, plus a filterable list of your own videos.

---

## How it works

### Uploading videos

Large files never go through this server. Instead:

1. The client asks the API to start an upload.
2. The API creates a video record and returns **signed upload parameters** for Cloudinary.
3. The client uploads the video and thumbnail directly to Cloudinary.
4. Cloudinary sends a **webhook** back to the API (verified by signature and timestamp) when files are uploaded and processed.
5. The video moves through these statuses: `awaiting_upload` → `processing` → `ready` (or `failed`).

### Background jobs

Two [BullMQ](https://docs.bullmq.io/) workers run on Redis:

- **Asset cleanup:** deletes unused or replaced Cloudinary files, with automatic retries.
- **Reconciliation:** runs every 15 minutes (configurable) to find videos stuck in processing, checks Cloudinary for their real state, and fixes them. This covers missed webhooks and uploads that never finished. It also clears expired thumbnail replacement requests.

A Bull Board dashboard for monitoring queues is available at `/admin/queues` (password protected).

### Security

- JWT access and refresh tokens stored in httpOnly cookies (Bearer tokens are also accepted).
- Passwords hashed with bcrypt.
- Redis-backed rate limiting on login, registration, uploads, comments, likes, and more.
- Input validation with Zod.
- Uploaded image types are checked by file contents, not just the file name.
- Owner-only access for editing and deleting videos, comments, and playlists.

---

## Tech stack

| Area | Tools |
| --- | --- |
| Runtime and framework | Node.js, Express |
| Database | MongoDB with Mongoose |
| Cache, rate limits, queues | Redis, ioredis, BullMQ |
| File storage and processing | Cloudinary |
| Auth | JWT, bcrypt, cookies |
| Validation | Zod, Multer (profile image uploads) |
| Logging | Pino, pino-http |

---

## Getting started

### Requirements

- Node.js 18 or newer
- MongoDB (local or Atlas)
- Redis
- A Cloudinary account with two **signed** upload presets, one for videos and one for images

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
cp .env.example .env
# Then fill in your own values

# 3. Start the API server
node src/server.js

# 4. In separate terminals, start the workers
node src/workers/assetCleanup.worker.js
node src/workers/videoReconcile.worker.js
```

> If your `package.json` has scripts such as `npm run dev`, use those instead.

For local development, expose your server with a tunnel (for example ngrok) and set `SERVER_URL` to that public address. Cloudinary needs a reachable URL to send webhooks.