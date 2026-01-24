# Claude Code Sandbox Template

A Docker image for running Claude Code in ephemeral sandboxes with automatic credential management.

## Features

- **Claude Code** pre-installed with `--dangerously-skip-permissions` default
- **Development tools**: Docker CLI, GitHub CLI, Node.js 20, Go 1.22, Python 3, Git, ripgrep, jq
- **Non-root execution**: Runs as `agent` user with sudo access
- **Credential injection**: Automatic API key and token management

## Build

```bash
# From this directory
docker build -t haflow/sandbox-templates:claude-code .

# With specific Claude Code version
docker build --build-arg CLAUDE_CODE_VERSION=1.0.0 -t haflow/sandbox-templates:claude-code .
```

## Usage

### Basic Run

```bash
docker run -it --rm \
  -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  -v $(pwd):/workspace \
  haflow/sandbox-templates:claude-code
```

### With GitHub Authentication

```bash
docker run -it --rm \
  -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  -e GITHUB_TOKEN="$GITHUB_TOKEN" \
  -v $(pwd):/workspace \
  haflow/sandbox-templates:claude-code
```

### With Docker-in-Docker

```bash
docker run -it --rm \
  -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v $(pwd):/workspace \
  haflow/sandbox-templates:claude-code
```

### Custom Command

```bash
# Run a specific prompt
docker run -it --rm \
  -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  -v $(pwd):/workspace \
  haflow/sandbox-templates:claude-code \
  claude --print "Explain this codebase"

# Run bash instead
docker run -it --rm \
  -v $(pwd):/workspace \
  haflow/sandbox-templates:claude-code \
  bash
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `GITHUB_TOKEN` | GitHub personal access token (auto-configures `gh` CLI) |
| `GIT_USER_NAME` | Git user name (if .gitconfig not mounted) |
| `GIT_USER_EMAIL` | Git user email (if .gitconfig not mounted) |

## Mounted Secrets

The entrypoint also checks for Docker secrets:

- `/run/secrets/anthropic_api_key` - Anthropic API key
- `/run/secrets/github_token` - GitHub token

## Included Tools

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20.x | With npm |
| Go | 1.22.5 | |
| Python | 3.x | With pip and venv |
| Docker CLI | Latest | Requires socket mount for DinD |
| GitHub CLI | Latest | Auto-auth with GITHUB_TOKEN |
| Git | Latest | |
| ripgrep | Latest | Fast search |
| jq | Latest | JSON processing |

## User Configuration

- **Username**: `agent`
- **Home**: `/home/agent`
- **Workspace**: `/workspace`
- **Sudo**: Passwordless sudo access
