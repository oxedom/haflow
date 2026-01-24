# haflow(Human Agent flow) [WIP!]

![Haflow](haflow-readme.jpg)

**Local-first AI mission orchestrator** with human gates and ephemeral sandboxes.

## ✨ What is Haflow?

Haflow runs AI-assisted workflows against your real projects, combining automated agent steps with human review gates. Each agent step executes in isolated Docker containers, keeping your environment clean and secure.

## 🌐 Frontend

Haflow includes a web-based frontend to give you full control over your workflows directly from your browser. This design enables:

- **Browser-based control**: Manage and monitor your AI missions from any device with a web browser
- **Mobile access**: Pair with [Tailscale VPN](https://tailscale.com/) to securely access and control your Haflow instance from your mobile device while on the go
- **Remote deployment**: The web interface makes Haflow deployable to a VPS, allowing you to run missions on a remote server while maintaining full control through the browser

This architecture provides flexibility to run Haflow locally, on a VPS, or anywhere you need it, while keeping the interface accessible and portable.

## 📋 Requirements

- **Node.js** >= 18.0.0
- **pnpm** >= 10.x ([install guide](https://pnpm.io/installation))
- **Docker** (for running agent steps in sandboxes)

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
