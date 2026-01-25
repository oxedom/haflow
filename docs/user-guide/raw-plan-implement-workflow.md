# User Guide: Raw - Plan → Implement Workflow

## What is the Raw - Plan → Implement Workflow?

The **Raw - Plan → Implement** workflow is a two-phase process designed for complex tasks where you want an AI to first plan a solution carefully, then implement it based on that plan. This workflow is particularly useful when:

- You're working on a significant architectural change
- The task requires careful upfront design
- You want to review the approach before implementation begins
- You need clear documentation of the implementation strategy

## How It Works

### Phase 1: Planning & Design

In the first phase, the AI will:

1. **Understand Your Request**: Read and comprehend what you want to build or change
2. **Explore the Codebase**: Analyze existing code patterns, architecture, and conventions
3. **Identify Challenges**: Understand what might be difficult or complex
4. **Design the Solution**: Create a detailed plan for how to approach the problem
5. **Document Everything**: Produce a comprehensive planning document

**Output**: A planning document that includes:
- What the task is asking for
- How the existing codebase is structured
- What patterns and approaches work in this codebase
- Specific files that need to be created or modified
- Dependencies and integration points
- Known risks and how to avoid them
- Testing strategy

**Duration**: Phase 1 typically takes several minutes for the AI to thoroughly explore your codebase and create a detailed plan.

### Phase Transition: Review Planning

After Phase 1 completes, you'll see:

1. **Planning Summary**: A brief summary of the approach
2. **Full Planning Document**: The complete analysis and design
3. **Review Opportunity**: Chance to read the plan before proceeding
4. **Confirmation Prompt**: Option to proceed to implementation

You can:
- ✅ Proceed to implementation if the plan looks good
- 📖 Read the full planning document if you want more details
- 🛑 Stop and adjust if something doesn't look right

### Phase 2: Implementation

In the second phase, the AI will:

1. **Review the Plan**: Read and understand the planning document
2. **Implement According to Plan**: Write code exactly as designed
3. **Write Tests**: Create tests as specified in the plan
4. **Document Results**: Record what was implemented

**Output**: Your code is now implemented according to the carefully designed plan from Phase 1.

**Duration**: Phase 2 typically takes several minutes to implement and test the changes.

## Getting Started

### Step 1: Create a New Mission

1. Open Haflow and click "New Mission"
2. Give your task a title (e.g., "Add user authentication to the app")
3. Select the workflow type (feature, fix, enhance, etc.)
4. Describe what you want to do in "Raw Input"

### Step 2: Select the Workflow

Look for the workflow selection dropdown:

```
[Raw Research Plan]  |  [Oneshot]  |  [Raw - Plan → Implement]
```

Select **"Raw - Plan → Implement"** for your complex task.

### Step 3: Provide Clear Input

Write a clear description of what you want:

❌ **Too vague:**
```
Add login functionality
```

✅ **Better:**
```
Add user authentication to the web app using JWT tokens.
Requirements:
- User login with email and password
- JWT token issued on login
- Token stored in secure cookies
- Logout functionality
- Protected routes only accessible when logged in
```

### Step 4: Wait for Phase 1

The AI will:
- Explore your codebase (several minutes)
- Analyze the architecture
- Design an implementation approach
- Create a detailed planning document

You'll see progress as the AI works.

### Step 5: Review the Plan

When Phase 1 completes:

1. **Read the Summary**: Quick overview of the approach
2. **Review the Full Document**: Detailed analysis and design
3. **Check for Issues**: Does the plan make sense?

### Step 6: Proceed to Phase 2

Once you're satisfied with the plan, click "Continue to Implementation"

The AI will:
- Read the planning document
- Implement the changes
- Write tests
- Validate the implementation

### Step 7: Review the Implementation

When Phase 2 completes:

1. **View the Results**: Summary of what was implemented
2. **Review the Code**: See the changes made
3. **Run Tests**: Use quick commands to verify
4. **Approve or Adjust**: Complete or request changes

## Example: Adding a Feature

### Scenario: Add an Admin Dashboard

**Input:**
```
Add an admin dashboard to the application that allows admin users to:
- View statistics about the system
- Manage user accounts
- View system logs
- Configure application settings

Admins should be identified by a role in the database.
The dashboard should only be accessible to admin users.
```

**Phase 1 Planning Output:**
```
## Planning Document: Admin Dashboard Implementation

### Problem Summary
Create a web-based admin dashboard with restricted access,
statistics display, user management, and configuration features.

### Current Architecture
- Frontend: React with TailwindCSS
- Backend: Express.js with PostgreSQL
- Authentication: JWT-based
- Users table has a 'role' column

### Implementation Approach
1. Create AdminDashboard.tsx React component
2. Add admin role check to protected routes
3. Create API endpoints for:
   - GET /api/admin/stats
   - GET /api/admin/users
   - PUT /api/admin/users/:id
   - GET /api/admin/logs
   - POST /api/admin/settings
4. Create database queries for statistics
5. Add role-based access control middleware

### Files to Create/Modify
- New: src/components/AdminDashboard.tsx
- New: src/api/admin.ts
- Modify: src/routes.ts (add admin routes)
- Modify: src/middleware/auth.ts (add adminOnly check)
- New: db/admin-queries.sql

### Risks
- Users could access admin endpoints without role check
Mitigation: Always verify role in middleware

### Testing Strategy
- Unit tests for role verification
- Integration tests for each admin endpoint
- E2E test for full dashboard flow
```

