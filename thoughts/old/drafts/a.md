# How To Stream Claude Code Output From a Headless Process

This guide is for people running Claude Code in a non-interactive/headless mode (e.g., from a script or container) who hit that frustration point: running the process and ending up staring at a blank screen with no output.

## The Problem: A Blank Screen

When you want to run Claude Code headlessly in a loop, you might use a script like this:

```bash
#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

ARTIFACTS_PATH="$(pwd)/artifacts"
CLAUDE_AUTH_PATH="$HOME/.claude/.credentials.json"
WORKING_DIR="/work"
IMAGE="haflow-claude-sandbox:latest"

for ((i=1; i<=$1; i++)); do
  result=$(docker run --rm -i \
    --user "$(id -u):$(id -g)" \
    -v "$ARTIFACTS_PATH:$WORKING_DIR/artifacts" \
    -v "$CLAUDE_AUTH_PATH:/home/agent/.claude/.credentials.json:ro" \
    -w "$WORKING_DIR" \
    "$IMAGE" \
    claude \
    --print \
    "<your prompt here>")

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo "Complete after $i iterations."
    exit 0
  fi
done
```

The issue here is frustrating: when you run Claude with the `--print` flag, you get zero streaming output. Your terminal goes blank.

You walk away, and you have absolutely no idea what's happening. Is Claude working? Is it stuck? Did something break? You won't know until it's finished.

The dream is to get the best of both worlds: real-time visibility into what Claude is doing, but also the ability to leave it running unattended.

## The Solution: Streaming with jq

Claude can output `stream-json` format, which gives you every single message as it happens. But that output is extremely verbose and unreadable.

By combining `stream-json` with `jq` filtering, you can extract just the useful information and stream it to your terminal in real-time. At the same time, you capture the final result to check for the `<promise>COMPLETE</promise>` marker.

Here's the complete script:

```bash
#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

ARTIFACTS_PATH="$(pwd)/artifacts"
CLAUDE_AUTH_PATH="$HOME/.claude/.credentials.json"
WORKING_DIR="/work"
IMAGE="haflow-claude-sandbox:latest"

# jq filter to extract streaming text from assistant messages
stream_text='select(.type == "assistant").message.content[]? | select(.type == "text").text // empty | gsub("\n"; "\r\n") | . + "\r\n\n"'

# jq filter to extract final result
final_result='select(.type == "result").result // empty'

for ((i=1; i<=$1; i++)); do
  tmpfile=$(mktemp)
  trap "rm -f $tmpfile" EXIT

  docker run --rm -i \
    --user "$(id -u):$(id -g)" \
    -v "$ARTIFACTS_PATH:$WORKING_DIR/artifacts" \
    -v "$CLAUDE_AUTH_PATH:/home/agent/.claude/.credentials.json:ro" \
    -w "$WORKING_DIR" \
    "$IMAGE" \
    claude \
    --verbose \
    --print \
    --output-format stream-json \
    --dangerously-skip-permissions \
    "<your prompt here>" \
  | grep --line-buffered '^{' \
  | tee "$tmpfile" \
  | jq --unbuffered -rj "$stream_text"

  result=$(jq -r "$final_result" "$tmpfile")

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo "Complete after $i iterations."
    exit 0
  fi
done
```

This script accepts one argument: the number of iterations to run.

## Walking Through the Script Structure

### Breaking Down the Stream Filter

The stream filter does several important things:

- **Selects assistant messages**: `select(.type == "assistant")` grabs only Claude's responses
- **Extracts text content**: `.message.content[]? | select(.type == "text").text` pulls out just the text portions
- **Fixes line endings**: `gsub("\n"; "\r\n")` replaces newlines with carriage return + newline
- **Adds spacing**: `. + "\r\n\n"` inserts extra space between messages

The carriage return replacement fixes a bug where the cursor wasn't returning to the first character of the line properly.

### The Data Pipeline

Here's how data flows through the script:

1. **Docker streams out `stream-json` formatted data**, but it includes some non-JSON lines (noise). The `grep --line-buffered '^{'` filter ensures only valid JSON lines get processed.

2. **`tee "$tmpfile"`** writes everything to a temporary file without stopping the stream. You need this file later to check if Claude has finished.

3. **`jq --unbuffered -rj "$stream_text"`** applies the streaming filter and displays the text in real-time to your terminal.

## Conclusion

This is a workable solution to get real-time streaming output from Claude Code when running it as a headless process. The key insight is using `--output-format stream-json` combined with `jq` filtering to make the output human-readable while still capturing the full result for programmatic checks.
