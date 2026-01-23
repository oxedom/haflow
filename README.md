# Haflow (WIP!!!)

![Haflow](haflow-readme.jpg)

**Local-first AI mission orchestrator** with human gates and ephemeral sandboxes.

## ✨ What is Haflow?

Haflow runs AI-assisted workflows against your real projects, combining automated agent steps with human review gates. Each agent step executes in isolated Docker containers, keeping your environment clean and secure.

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Build shared types
pnpm --filter @haflow/shared build

# Build everything (shared, backend, frontend, cli)
pnpm build:all

# Start backend (port 4000)
pnpm --filter @haflow/backend dev

# Start frontend (port 5173)
pnpm --filter frontend dev
```

## 🧰 CLI (Global Install)

```bash
# Build the CLI
pnpm --filter @haflow/cli build

# Install globally (local workspace)
pnpm add -g /home/s-linux/projects/haflow/packages/cli
```

### Link a project + start

```bash
# Initialize haflow home dir
haflow init

# Link the haflow repo (or any compatible project)
haflow link /home/s-linux/projects/haflow

# Start backend + frontend
haflow start

# Check status
haflow status
```
