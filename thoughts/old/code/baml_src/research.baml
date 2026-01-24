// Research analysis types and functions for waterfall processing

// Represents a key insight extracted from a document
class Insight {
  category "decision" | "trade_off" | "constraint" | "lesson_learned" | "action_item" | "technical_spec"
  content string
  confidence float @description("Confidence level 0.0-1.0")
  source_quote string? @description("Original text that supports this insight")
}

// Represents a research subtask to be executed
class ResearchSubtask {
  id string @description("Unique identifier like 'task-1'")
  description string
  target_areas string[] @description("Directories or components to investigate")
  agent_type "codebase-locator" | "codebase-analyzer" | "codebase-pattern-finder" | "thoughts-locator" | "thoughts-analyzer"
  dependencies string[] @description("IDs of tasks this depends on")
}

// Represents a code reference found during research
class CodeReference {
  file_path string
  line_number int?
  description string
}

// The research plan output structure
class ResearchPlan {
  research_question string @description("The original question being researched")
  summary string @description("High-level summary of what will be investigated")
  decomposition string[] @description("How the question was broken down")
  subtasks ResearchSubtask[]
  estimated_components string[] @description("Components/areas likely to be relevant")
  open_questions string[] @description("Uncertainties that need clarification")
}

// Analysis result from a thoughts document
class ThoughtsAnalysis {
  document_goal string @description("What the document was trying to answer")
  date_context string? @description("When this was written, if identifiable")
  key_insights Insight[]
  still_relevant bool @description("Whether the information appears current")
  relevance_notes string? @description("Why this may or may not be relevant now")
  related_files string[] @description("Other files mentioned or related")
}

// Final research document structure
class ResearchDocument {
  title string
  date string
  researcher string
  git_commit string?
  branch string?
  repository string
  topic string
  tags string[]

  research_question string
  summary string
  detailed_findings string @description("Markdown formatted detailed findings")
  code_references CodeReference[]
  architecture_insights string[]
  historical_context string @description("Insights from thoughts/ directory")
  open_questions string[]
}

// Step 1: Analyze a thoughts document and extract insights
function AnalyzeThoughtsDocument(document: string, research_context: string?) -> ThoughtsAnalysis {
  client CustomSonnet4
  prompt #"
    You are a specialist at extracting HIGH-VALUE insights from research documents.

    ## Your Task
    Analyze the following document and extract only the most relevant, actionable information.

    {% if research_context %}
    ## Research Context
    The user is researching: {{ research_context }}
    Focus on insights relevant to this context.
    {% endif %}

    ## Document to Analyze
    {{ document }}

    ## Extraction Guidelines

    Focus on finding:
    - **Decisions made**: "We decided to...", "We chose..."
    - **Trade-offs analyzed**: "X vs Y because..."
    - **Constraints identified**: "We must...", "We cannot..."
    - **Lessons learned**: "We discovered that...", "It turned out..."
    - **Action items**: "Next steps...", "TODO..."
    - **Technical specifications**: Specific values, configs, approaches

    Filter out:
    - Exploratory rambling without conclusions
    - Options that were rejected (unless the rejection reasoning is valuable)
    - Temporary workarounds that were replaced
    - Information that appears outdated

    {{ ctx.output_format }}
  "#
}

// Step 2: Create a research plan from a user question
function CreateResearchPlan(question: string, codebase_context: string?) -> ResearchPlan {
  client CustomSonnet4
  prompt #"
    You are a research planning specialist. Your job is to decompose a research question
    into actionable subtasks that can be executed by specialized agents.

    ## User's Research Question
    {{ question }}

    {% if codebase_context %}
    ## Known Codebase Context
    {{ codebase_context }}
    {% endif %}

    ## Available Agent Types
    - **codebase-locator**: Finds files, directories, and components by name/pattern
    - **codebase-analyzer**: Deep dives into specific components for implementation details
    - **codebase-pattern-finder**: Finds similar implementations and usage patterns
    - **thoughts-locator**: Discovers relevant documents in thoughts/ directory
    - **thoughts-analyzer**: Extracts insights from thoughts documents

    ## Planning Guidelines

    1. Break the question into composable research areas
    2. Identify which agent type is best for each subtask
    3. Consider dependencies - locators should run before analyzers
    4. Parallelize independent tasks where possible
    5. Include both codebase and historical (thoughts/) research

    {{ ctx.output_format }}
  "#
}

// Step 3: Synthesize findings into a research document
function SynthesizeResearchDocument(
  plan: ResearchPlan,
  thoughts_analyses: ThoughtsAnalysis[],
  codebase_findings: string,
  metadata: string
) -> ResearchDocument {
  client CustomOpus4
  prompt #"
    You are a research synthesis specialist. Compile all findings into a comprehensive
    research document.

    ## Original Research Plan
    Question: {{ plan.research_question }}
    Summary: {{ plan.summary }}

    ## Thoughts Analysis Results
    {% for analysis in thoughts_analyses %}
    ### Document Analysis {{ loop.index }}
    Goal: {{ analysis.document_goal }}
    Still Relevant: {{ analysis.still_relevant }}
    {% if analysis.relevance_notes %}Notes: {{ analysis.relevance_notes }}{% endif %}

    Key Insights:
    {% for insight in analysis.key_insights %}
    - [{{ insight.category }}] {{ insight.content }} (confidence: {{ insight.confidence }})
    {% endfor %}
    {% endfor %}

    ## Codebase Findings
    {{ codebase_findings }}

    ## Metadata
    {{ metadata }}

    ## Synthesis Guidelines

    1. Prioritize live codebase findings as primary source of truth
    2. Use thoughts/ findings as supplementary historical context
    3. Connect findings across different components
    4. Include specific file paths and line numbers
    5. Highlight patterns, connections, and architectural decisions
    6. Note any contradictions between historical and current state

    {{ ctx.output_format }}
  "#
}

// Test for AnalyzeThoughtsDocument
test analyze_thoughts_test {
  functions [AnalyzeThoughtsDocument]
  args {
    document #"
      # Decision Log: Authentication System
      Date: 2024-12-15

      ## Background
      We needed to choose between JWT and session-based auth.

      ## Decision
      We decided to use JWT with refresh tokens because:
      - Stateless nature fits our microservices architecture
      - Easier horizontal scaling
      - Mobile app compatibility

      ## Trade-offs
      - JWT vs Sessions: Sessions are simpler but require shared state
      - We chose longer token expiry (1h) to reduce refresh frequency

      ## Constraints
      - Must support SSO integration later
      - Cannot store sensitive data in tokens

      ## Next Steps
      - TODO: Implement token refresh endpoint
      - TODO: Add rate limiting to auth endpoints
    "#
    research_context "authentication implementation"
  }
}

// Test for CreateResearchPlan
test create_plan_test {
  functions [CreateResearchPlan]
  args {
    question "How does the mission execution system work and what are its failure modes?"
    codebase_context "This is a pnpm monorepo with packages: shared, backend, cli. Backend uses Express and SQLite."
  }
}
