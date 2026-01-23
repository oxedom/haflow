# Frontend Container Runtime Verification

This document describes how to manually verify that the backend container runtime can execute a frontend project end-to-end (install, build, preview) using the existing Vue/Vite fixture and a Node 20 slim image.

## Prerequisites

- Docker installed and running
- Access to the `packages/backend/tests/resource/vue-frontend` fixture

## Manual Verification Steps

### 1. Run the Container

From the repository root, execute:

```bash
docker run --rm -it \
  -p 4173:4173 \
  -v "$(pwd)/packages/backend/tests/resource/vue-frontend:/app" \
  -w /app \
  node:20-slim \
  sh -c "npm install && npm run build && npm run preview -- --host 0.0.0.0 --port 4173"
```

**Expected behavior:**
- `npm install` completes without errors (may show deprecation warnings, which are acceptable)
- `npm run build` compiles the Vue app successfully
- `npm run preview` starts and shows output similar to:
  ```
  ➜  Local:   http://localhost:4173/
  ➜  Network: http://0.0.0.0:4173/
  ```

### 2. Verify Host Access

In a separate terminal, verify the preview server is reachable:

```bash
curl -s http://localhost:4173/ | head -20
```

**Expected output:**
- HTTP 200 response
- HTML content containing the Vue app (look for `<div id="app">` or similar)

### 3. Cleanup

Press `Ctrl+C` in the container terminal to stop the preview server. The container will be automatically removed due to the `--rm` flag.

## Troubleshooting

### Port Already in Use

If port 4173 is already in use, either:
- Stop the conflicting service, or
- Change the port mapping: `-p 4174:4173` and verify with `curl http://localhost:4174/`

### Permission Errors

If you encounter permission errors on the mounted volume:
- Ensure the fixture directory is readable
- Try running without the `--rm` flag to inspect container state

### Network Issues

If `curl` cannot connect:
- Verify the container is running: `docker ps`
- Check container logs: `docker logs <container_id>`
- Ensure the `--host 0.0.0.0` flag is passed to vite preview

## Verification Checklist

- [ ] `npm install` completes with exit code 0
- [ ] `npm run build` completes with exit code 0
- [ ] Preview server binds to `0.0.0.0:4173` and reports readiness
- [ ] `curl http://localhost:4173/` returns valid HTML response
