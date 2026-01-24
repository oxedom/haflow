# Astro Site Package Implementation Plan

## Overview

Create a new `packages/site` package - an Astro 5 SSG site with a terminal aesthetic that serves as the public-facing documentation and marketing site for Haflow. The site will have a homepage explaining what Haflow is and how to use it, plus a docs section for detailed documentation.

## Current State Analysis

- Monorepo uses pnpm workspaces defined in `pnpm-workspace.yaml`
- Existing packages: shared, backend, frontend, cli (empty)
- Frontend uses TailwindCSS 4 via PostCSS (`@tailwindcss/postcss`)
- All packages use `"type": "module"` and ES2022 target
- JetBrains Mono font already in use (frontend)

### Key Discoveries:
- `pnpm-workspace.yaml:1-5` - workspace packages defined
- `package.json:14` - pnpm 10.28.0 package manager
- `packages/frontend/package.json:54` - TailwindCSS 4.1.18
- `tsconfig.base.json` - shared TypeScript config available

## Desired End State

A fully functional static site at `packages/site` that:
- Builds to static HTML with `pnpm --filter site build`
- Runs dev server with `pnpm --filter site dev`
- Has terminal-aesthetic dark theme with monospace fonts
- Contains homepage with Haflow overview and quick start
- Contains docs section with markdown-based documentation
- Integrates with root monorepo scripts

### Verification:
- `pnpm --filter site dev` starts Astro dev server
- `pnpm --filter site build` generates `dist/` with static files
- Homepage renders with terminal styling
- Docs pages render from markdown content

## What We're NOT Doing

- No dynamic/SSR features - pure static generation
- No animations or typing effects - static terminal look only
- No light mode - dark terminal theme only
- No search functionality (can add later)
- No i18n/localization
- No analytics integration

## Implementation Approach

Use Astro 5.x with the new `@tailwindcss/vite` plugin (not the deprecated `@astrojs/tailwind`). Content collections with `glob()` loader for docs. Custom terminal-themed components.

---

## Phase 1: Package Scaffolding

### Overview
Create the basic package structure with all configuration files and integrate into the monorepo workspace.

### Changes Required:

#### 1. Update pnpm workspace
**File**: `pnpm-workspace.yaml`
**Changes**: Add site package to workspace

```yaml
packages:
  - packages/shared
  - packages/backend
  - packages/frontend
  - packages/cli
  - packages/site
```

#### 2. Create package.json
**File**: `packages/site/package.json`
**Changes**: New file

```json
{
  "name": "site",
  "type": "module",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "astro": "astro"
  },
  "dependencies": {
    "astro": "^5.2.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.0",
    "tailwindcss": "^4.1.0",
    "typescript": "~5.9.3"
  }
}
```

#### 3. Create Astro config
**File**: `packages/site/astro.config.mjs`
**Changes**: New file

```javascript
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
});
```

#### 4. Create TypeScript config
**File**: `packages/site/tsconfig.json`
**Changes**: New file

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

#### 5. Create .gitignore
**File**: `packages/site/.gitignore`
**Changes**: New file

```
dist/
node_modules/
.astro/
```

#### 6. Create directory structure
**Directories to create**:
- `packages/site/src/`
- `packages/site/src/pages/`
- `packages/site/src/layouts/`
- `packages/site/src/components/`
- `packages/site/src/styles/`
- `packages/site/src/content/docs/`
- `packages/site/public/`

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm install` completes without errors
- [ ] `pnpm --filter site astro --version` outputs Astro version
- [ ] Directory structure exists as specified

#### Manual Verification:
- [ ] Package appears in `pnpm list` output

**Implementation Note**: After completing this phase, run `pnpm install` to link the new package before proceeding.

---

## Phase 2: Core Layout & Styling

### Overview
Create the base layout, terminal CSS theme, and global styles that will be used across all pages.

### Changes Required:

#### 1. Create global CSS with terminal theme
**File**: `packages/site/src/styles/global.css`
**Changes**: New file

```css
@import "tailwindcss";

