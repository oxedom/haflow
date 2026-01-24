#!/bin/bash
set -e

# Claude Code Sandbox Entrypoint
# Handles automatic credential management and launches Claude

# ============================================================================
# Credential Management
# ============================================================================

# Anthropic API Key - check multiple sources
if [ -z "$ANTHROPIC_API_KEY" ]; then
    # Check for mounted secret file
    if [ -f "/run/secrets/anthropic_api_key" ]; then
        export ANTHROPIC_API_KEY=$(cat /run/secrets/anthropic_api_key)
    elif [ -f "$HOME/.anthropic/api_key" ]; then
        export ANTHROPIC_API_KEY=$(cat "$HOME/.anthropic/api_key")
    fi
fi

# GitHub Token - configure gh CLI if available
if [ -n "$GITHUB_TOKEN" ]; then
    echo "$GITHUB_TOKEN" | gh auth login --with-token 2>/dev/null || true
elif [ -f "/run/secrets/github_token" ]; then
    cat /run/secrets/github_token | gh auth login --with-token 2>/dev/null || true
elif [ -f "$HOME/.config/gh/hosts.yml" ]; then
    # Already authenticated via mounted config
    :
fi

# Git configuration - use mounted .gitconfig or set defaults
if [ ! -f "$HOME/.gitconfig" ]; then
    if [ -n "$GIT_USER_NAME" ] && [ -n "$GIT_USER_EMAIL" ]; then
        git config --global user.name "$GIT_USER_NAME"
        git config --global user.email "$GIT_USER_EMAIL"
    fi
fi

# Docker socket - verify access if mounted
if [ -S "/var/run/docker.sock" ]; then
    # Add agent to docker group if socket is accessible
    if ! docker info >/dev/null 2>&1; then
        echo "Warning: Docker socket mounted but not accessible" >&2
    fi
fi

# ============================================================================
# Workspace Setup
# ============================================================================

# If a project is mounted at /workspace, use it
if [ -d "/workspace" ]; then
    cd /workspace
fi

# Create artifacts directory if it doesn't exist
mkdir -p /workspace/artifacts 2>/dev/null || true

# ============================================================================
# Execute Command
# ============================================================================

# If no arguments provided, default to Claude with skip-permissions
if [ $# -eq 0 ]; then
    exec claude --dangerously-skip-permissions
fi

# If first argument is 'claude', ensure --dangerously-skip-permissions is set
if [ "$1" = "claude" ]; then
    shift
    # Check if --dangerously-skip-permissions is already in args
    skip_perms_set=false
    for arg in "$@"; do
        if [ "$arg" = "--dangerously-skip-permissions" ]; then
            skip_perms_set=true
            break
        fi
    done

    if [ "$skip_perms_set" = "false" ]; then
        exec claude --dangerously-skip-permissions "$@"
    else
        exec claude "$@"
    fi
fi

# Execute any other command directly
exec "$@"
