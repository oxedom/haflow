# E2E Mission Lifecycle Tests Overview

This document provides an overview of the end-to-end tests that were designed to validate the complete mission lifecycle in the Haflow frontend.

> **Note**: These tests were designed but not fully implemented. They require Docker for mock agent execution and are skipped in CI.

## Test Categories

### 1. Mission Creation

Tests that validate creating new missions through the UI:

- **Create mission with all required fields** - Verifies that a user can open the new mission modal, fill in title and description, submit, and see the mission appear in the sidebar
- **Validation via disabled submit** - Ensures the submit button is disabled when required fields are empty, and becomes enabled once all fields are filled
- **Auto-select newly created mission** - Confirms that after creating a mission, it is automatically selected and its details are displayed (including the "Ready" status badge)

### 2. Mission Selection

Tests for selecting and viewing mission details:

- **Display mission detail on sidebar click** - Validates that clicking a mission in the sidebar shows its detail view with header and title
- **Workflow timeline with current step** - Ensures the workflow timeline is visible and displays steps when a mission is selected

### 3. Workflow Progression

Tests covering the agent execution and state transitions:

- **Start agent and show running status** - Verifies clicking "Start Agent" transitions the mission to "Running" status and displays the log viewer
- **Agent completion and human gate transition** - Tests that after an agent completes, the mission transitions to "Waiting" status with the artifact editor and continue button visible
- **Human gate with artifact editor** - Validates the human gate UI shows editor mode controls (editor/diff/preview), save draft, and continue buttons
- **Advance through human gate** - Confirms clicking "Continue" advances the workflow to the next agent step, transitioning back to "Running" status

### 4. Artifact Editing

Tests for the artifact editor during human review gates:

- **Enable save draft on modification** - Verifies the save button is initially disabled and becomes enabled when content is modified
- **Persist changes after save** - Ensures saved draft content persists after a page reload
- **View mode switching** - Tests switching between editor, diff, and preview modes, verifying the appropriate view is shown for each mode

### 5. Multi-Mission Management

Tests for handling multiple missions simultaneously:

- **Display multiple missions in sidebar** - Validates that creating multiple missions results in all of them appearing in the sidebar list
- **Switch between missions** - Confirms clicking different missions in the sidebar correctly updates the detail view to show the selected mission

### 6. Activity History

Tests for the activity/history panel:

- **Toggle activity history panel** - Verifies the activity history toggle reveals step execution entries after an agent has run

## Test Data-TestId Dependencies

The tests rely on the following `data-testid` attributes being present in the UI components:

| Component | TestId |
|-----------|--------|
| New mission button | `new-mission-button` |
| New mission modal | `new-mission-modal` |
| Mission title input | `mission-title-input` |
| Mission raw input | `mission-raw-input` |
| Create mission button | `create-mission-button` |
| Mission list | `mission-list` |
| Mission detail header | `mission-detail-header` |
| Mission title display | `mission-title` |
| Mission status badge | `mission-status-badge` |
| Start agent button | `start-agent-button` |
| Agent log viewer | `agent-log-viewer` |
| Workflow timeline | `workflow-timeline` |
| Workflow step (indexed) | `workflow-step-0`, `workflow-step-1`, etc. |
| Artifact editor | `artifact-editor` |
| View mode buttons | `view-mode-editor`, `view-mode-diff`, `view-mode-preview` |
| Save draft button | `save-draft-button` |
| Continue button | `continue-button` |
| Activity history toggle | `activity-history-toggle` |

## Key Timeouts

- Agent completion wait: 15 seconds
- Status transitions: 5 seconds
- Standard assertions: default Playwright timeout
