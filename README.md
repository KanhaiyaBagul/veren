A cloud platform to automatically build, deploy, and monitor frontend and backend apps with multi-tenant isolation and CI/CD.


ARCHITECTURE

```bash
User
 │
 │ Login & submit GitHub URL
 ▼
API-Gateway
 │
 │ Forwards request to Submission-Service
 ▼
Submission-Service
 │
 │ - Validate GitHub URL
 │ - Check frontend & backend folders
 │ - Check required fields
 │ - Assign unique project ID
 ▼
Extractor-Service
 ├─ Clone-Worker
 │    └─ git clone repo
 └─ Assign-Worker
      ├─ Generate frontend Dockerfile
      ├─ Generate vite.config.js
      ├─ Generate nginx.conf
      ├─ Generate backend Dockerfile
      └─ Generate docker-compose.yml
 ▼
Backend-Service (Orchestrator)
 ├─ **Validate generated Dockerfiles & Compose**
 │     - Ensure frontend & backend builds will succeed
 │     - Catch Node version / dependency mismatches
 ├─ **Build Docker images (frontend & backend)**
 │     - Capture frontend build logs
 │     - Validate that build succeeded before deploying
 ├─ **Deploy containers via Docker Compose**
 │     - Frontend served via Nginx
 │     - Backend exposed internally
 ├─ **Lifecycle tracking**
 │     - Store container IDs, project ID, commit SHA
 │     - Track status: building, running, failed
 │     - Support rollback if deployment fails
 ├─ **Metrics & monitoring**
 │     - CPU, memory usage
 │     - Container health checks
 │     - Log aggregation for frontend & backend
 └─ **CI/CD logic**
       - Trigger rebuilds on GitHub webhook / new commit
       - Redeploy containers automatically
 ▼
Traefik
 │
 │ - Handles routing to frontend containers
 │ - Supports wildcard subdomains per project
 ▼
Frontend Container(s) (Nginx + React build)
 │
 │ - Serve static build
 │ - React Router fallback for all routes
 │ - Build logs captured for dashboard
Backend Container(s)
 │
 │ Users access project URL
 ▼
User sees deployed project
 │
 │ - Can view status, logs, metrics
 │ - Optional: trigger rebuild or rollback
 ```