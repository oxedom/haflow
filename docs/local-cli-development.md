# Local CLI Development Guide

How to test the `haflow` CLI locally without publishing to npm.

## Quick Setup

```bash
# 1. Build the CLI
pnpm --filter @haflow/cli build

# 2. Link globally
cd packages/cli
pnpm link --global

# 3. Verify installation
haflow --version
```

Now `haflow` is available globally and points to your local source.

## Usage

```bash
# Initialize haflow home directory
haflow init

# Link a project you want to work on
cd /path/to/your/project
haflow link

# Or specify path directly
haflow link /path/to/your/project

# Start haflow services (backend + frontend)
haflow start

# Check status
haflow status
```

## Development Workflow

### Rebuilding After Changes

When you modify CLI source code:

```bash
# Rebuild
pnpm --filter @haflow/cli build

# Your global `haflow` command automatically uses the new build
# (no need to re-link)
```

### Watch Mode (for rapid iteration)

Instead of building and linking, run directly with tsx:

```bash
cd packages/cli
pnpm dev -- init           # Run init command
pnpm dev -- link /my/proj  # Run link command
pnpm dev -- start          # Run start command
```

This uses `tsx` to run TypeScript directly without compilation.

### Running Without Global Link

You can also run the CLI directly without global linking:

```bash
# From repo root
node packages/cli/dist/index.js --version

# Or with pnpm
pnpm --filter @haflow/cli exec haflow --version
```

## Unlinking

To remove the global link:

```bash
cd packages/cli
pnpm unlink --global
```

## Troubleshooting

### Command not found after linking

Check if pnpm's global bin directory is in your PATH:

```bash
pnpm bin -g
# Add this to your shell profile if not in PATH
```

For bash/zsh, add to `~/.bashrc` or `~/.zshrc`:
```bash
export PATH="$(pnpm bin -g):$PATH"
```

### Changes not reflecting

Make sure you rebuilt after changes:
```bash
pnpm --filter @haflow/cli build
```

### Permission errors

If you get permission errors, pnpm typically handles this better than npm. If issues persist:
```bash
pnpm config set global-bin-dir ~/.local/bin
# Then ensure ~/.local/bin is in your PATH
```

## npm Alternative (if not using pnpm)

```bash
# Build first
cd packages/cli
npm run build

# Link globally
npm link

# Unlink when done
npm unlink -g @haflow/cli
```

## File Locations

- CLI source: `packages/cli/src/`
- Built output: `packages/cli/dist/`
- Haflow home: `~/.haflow/`
- Config file: `~/.haflow/config.json`
