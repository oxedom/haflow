import { spawn } from 'child_process';

// Interface for Claude resources with associated stopper
interface ClaudeResource {
  path: string;
  stopper: string;
}

let logString = ''
let errString = ''

// Default stopper for resources without specific completion criteria
const DEFAULT_STOPPER =
  'When the task is complete, output <promise>COMPLETE</promise>. If the task fails, output <promise>FAILED</promise>.';

// Associative object of Claude resources (skills, agents, commands)
const claudeResources = {
  // Skills
  complexTaskPlanner: {
    path: '@.claude/skills/complex-task-planner/SKILL.md',
    stopper: DEFAULT_STOPPER,
  },
  playwright: {
    path: '@.claude/skills/playwright/SKILL.md',
    stopper: DEFAULT_STOPPER,
  },
  reactBestPractices: {
    path: '@.claude/skills/react-best-practices/SKILL.md',
    stopper: DEFAULT_STOPPER,
  },
  skillCreator: {
    path: '@.claude/skills/skill-creator/SKILL.md',
    stopper: DEFAULT_STOPPER,
  },
  sqlPro: {
    path: '@.claude/skills/sql-pro/SKILL.md',
    stopper: DEFAULT_STOPPER,
  },
  usingGitWorktrees: {
    path: '@.claude/skills/using-git-worktrees/SKILL.md',
    stopper: DEFAULT_STOPPER,
  },
  smallToBeforeResearch: {
    path: '@.claude/skills/small-to-before-research/SKILL.md',
    stopper: DEFAULT_STOPPER,
  },

  // Agents
  claudeJanitor: {
    path: '@.claude/agents/claude-janitor.md',
    stopper: DEFAULT_STOPPER,
  },
  codebaseAnalyzer: {
    path: '@.claude/agents/codebase-analyzer.md',
    stopper: DEFAULT_STOPPER,
  },
  codebaseLocator: {
    path: '@.claude/agents/codebase-locator.md',
    stopper: DEFAULT_STOPPER,
  },
  codebasePatternFinder: {
    path: '@.claude/agents/codebase-pattern-finder.md',
    stopper: DEFAULT_STOPPER,
  },
  securityVulnerabilityDetector: {
    path: '@.claude/agents/security-vulnerability-detector.md',
    stopper: DEFAULT_STOPPER,
  },

  thoughtsAnalyzer: {
    path: '@.claude/agents/thoughts-analyzer.md',
    stopper:
      'If, while analyzing the thoughts, you notice the research is complete, output <promise>COMPLETE</promise>. If the research has failed, output <promise>FAILED</promise>.',
  },
  thoughtsLocator: {
    path: '@.claude/agents/thoughts-locator.md',
    stopper: DEFAULT_STOPPER,
  },
  webSearchResearcher: {
    path: '@.claude/agents/web-search-researcher.md',
    stopper: DEFAULT_STOPPER,
  },

  // Commands
  ciCommit: {
    path: '@.claude/commands/ci_commit.md',
    stopper: DEFAULT_STOPPER,
  },
  commitPushCreatePr: {
    path: '@.claude/commands/commit-push-create-pr.md',
    stopper:
      'When commit and PR creation is complete, output <promise>COMPLETE</promise>. If it fails, output <promise>FAILED</promise>.',
  },
  createHandoff: {
    path: '@.claude/commands/create_handoff.md',
    stopper: DEFAULT_STOPPER,
  },
  createPlan: {
    path: '@.claude/commands/create_plan.md',
    stopper:
      'When the implementation plan is complete, output <promise>COMPLETE</promise>. If planning fails, output <promise>FAILED</promise>.',
  },
  createPlanGeneric: {
    path: '@.claude/commands/create_plan_generic.md',
    stopper:
      'When the implementation plan is complete, output <promise>COMPLETE</promise>. If planning fails, output <promise>FAILED</promise>.',
  },
  createPlanNt: {
    path: '@.claude/commands/create_plan_nt.md',
    stopper:
      'When the implementation plan is complete, output <promise>COMPLETE</promise>. If planning fails, output <promise>FAILED</promise>.',
  },
  debug: {
    path: '@.claude/commands/debug.md',
    stopper: DEFAULT_STOPPER,
  },
  founderMode: {
    path: '@.claude/commands/founder_mode.md',
    stopper: DEFAULT_STOPPER,
  },
  implementPlan: {
    path: '@.claude/commands/implement_plan.md',
    stopper:
      'When implementation is complete, output <promise>COMPLETE</promise>. If implementation fails, output <promise>FAILED</promise>.',
  },
  iteratePlan: {
    path: '@.claude/commands/iterate_plan.md',
    stopper: DEFAULT_STOPPER,
  },
  iteratePlanNt: {
    path: '@.claude/commands/iterate_plan_nt.md',
    stopper: DEFAULT_STOPPER,
  },
  oneshot: {
    path: '@.claude/commands/oneshot.md',
    stopper: DEFAULT_STOPPER,
  },
  oneshotPlan: {
    path: '@.claude/commands/oneshot_plan.md',
    stopper: DEFAULT_STOPPER,
  },
  ralphImpl: {
    path: '@.claude/commands/ralph_impl.md',
    stopper: DEFAULT_STOPPER,
  },
  ralphPlan: {
    path: '@.claude/commands/ralph_plan.md',
    stopper: DEFAULT_STOPPER,
  },
  ralphResearch: {
    path: '@.claude/commands/ralph_research.md',
    stopper: DEFAULT_STOPPER,
  },
  researchCodebase: {
    path: '@.claude/commands/research_codebase.md',
    stopper:
      'When codebase research is complete, output <promise>COMPLETE</promise>. If research fails, output <promise>FAILED</promise>.',
  },
  researchCodebaseGeneric: {
    path: '@.claude/commands/research_codebase_generic.md',
    stopper:
      'When codebase research is complete, output <promise>COMPLETE</promise>. If research fails, output <promise>FAILED</promise>.',
  },
  researchCodebaseNt: {
    path: '@.claude/commands/research_codebase_nt.md',
    stopper:
      'When codebase research is complete, output <promise>COMPLETE</promise>. If research fails, output <promise>FAILED</promise>.',
  },
  tree: {
    path: '@.claude/commands/tree.md',
    stopper: DEFAULT_STOPPER,
  },
  validatePlan: {
    path: '@.claude/commands/validate_plan.md',
    stopper: DEFAULT_STOPPER,
  },
} satisfies Record<string, ClaudeResource>;