**Phase 2 Implementation:**
- Creates AdminDashboard component
- Adds API endpoints
- Implements role verification
- Writes tests
- All changes follow the plan

**Result:**
- Admin dashboard is implemented and tested
- All changes follow the planned approach
- Code quality is maintained
- Tests pass

## Tips & Best Practices

### 1. Be Clear in Your Input

The better you describe the task, the better the plan:

- ✅ Explain what you want to build
- ✅ List specific requirements
- ✅ Mention constraints or preferences
- ✅ Reference existing code patterns you like

### 2. Review the Planning Document Carefully

The planning document is your guide:

- 📖 Read the "Implementation Approach" section carefully
- ❓ Ask yourself: "Does this make sense?"
- ⚠️ If something seems wrong, you can pause before Phase 2
- 💡 Use the planning document to understand what will happen

### 3. Understand the Scope

Phase 1 helps you understand if the task is:

- 🟢 Simple and straightforward
- 🟡 Moderate complexity
- 🔴 Very complex and risky

If the plan seems too complex, you might want to break it into smaller tasks.

### 4. Use Phase Transition Wisely

At the transition between phases:

- ✅ Proceed if the plan looks good
- 🛑 Stop and refine if something seems off
- 📝 The planning document can guide manual work if needed

### 5. Choose the Right Workflow

When to use "Raw - Plan → Implement":

- ✅ Complex architectural changes
- ✅ When you want to review the approach first
- ✅ When careful design is important
- ✅ Major refactoring efforts

**When to use other workflows:**

- Use "Oneshot" for simple changes that don't need planning
- Use "Raw Research Plan" for understanding requirements without implementation

## Understanding the Planning Document

### What's in the Planning Document?

1. **Problem Statement**: Clear understanding of what to build
2. **Architecture Overview**: How the existing system works
3. **Implementation Approach**: Step-by-step how to build it
4. **File Changes**: Exactly which files to create/modify
5. **Dependencies**: What else needs to be in place
6. **Risks**: What could go wrong and how to prevent it
7. **Testing Strategy**: How to verify it works

### How to Read It

```markdown
# Planning Document: My Feature

## Problem Summary
[Quick overview of what we're building]

## Current Architecture
[How the system currently works]

## Implementation Approach
[Step-by-step plan]

## Files to Create/Modify
[Specific list with what changes in each file]

## Dependencies
[What needs to be true for this to work]

## Risks
[What could go wrong]

## Testing Strategy
[How to test it]
```

## Troubleshooting

### Phase 1 is Taking a Long Time

**What's happening?** The AI is exploring your codebase thoroughly to understand it.

**What to do:** Wait. This is normal for complex codebases. Typically takes 2-5 minutes.

### The Planning Document Seems Incomplete

**What to do:**
1. Review the document carefully
2. If critical information is missing, you can:
   - Pause and provide more input
   - Move forward if you're confident in the approach

### I Don't Like the Planned Approach

**What to do:**
1. Note what concerns you
2. You can:
   - Proceed anyway if it's acceptable
   - Stop and start a new mission with adjusted input
   - Provide specific feedback for the approach

### Phase 2 Implementation Doesn't Match the Plan

**What to do:**
1. Review the implementation against the planning document
2. If there are discrepancies:
   - Note them in your review
   - The implementation phase emphasizes plan adherence
   - You can request corrections

## Comparing Workflows

| Aspect | Raw - Plan → Implement | Oneshot | Raw Research Plan |
|--------|----------------------|---------|-------------------|
| **Phases** | 2 (Plan + Implement) | 1 (Direct Coding) | Full 8-step pipeline |
| **Best For** | Complex tasks needing design | Quick changes | Comprehensive analysis |
| **Planning** | Explicit phase 1 | None | Integrated in pipeline |
| **Review Point** | Between phases | After completion | Multiple gates |
| **Time** | Moderate | Fast | Slower |
| **When to Use** | Architectural changes | Simple fixes | Big features |

## Common Questions

**Q: What if I don't like the plan?**
A: You can stop before Phase 2 and try again with different input, or proceed anyway.

**Q: Can I modify the plan before Phase 2?**
A: Currently, the workflow is fixed. You can stop, adjust your request, and start over.

**Q: How long does each phase take?**
A: Planning typically takes 2-5 minutes. Implementation varies based on complexity (2-10 minutes).

**Q: Can I use this workflow for documentation?**
A: Yes! You can ask it to plan and implement documentation improvements.

**Q: Is the planning output saved?**
A: Yes! The planning document is saved as an artifact in your mission history.

**Q: Can I share the planning document?**
A: Yes! The planning document is part of your mission and can be reviewed at any time.

## Next Steps

1. Create your first mission with this workflow
2. Observe the planning phase in action
3. Review the planning document carefully
4. Proceed to implementation
5. Validate the results

The "Raw - Plan → Implement" workflow is powerful for complex tasks. Start with clear input, review the plan carefully, and you'll get great results!
