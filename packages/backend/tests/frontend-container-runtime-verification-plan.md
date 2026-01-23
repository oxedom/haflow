# Frontend Container Runtime Verification Implementation Plan

## Overview

Validate that the backend container runtime can execute a frontend fixture end-to-end (install, build, preview) using the existing Vite/Vue fixture and a Node 20 slim image. The goal is a repeatable verification path that proves the container can serve a preview and the host can reach it.

## Current State Analysis

- The Docker sandbox defaults to `node:20-slim`, which matches the target runtime for this verification. 
- Docker provider tests already run real containers and use a Docker-availability gate, establishing the test pattern to follow for optional Docker-dependent tests.
- A Vite/Vue fixture already exists under backend tests resources and does not require scaffolding.

### Key Discoveries:
- Default agent image is `node:20-slim` in the Docker provider. 
- Docker tests gate on Docker availability and use real containers.
- The Vue/Vite fixture exists and is ready to use.

```9:71:packages/backend/src/services/docker.ts
const defaultImage = 'node:20-slim'; // Default agent image for v0
...
  const args = [
    'run',
    '-d',
    // Note: NOT using --rm so we can inspect exit status before cleanup
    '--user', `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
    ...labels,
    ...envArgs,
    '-v', `${artifactsPath}:${workingDir}/artifacts`,
    '-w', workingDir,
    image || defaultImage,
    ...escapedCommand,
  ];
```

```7:19:packages/backend/tests/unit/services/docker.test.ts
describe('docker provider', () => {
  let dockerAvailable: boolean;
  const createdContainers: string[] = [];

  beforeAll(async () => {
    dockerAvailable = await dockerProvider.isAvailable();
    if (!dockerAvailable) {
      console.warn('Docker not available - skipping Docker tests');
    }
  });
```

```1:6:packages/backend/tests/resource/vue-frontend/README.md
# Vue 3 + Vite

This template should help get you started developing with Vue 3 in Vite.
```

## Desired End State

- A documented and repeatable verification flow exists under `packages/backend/tests/`.
- The flow mounts `tests/resource/vue-frontend` into a container, runs `npm install`, `npm run build`, and launches `npm run preview` on `0.0.0.0:4173`.
- The host can reach the preview URL and receive a successful HTTP response.
- Verification can be automated (where feasible) and also run manually.

## What We're NOT Doing

- Not changing the Docker provider runtime or its default image selection.
- Not modifying the Vue/Vite fixture contents.
- Not making this verification mandatory in CI; Docker availability remains a gate.
- Not adding new CLI tooling outside of backend tests.

## Implementation Approach

Create a dedicated verification document plus an optional integration test that runs only when Docker is available. The test should:
1. Mount the fixture into a container.
2. Install dependencies and build.
3. Launch the preview server bound to `0.0.0.0`.
4. Verify host access via HTTP.

Because the current Docker provider does not expose port mapping, the integration test should use direct `docker run` with `-p 4173:4173` and a single `sh -c` command to keep the flow consistent with the manual steps. Cleanup should remove the container on completion or failure.

## Phase 1: Documentation + Manual Runbook

### Overview
Capture the full manual verification steps under `packages/backend/tests/` so engineers can reproduce the runtime check on demand.

### Changes Required:

#### 1. Verification Document
**File**: `packages/backend/tests/frontend-container-runtime-verification.md`  
**Changes**: Add detailed steps, required prerequisites, expected logs, and verification commands.

```markdown
## Manual Steps (Summary)
1. docker run -p 4173:4173 -v <fixture>:/app -w /app node:20-slim \
   sh -c "npm install && npm run build && npm run preview -- --host 0.0.0.0 --port 4173"
2. curl http://localhost:4173/
```

### Success Criteria:

#### Automated Verification:
- [ ] The document exists at `packages/backend/tests/frontend-container-runtime-verification.md`.
- [ ] The document includes the exact container command and curl verification.

#### Manual Verification:
- [ ] `npm install` and `npm run build` complete with exit code 0.
- [ ] Preview server binds to `0.0.0.0:4173` and reports readiness.
- [ ] `curl http://localhost:4173/` returns a `200` or a valid HTML response.

**Implementation Note**: After this phase, run the manual steps once to confirm the flow works before moving on to automation.

---

## Phase 2: Optional Integration Test (Docker-Gated)

### Overview
Add a Docker-gated integration test that runs the same container flow and validates the preview endpoint.

### Changes Required:

#### 1. Integration Test
**File**: `packages/backend/tests/integration/docker/frontend-runtime.test.ts`  
**Changes**: Use `child_process.exec` to run `docker run` with port mapping; poll `http://localhost:4173/`; ensure cleanup on completion.

```typescript
if (!dockerAvailable) return;
const { stdout, stderr } = await execAsync(
  `docker run --rm -p 4173:4173 -v ${fixturePath}:/app -w /app node:20-slim ` +
  `sh -c "npm install && npm run build && npm run preview -- --host 0.0.0.0 --port 4173"`
);
```

### Success Criteria:

#### Automated Verification:
- [ ] Integration test passes: `pnpm --filter @ralphy/backend test tests/integration/docker`.
- [ ] Test skips gracefully when Docker is unavailable.

#### Manual Verification:
- [ ] Test log shows preview server started and bound to `0.0.0.0:4173`.
- [ ] Host HTTP request succeeds during the test run.

**Implementation Note**: If port conflicts are observed, update the test to dynamically pick an available host port and pass it through.

---

## Testing Strategy

### Unit Tests:
- None required; this is an integration validation against Docker.

### Integration Tests:
- `frontend-runtime.test.ts` (Docker-gated, real container).
- Validate both build completion and HTTP reachability.

### Manual Testing Steps:
1. Run the documented `docker run` command from the repo root.
2. Wait for Vite preview to report a ready URL.
3. `curl http://localhost:4173/` and confirm non-empty HTML.

## Performance Considerations

- Expect first-time `npm install` to be slow; repeated runs may leverage Docker layer caching if a custom image is introduced in the future.
- Limit test retries to avoid repeated long installs.

## Migration Notes

None. This is additive documentation and optional integration coverage.

## References

- Docker default image and command structure: `packages/backend/src/services/docker.ts`
- Docker test gating pattern: `packages/backend/tests/unit/services/docker.test.ts`
- Fixture template: `packages/backend/tests/resource/vue-frontend/README.md`
