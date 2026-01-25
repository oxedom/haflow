set -e

# Associative array of Claude resources (skills, agents, commands)
declare -A claudeResources=(
  # Skills
  [complexTaskPlanner]='@.claude/skills/complex-task-planner/SKILL.md'
  [playwright]='@.claude/skills/playwright/SKILL.md'
  [reactBestPractices]='@.claude/skills/react-best-practices/SKILL.md'
  [skillCreator]='@.claude/skills/skill-creator/SKILL.md'
  [sqlPro]='@.claude/skills/sql-pro/SKILL.md'
  [usingGitWorktrees]='@.claude/skills/using-git-worktrees/SKILL.md'

  # Agents
  [claudeJanitor]='@.claude/agents/claude-janitor.md'
  [codebaseAnalyzer]='@.claude/agents/codebase-analyzer.md'
  [codebaseLocator]='@.claude/agents/codebase-locator.md'
  [codebasePatternFinder]='@.claude/agents/codebase-pattern-finder.md'
  [securityVulnerabilityDetector]='@.claude/agents/security-vulnerability-detector.md'
  [thoughtsAnalyzer]='@.claude/agents/thoughts-analyzer.md'
  [thoughtsLocator]='@.claude/agents/thoughts-locator.md'
  [webSearchResearcher]='@.claude/agents/web-search-researcher.md'

  # Commands
  [ciCommit]='@.claude/commands/ci_commit.md'
  [commitPushCreatePr]='@.claude/commands/commit-push-create-pr.md'
  [createHandoff]='@.claude/commands/create_handoff.md'
  [createPlan]='@.claude/commands/create_plan.md'
  [createPlanGeneric]='@.claude/commands/create_plan_generic.md'
  [createPlanNt]='@.claude/commands/create_plan_nt.md'
  [debug]='@.claude/commands/debug.md'
  [founderMode]='@.claude/commands/founder_mode.md'
  [implementPlan]='@.claude/commands/implement_plan.md'
  [iteratePlan]='@.claude/commands/iterate_plan.md'
  [iteratePlanNt]='@.claude/commands/iterate_plan_nt.md'
  [oneshot]='@.claude/commands/oneshot.md'
  [oneshotPlan]='@.claude/commands/oneshot_plan.md'
  [ralphImpl]='@.claude/commands/ralph_impl.md'
  [ralphPlan]='@.claude/commands/ralph_plan.md'
  [ralphResearch]='@.claude/commands/ralph_research.md'
  [researchCodebase]='@.claude/commands/research_codebase.md'
  [researchCodebaseGeneric]='@.claude/commands/research_codebase_generic.md'
  [researchCodebaseNt]='@.claude/commands/research_codebase_nt.md'
  [tree]='@.claude/commands/tree.md'
  [validatePlan]='@.claude/commands/validate_plan.md'
)

# Function that takes input string and runs docker sandbox with claude
# Returns all output (stdout and stderr) from the claude process
# Parameters: input (prompt string), stopper (completion marker)
run_claude() {
  local input="$1"
  local stopper="$2"
  local output
  output=$(docker sandbox run claude -p "${input} ${stopper}" 2>&1)
  echo "$output"
}

analyze_task_until_complete() {
  while true; do
    result=$(run_claude "Please carefully refine the following free-text task into a clear and actionable pre-PRD (preliminary product requirements document): ${task}. If you determine during your analysis that the task is already complete, output <promise>COMPLETE</promise>. If the research or refinement has failed, output <promise>FAILED</promise>.")

    echo "$result"

    if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
      echo "rawToResearch complete."
      return 0
    fi

    if [[ "$result" == *"<promise>FAILED</promise>"* ]]; then
      echo "rawToResearch failed."
      return 1
    fi
  done
}

# call analyze_task_until_complete wit the task, make me a cool recipe website
analyze_task_until_complete "make me a cool recipe website"