@theme {
  /* Terminal color palette */
  --color-terminal-bg: #0d1117;
  --color-terminal-bg-light: #161b22;
  --color-terminal-border: #30363d;
  --color-terminal-text: #c9d1d9;
  --color-terminal-text-muted: #8b949e;
  --color-terminal-green: #22c55e;
  --color-terminal-amber: #fbbf24;
  --color-terminal-cyan: #22d3ee;
  --color-terminal-red: #f87171;
  --color-terminal-purple: #a78bfa;

  /* Typography */
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
}

/* Base styles */
html {
  background-color: var(--color-terminal-bg);
  color: var(--color-terminal-text);
  font-family: var(--font-mono);
}

body {
  min-height: 100vh;
  line-height: 1.6;
}

/* Terminal prompt style */
.prompt::before {
  content: '$ ';
  color: var(--color-terminal-green);
}

/* Code blocks */
pre {
  background-color: var(--color-terminal-bg-light);
  border: 1px solid var(--color-terminal-border);
  border-radius: 0.5rem;
  padding: 1rem;
  overflow-x: auto;
}

code {
  font-family: var(--font-mono);
  font-size: 0.875rem;
}

/* Links */
a {
  color: var(--color-terminal-cyan);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

/* Scanline effect (subtle) */
.scanlines::after {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.03) 0px,
    rgba(0, 0, 0, 0.03) 1px,
    transparent 1px,
    transparent 2px
  );
  pointer-events: none;
  z-index: 9999;
}
```

#### 2. Create base layout
**File**: `packages/site/src/layouts/BaseLayout.astro`
**Changes**: New file

```astro
---
interface Props {
  title: string;
  description?: string;
}

const { title, description = 'Haflow - Local-first AI mission orchestrator' } = Astro.props;
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content={description} />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <title>{title} | Haflow</title>
  </head>
  <body class="scanlines">
    <div class="min-h-screen flex flex-col">
      <slot name="header" />
      <main class="flex-1">
        <slot />
      </main>
      <slot name="footer" />
    </div>
  </body>
</html>

<style is:global>
  @import '../styles/global.css';
</style>
```

#### 3. Create Header component
**File**: `packages/site/src/components/Header.astro`
**Changes**: New file

```astro
---
const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Docs', href: '/docs/getting-started' },
  { label: 'GitHub', href: 'https://github.com/oxedom/haflow', external: true },
];
---

<header class="border-b border-[var(--color-terminal-border)] bg-[var(--color-terminal-bg)]">
  <div class="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
    <a href="/" class="text-xl font-bold text-[var(--color-terminal-green)] hover:no-underline">
      <span class="text-[var(--color-terminal-text-muted)]">[</span>haflow<span class="text-[var(--color-terminal-text-muted)]">]</span>
    </a>
    <nav class="flex gap-6">
      {navItems.map((item) => (
        <a
          href={item.href}
          class="text-[var(--color-terminal-text-muted)] hover:text-[var(--color-terminal-text)]"
          target={item.external ? '_blank' : undefined}
          rel={item.external ? 'noopener noreferrer' : undefined}
        >
          {item.label}
        </a>
      ))}
    </nav>
  </div>
</header>
```

#### 4. Create Footer component
**File**: `packages/site/src/components/Footer.astro`
**Changes**: New file

```astro
---
const year = new Date().getFullYear();
---

<footer class="border-t border-[var(--color-terminal-border)] py-6 mt-auto">
  <div class="max-w-5xl mx-auto px-4 text-center text-[var(--color-terminal-text-muted)] text-sm">
    <p class="prompt">echo "MIT License {year} - Haflow"</p>
  </div>
</footer>
```

#### 5. Create Terminal component
**File**: `packages/site/src/components/Terminal.astro`
**Changes**: New file - reusable terminal-styled content box

```astro
---
interface Props {
  title?: string;
}

const { title } = Astro.props;
---

<div class="bg-[var(--color-terminal-bg-light)] border border-[var(--color-terminal-border)] rounded-lg overflow-hidden">
  {title && (
    <div class="px-4 py-2 border-b border-[var(--color-terminal-border)] flex items-center gap-2">
      <span class="w-3 h-3 rounded-full bg-[var(--color-terminal-red)]"></span>
      <span class="w-3 h-3 rounded-full bg-[var(--color-terminal-amber)]"></span>
      <span class="w-3 h-3 rounded-full bg-[var(--color-terminal-green)]"></span>
      <span class="ml-2 text-sm text-[var(--color-terminal-text-muted)]">{title}</span>
    </div>
  )}
  <div class="p-4">
    <slot />
  </div>
