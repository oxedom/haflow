# Haflow

![Haflow](haflow.png)

**Local-first AI mission orchestrator** with human gates and ephemeral sandboxes.

## ✨ What is Haflow?

Haflow runs AI-assisted workflows against your real projects, combining automated agent steps with human review gates. Each agent step executes in isolated Docker containers, keeping your environment clean and secure.

## 🏗️ Architecture

```
packages/
├── shared/     # Zod schemas + TypeScript types
├── backend/    # Express API + Docker sandbox orchestration
├── frontend/   # React 19 + Vite + TailwindCSS 4
└── cli/        # Coming soon
```

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Build shared types
pnpm --filter @haloop/shared build

# Start backend (port 4000)
pnpm --filter @haloop/backend dev

# Start frontend (port 5173)
pnpm --filter frontend dev
```

## 📋 Workflow Pipeline

Haflow uses an 8-step alternating workflow:

| Step | Type | Description |
|------|------|-------------|
| 1 | 🤖 Agent | Cleanup raw input |
| 2 | 👤 Human | Review structured output |
| 3 | 🤖 Agent | Research & context gathering |
| 4 | 👤 Human | Review research |
| 5 | 🤖 Agent | Create implementation plan |
| 6 | 👤 Human | Review plan |
| 7 | 🤖 Agent | Execute implementation |
| 8 | 👤 Human | Final review |

## 🧪 Testing

```bash
# Run backend tests
pnpm --filter @haloop/backend test

# Watch mode
pnpm --filter @haloop/backend test:watch
```

## 📄 License

MIT
