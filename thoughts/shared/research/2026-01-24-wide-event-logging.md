---
date: 2026-01-24T15:50:04+02:00
researcher: Claude
git_commit: 65dec2c
branch: main
repository: haflow
topic: "Global Wide Event Logging for HTTP Requests"
tags: [research, codebase, logging, middleware, express, observability]
status: complete
last_updated: 2026-01-24
last_updated_by: Claude
---

# Research: Global Wide Event Logging for HTTP Requests

**Date**: 2026-01-24T15:50:04+02:00
**Researcher**: Claude
**Git Commit**: 65dec2c
**Branch**: main
**Repository**: haflow

## Research Question
How to implement a global log object for requests using the "wide event" logging pattern in the Haflow backend?

## Summary

The Haflow backend currently has **no structured logging infrastructure**. It uses scattered `console.log` and `console.error` calls (6 total across 3 files). Implementing wide event logging would provide:

1. A single, comprehensive log event per request
2. Request-scoped context accessible to all handlers
3. Automatic capture of timing, errors, and response metadata
4. Foundation for future observability (structured JSON logs, log aggregation)

## Current State

### Existing Logging (minimal)

| File | Calls | Usage |
|------|-------|-------|
| `src/index.ts` | 3 | Startup messages |
| `src/server.ts` | 1 | Error logging |
| `src/services/mission-engine.ts` | 2 | Container monitoring errors |

### Server Architecture

```1:27:packages/backend/src/server.ts
import express, { type Express } from 'express';
import cors from 'cors';
import { missionRoutes, workflowRoutes } from './routes/missions.js';
import { transcriptionRoutes } from './routes/transcription.js';

export function createServer(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use('/api/missions', missionRoutes);
  app.use('/api/workflows', workflowRoutes);
  app.use('/api/transcribe', transcriptionRoutes);

  // Error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({
      success: false,
      data: null,
      error: err.message,
    });
  });

  return app;
}
```

### Current Middleware Stack
1. `cors()` - CORS headers
2. `express.json()` - JSON body parsing

**No middleware directory exists** - would need to create `src/middleware/`.

### Existing Utilities

```1:10:packages/backend/src/utils/id.ts
import { v4 as uuidv4 } from 'uuid';

// Using UUID for v0; can switch to ULID later if sortability needed
export function generateMissionId(): string {
  return `m-${uuidv4().slice(0, 8)}`;
}

export function generateRunId(): string {
  return `r-${uuidv4().slice(0, 8)}`;
}
```

UUID generation is already available via the `uuid` package.

### Version Source

```json
// packages/backend/package.json
"version": "0.0.1"
```

## Recommended Implementation

### 1. Create Middleware Directory Structure

```
packages/backend/src/
├── middleware/
│   └── logging.ts    # Wide event logging
├── routes/
├── services/
└── utils/
```

### 2. Wide Event Interface (adapted for Haflow)

```typescript
// packages/backend/src/middleware/logging.ts

import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../utils/config.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      log: WideEvent;
      startTime: number;
    }
  }
}

export interface WideEvent {
  // Request identifiers
  request_id: string;
  timestamp: string;
  
  // Service context
  service: string;
  environment: string | undefined;
  version: string;
  
  // Request details
  method: string;
  path: string;
  query: Record<string, any>;
  
  // Response details (populated on finish)
  status_code?: number;
  response_time_ms?: number;
  
  // Error details
  error?: {
    type: string;
    message: string;
    code?: string;
    stack?: string;
  } | null;
  
  // Custom context (enriched by handlers)
  context: Record<string, any>;
}
```

### 3. Middleware Implementation

```typescript
export function wideEventMiddleware(version: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    req.startTime = startTime;

    // Initialize the wide event
    const event: WideEvent = {
      request_id: uuidv4(),
      timestamp: new Date().toISOString(),
      service: 'haflow-backend',
      environment: process.env.NODE_ENV,
      version,
      method: req.method,
      path: req.path,
      query: req.query,
      context: {},
    };

    req.log = event;

    // Capture response details on finish
    res.on('finish', () => {
      event.status_code = res.statusCode;
      event.response_time_ms = Date.now() - startTime;
      
      // Log the complete event
      const logLevel = res.statusCode >= 500 ? 'error' : 
                       res.statusCode >= 400 ? 'warn' : 'info';
      
      console[logLevel](JSON.stringify(event));
    });

    next();
  };
}
```

### 4. Error Handler Integration

```typescript
export function errorLoggingMiddleware(
  err: Error & { status?: number; code?: string },
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Attach error to wide event
  if (req.log) {
    req.log.error = {
      type: err.name || 'Error',
      message: err.message,
      code: err.code,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    };
  }
  next(err);
}
```

### 5. Server Integration

```typescript
// packages/backend/src/server.ts
import { wideEventMiddleware, errorLoggingMiddleware } from './middleware/logging.js';
import pkg from '../package.json' with { type: 'json' };

export function createServer(): Express {
  const app = express();

  // Logging middleware FIRST
  app.use(wideEventMiddleware(pkg.version));
  
  app.use(cors());
  app.use(express.json());

  // Routes...
  
  // Error logging BEFORE error handler
  app.use(errorLoggingMiddleware);
  
  // Error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // ... existing handler
  });

  return app;
}
```

### 6. Usage in Route Handlers

```typescript
// Example: enriching the log with mission context
missionRoutes.get('/:missionId', async (req, res, next) => {
  try {
    const { missionId } = req.params;
    
    // Enrich log context
    req.log.context.missionId = missionId;
    
    const detail = await missionStore.getDetail(missionId);
    if (!detail) {
      req.log.context.found = false;
      return sendError(res, `Mission not found: ${missionId}`, 404);
    }
    
    req.log.context.found = true;
    req.log.context.missionStatus = detail.meta.status;
    
    sendSuccess(res, detail);
  } catch (err) {
    next(err);
  }
});
```

## Key Differences from User's Example

| Aspect | User's Example | Haflow Adaptation |
|--------|---------------|-------------------|
| Property name | `req.wideEvent` | `req.log` (shorter, clearer) |
| User context | Full user object | Not needed (no auth) |
| Client headers | Platform/OS/Version | Simplified (add later) |
| Body logging | Included | Excluded (privacy) |

## Architecture Insights

1. **No existing logging infrastructure** - clean slate for implementation
2. **UUID already available** - `uuid` package in dependencies
3. **Config pattern exists** - can extend for log configuration
4. **Error handler exists** - needs integration, not replacement

## Related Files

- `packages/backend/src/server.ts` - Server setup, middleware registration
- `packages/backend/src/utils/config.ts` - Configuration pattern
- `packages/backend/src/utils/response.ts` - Response utilities
- `packages/backend/package.json` - Version source, uuid dependency

## Open Questions

1. **Log output format**: JSON to stdout? File-based? External service?
2. **Log levels**: Implement custom logger or use existing library (pino, winston)?
3. **Request body logging**: Privacy implications for mission content?
4. **Test environment**: Suppress logs during tests?
5. **Performance**: Async logging for high throughput?

## Implementation Checklist

- [ ] Create `packages/backend/src/middleware/` directory
- [ ] Create `packages/backend/src/middleware/logging.ts`
- [ ] Define `WideEvent` interface
- [ ] Implement `wideEventMiddleware`
- [ ] Implement `errorLoggingMiddleware`
- [ ] Update `server.ts` to use middleware
- [ ] Add log context enrichment in route handlers
- [ ] Consider adding pino/winston for production logging