// Type for valid resource keys
type ClaudeResourceKey = keyof typeof claudeResources;

/**
 * Creates a formatted input string with role and input wrapped in XML tags
 */
function createInput(resource: ClaudeResource, input?: string): string {
  let result = `<role>${resource.path}</role>`;
  if (input) {
    result += `\n<input>${input}</input>`;
  }
  result += `\n${resource.stopper}`;
  return result;
}

/**
 * Runs docker sandbox with claude CLI
 * Returns all output (stdout and stderr) from the claude process
 */
function runClaude(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Use script to provide a pseudo-TTY for docker sandbox
    // Use --credentials host to use host's Claude credentials
    const escapedPrompt = prompt.replace(/'/g, "'\\''");
    const homeDir = process.env.HOME || '/home/sam';
    const claudeDir = `${homeDir}/.claude`;
    const child = spawn('script', ['-q', '-c', `docker sandbox run -v ${claudeDir}:/home/agent/.claude -- claude --print -p '${escapedPrompt}'`, '/dev/null']);

    let output = '';

    child.stdout.on('data', (data: Buffer) => {
      console.log(data.toString())
      output += data.toString();
      logString += data.toString();
    });

    child.stderr.on('data', (data: Buffer) => {
      console.error(data.toString())
      output += data.toString();
      errString += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`Process exited with code ${code}: ${output}`));
      } else {
        resolve(output);
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Runs a Claude resource with optional input, handling the completion loop
 * @param dryRun - If true, adds instruction to prevent file writes (output only)
 */
async function runClaudeResource(
  resourceKey: ClaudeResourceKey,
  input?: string,
  dryRun?: boolean
): Promise<string> {
  const resource = claudeResources[resourceKey];
  if (!resource) {
    throw new Error(`Unknown resource: ${resourceKey}`);
  }

  let finalInput = input || '';
  if (dryRun) {
    finalInput += '\n\n⚠️ DRY RUN MODE: Do NOT write any files to disk. Only output analysis/plans/results as text. Save all content to variables, not files.';
  }

  const prompt = createInput(resource, finalInput);

  while (true) {
    const result = await runClaude(prompt);
    console.log(result);

    if (result.includes('<promise>COMPLETE</promise>')) {
      console.log(`${resourceKey} complete.`);
      return result;
    }

    if (result.includes('<promise>FAILED</promise>')) {
      console.log(`${resourceKey} failed.`);
      throw new Error(`${resourceKey} failed`);
    }
  }
}

async function rawToResearch(): Promise<string> {
  return runClaudeResource('thoughtsAnalyzer');
}



function humanReview(researchData: string): Promise<any> {
  // TODO: Implement human review UI/CLI interaction
  console.log('Human review required for research data');
  return Promise.resolve(researchData);
}


// AI process functions using runClaudeResource
async function aiResearchCodebase(approvedSpec: string): Promise<string> {
  return runClaudeResource('researchCodebase', `Spec to research:\n${approvedSpec}`);
}

async function aiCreateImplementationPlan(approvedResearch: string): Promise<string> {
  return runClaudeResource('createPlan', `Research data:\n${approvedResearch}`);
}

async function executeSafeImplementation(finalPlan: string): Promise<string> {
  return runClaudeResource('implementPlan', `Plan to implement:\n${finalPlan}`);
}

async function createCommitAndOpenPR(codeChanges: string): Promise<string> {
  return runClaudeResource('commitPushCreatePr', `Changes summary:\n${codeChanges}`);
}

// Main pipeline execution (commented out - use runFullPipeline() to execute)
async function runFullPipeline(): Promise<void> {
  try {
    const specDoc = await rawToResearch();
    const approvedSpec = await humanReview(specDoc);
    const researchData = await aiResearchCodebase(approvedSpec);
    const approvedResearch = await humanReview(researchData);
    const plan = await aiCreateImplementationPlan(approvedResearch);
    const finalPlan = await humanReview(plan);
    const codeChanges = await executeSafeImplementation(finalPlan);
    await createCommitAndOpenPR(codeChanges);
  } catch (err) {
    console.error('Pipeline failed:', err);
    process.exit(1);
  }
}

// ============================================================================
// MINI DEMO: Creates a cooking index.html page
// Run with: npx tsx packages/backend/src/claude-runner.ts
// ============================================================================
async function runCookingDemo(): Promise<void> {
  console.log('🍳 Starting Cooking Page Demo...\n');

  const cookingPrompt = `
Create a beautiful cooking recipe index.html page with the following:
- A header with "Delicious Recipes" title
- A responsive CSS grid layout
- 3 recipe cards with:
  1. Spaghetti Carbonara (Italian)
  2. Chicken Tikka Masala (Indian)
  3. Beef Tacos (Mexican)
- Each card should have: recipe name, cuisine type, cooking time, and a brief description
- Use a warm color palette (oranges, reds, browns)
- Add hover effects on cards
- Include a footer with "Made with ❤️"
- Save it as cooking-index.html in the current directory

When done, output <promise>COMPLETE</promise>
`;

  try {
    const result = await runClaude(cookingPrompt);
    console.log(result);

    if (result.includes('<promise>COMPLETE</promise>')) {
      console.log('\n✅ Demo complete! Check cooking-index.html');
    } else if (result.includes('<promise>FAILED</promise>')) {
      console.log('\n❌ Demo failed');
    }
  } catch (err) {
    console.error('Demo error:', err);
  }
}

// Run demo when executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runCookingDemo();
}

export type { ClaudeResource, ClaudeResourceKey };

export {
  claudeResources,
  createInput,
  runClaude,
  runClaudeResource,
  rawToResearch,
  runFullPipeline,
  runCookingDemo,
  aiResearchCodebase,
  aiCreateImplementationPlan,
  executeSafeImplementation,
  createCommitAndOpenPR,
};
