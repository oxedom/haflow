#!/usr/bin/env npx tsx
/**
 * Dev script to test Claude sandbox streaming
 * Usage: npx tsx scripts/dev-claude-sandbox.ts
 */

import { dockerProvider } from '../src/services/docker.js';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

const PROMPT = 'Create a file called hello.txt with lorem ipsum content (at least 3 paragraphs).';

async function main() {
  // Check Docker availability
  const available = await dockerProvider.isAvailable();
  if (!available) {
    console.error('❌ Docker is not available. Make sure Docker Desktop is running.');
    process.exit(1);
  }
  console.log('✅ Docker is available');

  // Create artifacts directory
  const artifactsPath = join(process.cwd(), '.sandbox-dev', randomUUID());
  if (!existsSync(artifactsPath)) {
    mkdirSync(artifactsPath, { recursive: true });
  }
  console.log(`📁 Artifacts directory: ${artifactsPath}`);

  // Setup graceful shutdown
  let terminated = false;
  process.on('SIGINT', () => {
    console.log('\n⚠️  Received SIGINT, shutting down...');
    terminated = true;
  });
  process.on('SIGTERM', () => {
    console.log('\n⚠️  Received SIGTERM, shutting down...');
    terminated = true;
  });

  console.log(`\n🚀 Starting Claude sandbox with prompt:\n   "${PROMPT}"\n`);
  console.log('─'.repeat(60));

  const options = {
    missionId: `m-${randomUUID()}`,
    runId: `r-${randomUUID()}`,
    stepId: 'dev-test',
    artifactsPath,
    prompt: PROMPT,
  };

  try {
    const stream = dockerProvider.startClaudeStreaming!(options);

    for await (const event of stream) {
      if (terminated) {
        console.log('\n🛑 Terminated by user');
        break;
      }

      switch (event.type) {
        case 'init':
          console.log(`[init] ${event.text}`);
          break;
        case 'assistant':
          // Stream text without newline for smooth output
          if (event.text) {
            process.stdout.write(event.text);
          }
          if (event.isComplete) {
            console.log('\n\n✅ COMPLETE marker detected');
          }
          break;
        case 'tool_use':
          console.log(`\n[tool] ${event.toolName}`);
          if (event.text) {
            console.log(event.text);
          }
          break;
        case 'result':
          console.log(`\n[result] ${event.result}`);
          break;
        case 'error':
          console.error(`\n❌ [error] ${event.text}`);
          break;
      }
    }

    console.log('\n' + '─'.repeat(60));
    console.log(`\n📂 Check artifacts at: ${artifactsPath}`);
    console.log('   Run: ls -la ' + artifactsPath);

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
