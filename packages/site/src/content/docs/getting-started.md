---
title: Getting Started
description: How to install and run Haflow locally
order: 1
---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 20 or later
- **pnpm** 10 or later
- **Docker** (for running agent sandboxes)

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/oxedom/haflow.git
cd haflow
pnpm install
```

## Building the Shared Package

The shared package must be built first as other packages depend on it:

```bash
pnpm --filter @haflow/shared build
```

## Running the Development Servers

Start the backend server (runs on port 4000):

```bash
pnpm --filter @haflow/backend dev
```

In a separate terminal, start the frontend (runs on port 5173):

```bash
pnpm --filter frontend dev
```

## Creating Your First Mission

1. Open [http://localhost:5173](http://localhost:5173) in your browser
2. Click **New Mission**
3. Enter a title and your raw input (the task you want to accomplish)
4. Click **Create** to start the mission

The mission will begin with an agent step that cleans up your input. After each agent step completes, you'll review the output before proceeding.

## Next Steps

- Learn about the [Architecture](/docs/architecture)
- Understand the [Workflow Pipeline](/docs/workflow)
