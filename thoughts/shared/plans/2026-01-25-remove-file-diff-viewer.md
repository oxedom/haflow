# PRD: Remove File Diff Viewer from Code Review Step

## Overview

Remove the click-to-view-diff functionality from the CodeReviewStep component. Users will still see the list of changed files with their status indicators, but clicking on files will no longer expand to show the diff.

## Motivation

Simplify the code review UI by removing the per-file diff viewer. The git status list provides sufficient information about what changed.

## Scope

**In Scope:**
- Remove file click behavior from CodeReviewStep
- Remove diff viewer card/section
- Remove related state and effects

**Out of Scope:**
- Backend changes (no changes to API endpoints)
- Removing API client functions (keep `getFileDiff` in client.ts for potential future use)

## Current Behavior

1. Git Status section displays list of changed files
2. Each file is a clickable button
3. Clicking a file fetches its diff via `api.getFileDiff()`
4. A "Diff Viewer" card expands below showing the unified diff
5. Clicking the same file again collapses the diff

## Desired Behavior

1. Git Status section displays list of changed files (unchanged)
2. Files are displayed as static list items, not clickable
3. No diff viewer section exists

## Implementation

### File: `packages/frontend/src/components/CodeReviewStep.tsx`

#### 1. Remove State
Remove these state variables:
```typescript
const [selectedFile, setSelectedFile] = useState<string | null>(null);
const [fileDiff, setFileDiff] = useState<string>('');
```

#### 2. Remove useEffect for Fetching Diff
Remove this entire effect:
```typescript
useEffect(() => {
  if (!selectedFile) {
    setFileDiff('');
    return;
  }

  api.getFileDiff(mission.mission_id, selectedFile)
    .then(res => setFileDiff(res.diff))
    .catch(err => {
      console.error('Failed to fetch diff:', err);
      setFileDiff('Error loading diff');
    });
}, [mission.mission_id, selectedFile]);
```

#### 3. Change File List Rendering
Change from clickable buttons to static div elements:

**Before:**
```tsx
{gitFiles.map(file => (
  <button
    key={file.path}
    className={`w-full text-left px-2 py-1 text-sm font-mono rounded hover:bg-muted flex items-center gap-2 ${
      selectedFile === file.path ? 'bg-muted' : ''
    }`}
    onClick={() => setSelectedFile(selectedFile === file.path ? null : file.path)}
  >
    <span className={statusColors[file.status] || 'text-foreground'}>
      {file.status}
    </span>
    <span className="truncate">{file.path}</span>
  </button>
))}
```

**After:**
```tsx
{gitFiles.map(file => (
  <div
    key={file.path}
    className="px-2 py-1 text-sm font-mono flex items-center gap-2"
  >
    <span className={statusColors[file.status] || 'text-foreground'}>
      {file.status}
    </span>
    <span className="truncate">{file.path}</span>
  </div>
))}
```

#### 4. Remove Diff Viewer Section
Remove this entire JSX block:
```tsx
{/* Diff Viewer */}
{selectedFile && (
  <Card>
    <CardHeader className="py-3">
      <CardTitle className="text-sm font-medium font-mono">
        {selectedFile}
      </CardTitle>
    </CardHeader>
    <CardContent className="pt-0">
      <pre className="text-xs font-mono overflow-auto max-h-96 p-2 bg-muted rounded whitespace-pre-wrap">
        {fileDiff || 'Loading...'}
      </pre>
    </CardContent>
  </Card>
)}
```

## Success Criteria

### Automated Verification
- [x] Frontend builds: `pnpm --filter frontend build`
- [x] Frontend lint passes (no new errors)

### Manual Verification
- [ ] Git status list displays with file status indicators
- [ ] Files are not clickable (no hover state, no cursor pointer)
- [ ] No diff viewer section appears
- [ ] "Approve & Continue" still works
