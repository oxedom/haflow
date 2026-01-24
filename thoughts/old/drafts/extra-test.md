Frontend Container Runtime Verification
Objective: Validate the backend container's ability to support frontend execution using a temporary fe fixture fixture.

[ ] Generate Test Fixture: Use the existing Vite/Vue fixture at packages/backend/tests/resource/vue-frontend (no new scaffold needed).

[ ] Container Execution Test (backend app container image, default node:20-slim):

1) Volume-mount the fixture into the container (e.g., /app).
2) Install deps and build:
   - npm install
   - npm run build
3) Run preview server:
   - npm run preview -- --host 0.0.0.0 --port 4173
   - publish container port 4173 to host (e.g., -p 4173:4173)

[ ] Feasibility Confirmation:
   - Build exits 0.
   - Preview server binds to 0.0.0.0:4173 (log shows ready + URL).
   - Host can reach the preview URL (curl/http request succeeds).