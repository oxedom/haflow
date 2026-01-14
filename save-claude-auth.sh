#!/bin/bash

# Goal: Extract Claude authentication credentials from a Docker sandbox container.

OUTPUT_FILE=".claude-auth.json"
CONTAINER_IMAGE="docker/sandbox-templates:claude-code"
TIMEOUT=30
INTERVAL=1

echo "Starting Claude sandbox container..."
# Start in background using script to emulate TTY. 
# We direct the typescript output to /dev/null.
script -q -c "docker sandbox run claude" /dev/null &
SCRIPT_PID=$!

echo "Waiting for container to start (PID: $SCRIPT_PID)..."
CONTAINER_ID=""
ELAPSED=0

while [ -z "$CONTAINER_ID" ]; do
  if [ $ELAPSED -ge $TIMEOUT ]; then
    echo "Error: Timeout waiting for container to start."
    # Cleanup background process
    kill $SCRIPT_PID 2>/dev/null
    exit 1
  fi
  
  # Find container by image ancestor
  CONTAINER_ID=$(docker ps -q --filter "ancestor=$CONTAINER_IMAGE" | head -n 1)
  
  if [ -n "$CONTAINER_ID" ]; then
    break
  fi
  
  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))
done

echo "Container found: $CONTAINER_ID"

echo "Extracting auth credentials..."
# Try to cat the file
EXTRACT_SUCCESS=false
if docker exec "$CONTAINER_ID" cat /home/agent/.claude.json > "$OUTPUT_FILE" 2>/dev/null; then
  if [ -s "$OUTPUT_FILE" ]; then
    echo "Successfully saved credentials to $OUTPUT_FILE"
    EXTRACT_SUCCESS=true
  else
    echo "Error: Auth file is empty or missing in the container."
    rm -f "$OUTPUT_FILE"
  fi
else
  echo "Error: Failed to read /home/agent/.claude.json from container."
fi

echo "Cleaning up..."
# Kill the background script process
kill $SCRIPT_PID 2>/dev/null
# Stop the container
docker stop "$CONTAINER_ID" >/dev/null

if [ "$EXTRACT_SUCCESS" = true ]; then
  echo "Done."
  exit 0
else
  echo "Failed to extract auth credentials."
  exit 1
fi
