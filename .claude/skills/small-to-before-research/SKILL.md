---
name: small-to-before-research
description: Transform vague or informal prompts into structured, precise prompts optimized for the researchCodebase agent. Use when preparing to launch codebase research and the user's request needs refinement for better results.
---

# Small to Before Research

Transform vague prompts into optimized research prompts for the researchCodebase agent.

## Process

1. **Analyze the vague input** - Identify the core intent, implicit assumptions, and missing specifics
2. **Extract key elements**:
   - What is being searched for (files, patterns, implementations, architecture)
   - Why (understanding, modification, debugging, documentation)
   - Scope constraints (specific directories, file types, modules)
3. **Generate optimized prompt** with these characteristics:
   - Imperative voice ("Find...", "Identify...", "Document...")
   - Specific search targets (function names, patterns, file types)
   - Clear deliverables (list files, explain flow, map dependencies)
   - Scope boundaries when applicable

## Output Format

```
**Research Prompt:**

[Optimized prompt here]

**Search Targets:**
- [Specific files/patterns/keywords to look for]

**Expected Deliverables:**
- [What the research should produce]
```

## Examples

**Vague:** "how does auth work"
**Optimized:**
```
Research Prompt:
Document the authentication flow from login to session management. Identify entry points, middleware, token handling, and session storage mechanisms.

Search Targets:
- auth, login, session, token, middleware, jwt, passport
- Files: *auth*, *session*, *login*

Expected Deliverables:
- Authentication entry points and routes
- Token/session lifecycle
- Key files and their relationships
```

**Vague:** "find where we handle errors"
**Optimized:**
```
Research Prompt:
Locate error handling patterns across the codebase. Document centralized error handlers, try-catch patterns, error middleware, and custom error classes.

Search Targets:
- error, catch, throw, ErrorHandler, middleware
- Files: *error*, *exception*, *handler*

Expected Deliverables:
- Error handling entry points
- Custom error classes/types
- Error propagation patterns
```