</div>
```

### Success Criteria:

#### Automated Verification:
- [ ] All files created as specified
- [ ] `pnpm --filter site build` completes without CSS errors

#### Manual Verification:
- [ ] JetBrains Mono font loads correctly
- [ ] Terminal color theme applies (dark bg, green/cyan accents)
- [ ] Scanline effect visible but subtle

**Implementation Note**: After completing this phase, verify styling by creating a minimal test page.

---

## Phase 3: Homepage

### Overview
Create the terminal-styled landing page with Haflow overview, features, and quick start instructions.

### Changes Required:

#### 1. Create homepage
**File**: `packages/site/src/pages/index.astro`
**Changes**: New file

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';
import Terminal from '../components/Terminal.astro';
---

<BaseLayout title="Home">
  <Header slot="header" />

  <div class="max-w-5xl mx-auto px-4 py-12">
    <!-- Hero -->
    <section class="text-center mb-16">
      <h1 class="text-4xl font-bold mb-4">
        <span class="text-[var(--color-terminal-green)]">$</span> haflow
      </h1>
      <p class="text-xl text-[var(--color-terminal-text-muted)] max-w-2xl mx-auto">
        Local-first orchestrator for AI-assisted missions with human gates and ephemeral sandboxes.
      </p>
    </section>

    <!-- Quick Start -->
    <section class="mb-16">
      <h2 class="text-2xl font-bold mb-6 prompt">Quick Start</h2>
      <Terminal title="terminal">
        <pre class="!bg-transparent !border-0 !p-0"><code><span class="text-[var(--color-terminal-text-muted)]"># Clone the repository</span>
<span class="text-[var(--color-terminal-green)]">$</span> git clone https://github.com/oxedom/haflow.git
<span class="text-[var(--color-terminal-green)]">$</span> cd haflow

<span class="text-[var(--color-terminal-text-muted)]"># Install dependencies</span>
<span class="text-[var(--color-terminal-green)]">$</span> pnpm install

<span class="text-[var(--color-terminal-text-muted)]"># Build shared package</span>
<span class="text-[var(--color-terminal-green)]">$</span> pnpm --filter @haflow/shared build

<span class="text-[var(--color-terminal-text-muted)]"># Run backend (port 4000)</span>
<span class="text-[var(--color-terminal-green)]">$</span> pnpm --filter @haflow/backend dev

<span class="text-[var(--color-terminal-text-muted)]"># Run frontend (port 5173) - in another terminal</span>
<span class="text-[var(--color-terminal-green)]">$</span> pnpm --filter frontend dev</code></pre>
      </Terminal>
    </section>

    <!-- What is Haflow -->
    <section class="mb-16">
      <h2 class="text-2xl font-bold mb-6 prompt">What is Haflow?</h2>
      <div class="grid md:grid-cols-2 gap-6">
        <div class="bg-[var(--color-terminal-bg-light)] border border-[var(--color-terminal-border)] rounded-lg p-6">
          <h3 class="text-lg font-bold text-[var(--color-terminal-amber)] mb-2">Mission-Based</h3>
          <p class="text-[var(--color-terminal-text-muted)]">
            Organize AI-assisted work into missions with clear goals, artifacts, and completion criteria.
          </p>
        </div>
        <div class="bg-[var(--color-terminal-bg-light)] border border-[var(--color-terminal-border)] rounded-lg p-6">
          <h3 class="text-lg font-bold text-[var(--color-terminal-amber)] mb-2">Human Gates</h3>
          <p class="text-[var(--color-terminal-text-muted)]">
            Every AI step requires human review and approval before proceeding - you stay in control.
          </p>
        </div>
        <div class="bg-[var(--color-terminal-bg-light)] border border-[var(--color-terminal-border)] rounded-lg p-6">
          <h3 class="text-lg font-bold text-[var(--color-terminal-amber)] mb-2">Ephemeral Sandboxes</h3>
          <p class="text-[var(--color-terminal-text-muted)]">
            Agent steps run in isolated Docker containers that are destroyed after completion.
          </p>
        </div>
        <div class="bg-[var(--color-terminal-bg-light)] border border-[var(--color-terminal-border)] rounded-lg p-6">
          <h3 class="text-lg font-bold text-[var(--color-terminal-amber)] mb-2">Local-First</h3>
          <p class="text-[var(--color-terminal-text-muted)]">
            Everything runs on your machine. Missions stored in ~/.haflow - no cloud required.
          </p>
        </div>
      </div>
    </section>

    <!-- Workflow -->
    <section class="mb-16">
      <h2 class="text-2xl font-bold mb-6 prompt">Workflow Pipeline</h2>
      <Terminal title="workflow.ts">
        <div class="space-y-2 text-sm">
          <div class="flex items-center gap-3">
            <span class="text-[var(--color-terminal-purple)]">1.</span>
            <span class="text-[var(--color-terminal-cyan)]">[agent]</span>
            <span>Cleanup raw input → structured text</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-[var(--color-terminal-purple)]">2.</span>
            <span class="text-[var(--color-terminal-amber)]">[human]</span>
            <span>Review structured text</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-[var(--color-terminal-purple)]">3.</span>
            <span class="text-[var(--color-terminal-cyan)]">[agent]</span>
            <span>Research → research output</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-[var(--color-terminal-purple)]">4.</span>
            <span class="text-[var(--color-terminal-amber)]">[human]</span>
            <span>Review research</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-[var(--color-terminal-purple)]">5.</span>
            <span class="text-[var(--color-terminal-cyan)]">[agent]</span>
            <span>Planning → implementation plan</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-[var(--color-terminal-purple)]">6.</span>
            <span class="text-[var(--color-terminal-amber)]">[human]</span>
            <span>Review plan</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-[var(--color-terminal-purple)]">7.</span>
            <span class="text-[var(--color-terminal-cyan)]">[agent]</span>
            <span>Implementation → result</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-[var(--color-terminal-purple)]">8.</span>
            <span class="text-[var(--color-terminal-amber)]">[human]</span>
            <span>Review implementation</span>
          </div>
        </div>
      </Terminal>
    </section>

    <!-- CTA -->
    <section class="text-center">
      <a
        href="/docs/getting-started"
        class="inline-block bg-[var(--color-terminal-green)] text-[var(--color-terminal-bg)] px-6 py-3 rounded font-bold hover:bg-[var(--color-terminal-green)]/90 hover:no-underline"
      >
        Read the Docs →
      </a>
    </section>
  </div>

  <Footer slot="footer" />
</BaseLayout>
```

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm --filter site build` completes successfully
- [ ] `dist/index.html` is generated

#### Manual Verification:
- [ ] Homepage renders with terminal aesthetic
- [ ] All sections visible (hero, quick start, features, workflow)
- [ ] Navigation links work
- [ ] Responsive on mobile

**Implementation Note**: Run `pnpm --filter site dev` to preview the homepage before proceeding.

---

## Phase 4: Docs System

### Overview
Set up Astro content collections for markdown documentation and create the docs layout and initial pages.

### Changes Required:

#### 1. Create content config
**File**: `packages/site/content.config.ts`
**Changes**: New file at package root

```typescript
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const docs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    order: z.number().optional().default(999),
  }),
});

