## Feature Overview: Docker Logs Capture

### Goal

Capture the raw Docker container output (the same logs visible in Docker Desktop) and persist them to a `docker-logs.txt` file within each mission's directory for debugging and auditing purposes.

### What Gets Captured

- All stdout/stderr from the Claude container process
- Raw `stream-json` lines before parsing
- Docker initialization messages
- Any container-level errors or warnings

### Where It Lives

```
missions/
  {mission-id}/
    meta.json
    artifacts/
    runs/
      {run-id}/
        logs.txt          # (existing) parsed/formatted logs
        docker-logs.txt   # (new) raw container output
```

### Key Considerations

1. **Append vs Overwrite** — Should each run append to one file or create a new file per run?
2. **Performance** — Writing raw logs shouldn't block the streaming pipeline
3. **File Size** — Raw `stream-json` output is verbose; may need rotation or size limits
4. **Timing** — Capture should start before Claude invocation and include container startup

### Touch Points

- `packages/backend/src/services/docker.ts` — Where stdout/stderr is already being read
- `packages/backend/src/services/mission-engine.ts` — Where runs are orchestrated
- Mission storage layer — For file path resolution
