<img width="2816" height="1536" alt="image" src="https://github.com/user-attachments/assets/2d120f23-92fd-4cc0-b308-d623d40c537a" />

# Ralphy

A multi-project Claude Code orchestrator - a central hub for managing AI-assisted development missions across multiple projects.

## Overview

Ralphy enables developers to delegate feature development to Claude Code while maintaining full control, visibility, and safety. It provides:

- **Project Management**: Register and manage multiple project directories
- **Mission Orchestration**: Define, plan, and execute AI-driven development tasks
- **Task Execution**: Break down missions into sequential, manageable tasks
- **Progress Tracking**: Monitor execution logs and mission state in real-time


## Installation

```bash
# Clone the repository
git clone <repo-url>
cd ralphy

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Install CLI globally (optional)
pnpm --filter @ralphy/cli link --global
```

## Quick Start

```bash
# Initialize Ralphy (creates ~/.ralphy/)
ralphy init

# Register a project
ralphy link /path/to/your/project

# Start the backend server
ralphy start

# Check status
ralphy status
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `ralphy init` | Initialize `~/.ralphy/` directory and database |
| `ralphy link [path]` | Register a project with Ralphy |
| `ralphy unlink [path]` | Unregister a project |
| `ralphy start` | Start the backend server |
| `ralphy stop` | Stop the backend server |
| `ralphy status` | Show linked projects and server status |

## Mission Lifecycle

Missions follow a state machine through their lifecycle:

```
draft → generating_prd → prd_review → preparing_tasks → tasks_review → in_progress → completed
```

1. **Draft**: Initial mission definition
2. **Generating PRD**: AI generates a Product Requirements Document
3. **PRD Review**: User reviews and approves the PRD
4. **Preparing Tasks**: AI breaks down the PRD into executable tasks
5. **Tasks Review**: User reviews and approves the task list
6. **In Progress**: Tasks execute sequentially
7. **Completed**: Mission finished (success or failed)

## API Endpoints

All routes are under `/api`:

| Endpoint | Description |
|----------|-------------|
| `GET/POST /projects` | Manage registered projects |
| `GET/POST /missions` | Manage missions (CRUD + actions) |
| `GET/PATCH /tasks` | Read and update mission tasks |
| `GET /logs` | Query mission execution logs |
| `GET /health` | Health check |

## Data Storage

**Global Configuration** (`~/.ralphy/`):
- `config.json` - Server settings
- `ralphy.sqlite` - Central database

**Per-Project Artifacts** (`<project>/.ralphy/missions/<mission>/`):
- `prd.md` - Generated PRD
- `tasks.json` - Task definitions
- `progress.txt` - Execution logs

## Development

```bash
# Build all packages (in dependency order)
pnpm build

# Build specific package
pnpm --filter @ralphy/backend build

# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @ralphy/backend test

# Watch mode for development
pnpm --filter @ralphy/backend test:watch

# Start backend in dev mode
pnpm --filter @ralphy/backend dev
```

## Tech Stack

- **Runtime**: Node.js >= 18.0.0
- **Language**: TypeScript 5.x
- **Package Manager**: pnpm
- **Database**: SQLite (better-sqlite3)
- **Web Framework**: Express
- **CLI Framework**: Commander.js
- **Validation**: Zod
- **Testing**: Vitest + Supertest