export const collections = { docs };
```

#### 2. Create docs layout
**File**: `packages/site/src/layouts/DocsLayout.astro`
**Changes**: New file

```astro
---
import BaseLayout from './BaseLayout.astro';
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';
import { getCollection } from 'astro:content';

interface Props {
  title: string;
  description?: string;
}

const { title, description } = Astro.props;

const allDocs = await getCollection('docs');
const sortedDocs = allDocs.sort((a, b) => (a.data.order ?? 999) - (b.data.order ?? 999));
---

<BaseLayout title={title} description={description}>
  <Header slot="header" />

  <div class="max-w-5xl mx-auto px-4 py-8">
    <div class="flex gap-8">
      <!-- Sidebar -->
      <aside class="w-64 flex-shrink-0 hidden md:block">
        <nav class="sticky top-8">
          <h3 class="text-sm font-bold text-[var(--color-terminal-text-muted)] uppercase tracking-wider mb-4">
            Documentation
          </h3>
          <ul class="space-y-2">
            {sortedDocs.map((doc) => (
              <li>
                <a
                  href={`/docs/${doc.id}`}
                  class="block text-[var(--color-terminal-text-muted)] hover:text-[var(--color-terminal-text)] py-1"
                >
                  {doc.data.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <!-- Content -->
      <main class="flex-1 min-w-0">
        <article class="prose prose-invert prose-terminal max-w-none">
          <h1 class="text-3xl font-bold mb-2">{title}</h1>
          {description && (
            <p class="text-[var(--color-terminal-text-muted)] text-lg mb-8">{description}</p>
          )}
          <slot />
        </article>
      </main>
    </div>
  </div>

  <Footer slot="footer" />
</BaseLayout>

<style is:global>
  .prose-terminal {
    --tw-prose-body: var(--color-terminal-text);
    --tw-prose-headings: var(--color-terminal-text);
    --tw-prose-links: var(--color-terminal-cyan);
    --tw-prose-code: var(--color-terminal-amber);
    --tw-prose-pre-bg: var(--color-terminal-bg-light);
  }

  .prose-terminal h2,
  .prose-terminal h3,
  .prose-terminal h4 {
    color: var(--color-terminal-green);
  }

  .prose-terminal code:not(pre code) {
    background: var(--color-terminal-bg-light);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.875em;
  }
</style>
```

#### 3. Create docs dynamic route
**File**: `packages/site/src/pages/docs/[...slug].astro`
**Changes**: New file

```astro
---
import { getCollection, render } from 'astro:content';
import DocsLayout from '../../layouts/DocsLayout.astro';

export async function getStaticPaths() {
  const docs = await getCollection('docs');
  return docs.map((doc) => ({
    params: { slug: doc.id },
    props: { doc },
  }));
}

const { doc } = Astro.props;
const { Content } = await render(doc);
---

<DocsLayout title={doc.data.title} description={doc.data.description}>
  <Content />
</DocsLayout>
```

#### 4. Create Getting Started doc
**File**: `packages/site/src/content/docs/getting-started.md`
**Changes**: New file

```markdown
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
- Read the [API Reference](/docs/api)
```

#### 5. Create Architecture doc
**File**: `packages/site/src/content/docs/architecture.md`
**Changes**: New file

```markdown
---
title: Architecture
description: Understanding Haflow's architecture and components
order: 2
---

## Overview

Haflow is a pnpm monorepo with three main packages:

```
packages/
├── shared/      # @haflow/shared - Zod schemas + TypeScript types
├── backend/     # @haflow/backend - Express API + Docker sandbox
├── frontend/    # React 19 + Vite + TailwindCSS 4
└── cli/         # (Not yet implemented)
```

## Backend

The backend is an Express server running on port 4000 with the following services:

### Mission Store

File-based persistence under `~/.haflow/missions/`:

```
~/.haflow/
  missions/
    m-<uuid>/
      mission.json     # MissionMeta + workflow state
      artifacts/       # Workflow artifacts
      runs/            # Step execution records
      logs/            # Container output
```

### Mission Engine

Orchestrates workflow execution with 1-second container polling. Manages the state machine for mission progression.

### Docker Service

Handles Docker CLI execution, label-based container tracking, and log capture for agent steps.

### Sandbox Provider

Abstraction layer for container execution (designed to support k3s in the future).

## Frontend

React 19 application with:

- **TanStack Query** for data fetching with 2-second polling
- **Radix UI** primitives for accessible components
- **TailwindCSS 4** for styling

## Shared Package

Contains Zod schemas and TypeScript types used by both frontend and backend:

- `MissionMeta` - Mission metadata and status
- `StepRun` - Individual step execution records
- `ApiResponse<T>` - Standard API response wrapper
```

#### 6. Create Workflow doc
**File**: `packages/site/src/content/docs/workflow.md`
**Changes**: New file

```markdown
---
title: Workflow Pipeline
description: The 8-step mission workflow
order: 3
---

## Overview

Haflow uses an 8-step pipeline that alternates between AI agent steps and human review gates.

## The Pipeline

| Step | Type | Input | Output |
|------|------|-------|--------|
| 1 | Agent | `raw-input.md` | `structured-text.md` |
| 2 | Human | Review structured text | Approval |
| 3 | Agent | `structured-text.md` | `research-output.md` |
| 4 | Human | Review research | Approval |
| 5 | Agent | `research-output.md` | `implementation-plan.md` |
| 6 | Human | Review plan | Approval |
| 7 | Agent | `implementation-plan.md` | `implementation-result.json` |
| 8 | Human | Review implementation | Completion |

## Agent Steps

Agent steps run in isolated Docker containers. The container:

1. Receives input artifacts from the previous step
2. Processes them (currently mock implementation)
3. Produces output artifacts for the next step
4. Is destroyed after completion

## Human Gates

Human review steps require explicit approval before the mission can continue. This ensures:

- Quality control at each stage
- Opportunity to provide feedback
- Safe iteration on complex tasks

## Customizing Workflows

The current workflow is hardcoded in `src/services/workflow.ts`. Future versions will support:

- Custom step definitions
- Conditional branching
- Parallel execution paths
```

#### 7. Add @tailwindcss/typography for prose styling
**File**: `packages/site/package.json`
**Changes**: Add typography plugin to dependencies

```json
{
  "name": "site",
  "type": "module",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "astro": "astro"
  },
  "dependencies": {
    "astro": "^5.2.0",
    "@tailwindcss/typography": "^0.5.19"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.0",
    "tailwindcss": "^4.1.0",
    "typescript": "~5.9.3"
  }
}
```

#### 8. Update global.css to include typography plugin
**File**: `packages/site/src/styles/global.css`
**Changes**: Add plugin import at top

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";

/* ... rest of file unchanged ... */
```

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm --filter site build` completes successfully
- [ ] `dist/docs/getting-started/index.html` exists
- [ ] `dist/docs/architecture/index.html` exists
- [ ] `dist/docs/workflow/index.html` exists

#### Manual Verification:
- [ ] Docs sidebar shows all pages in correct order
- [ ] Markdown renders with terminal styling
- [ ] Code blocks styled correctly
- [ ] Navigation between docs pages works

**Implementation Note**: After completing this phase, verify all docs render correctly and links work.

---

## Phase 5: Root Scripts Integration

### Overview
Update root package.json to include site scripts in the monorepo workflow.

### Changes Required:

#### 1. Update root package.json
**File**: `package.json` (root)
**Changes**: Add site to scripts

```json
{
  "name": "haflow",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/oxedom/haflow.git"
  },
  "description": "",
  "keywords": [],
  "author": "",
  "license": "ISC",
  "packageManager": "pnpm@10.28.0",
  "scripts": {
    "dev": "pnpm --filter @haflow/shared build && pnpm --parallel --filter @haflow/backend --filter frontend dev",
    "build:all": "pnpm --filter @haflow/shared build && pnpm --filter @haflow/backend build && pnpm --filter frontend build && pnpm --filter @haflow/cli build && pnpm --filter site build",
    "site:dev": "pnpm --filter site dev",
    "site:build": "pnpm --filter site build",
    "site:preview": "pnpm --filter site preview"
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm site:dev` starts Astro dev server
- [ ] `pnpm site:build` builds static site
- [ ] `pnpm build:all` includes site in build

#### Manual Verification:
- [ ] Site accessible at http://localhost:4321 during dev

**Implementation Note**: This completes the integration. The site is now part of the monorepo workflow.

---

## Testing Strategy

### Automated Tests:
- Build passes: `pnpm --filter site build`
- TypeScript types valid: `pnpm --filter site astro check`

### Manual Testing Steps:
1. Run `pnpm --filter site dev` and verify homepage loads
2. Navigate to each docs page via sidebar
3. Check mobile responsiveness (resize browser)
4. Verify all links work (internal and external)
5. Check terminal aesthetic renders correctly (fonts, colors)
6. Run `pnpm --filter site build && pnpm --filter site preview` to test production build

## Performance Considerations

- Static site generation means fast page loads
- Fonts loaded from Google Fonts CDN (consider self-hosting for privacy)
- No JavaScript required for basic functionality (Astro islands pattern)

## References

- [Astro Documentation](https://docs.astro.build/)
- [TailwindCSS v4 with Astro](https://tailwindcss.com/docs/installation/framework-guides/astro)
- [Astro Content Collections](https://docs.astro.build/en/guides/content-collections/)
- Existing frontend patterns: `packages/frontend/`
