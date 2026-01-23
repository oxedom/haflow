---
title: Defer Non-Critical Third-Party Libraries
impact: MEDIUM
impactDescription: loads lazily after mount
tags: bundle, third-party, analytics, defer
---

## Defer Non-Critical Third-Party Libraries

Analytics, logging, and error tracking don't block user interaction. Load them lazily after mount.

**Incorrect (blocks initial bundle):**

```tsx
import { Analytics } from 'some-analytics-library'

function App({ children }) {
  return (
    <div>
      {children}
      <Analytics />
    </div>
  )
}
```

**Correct (loads lazily after mount):**

```tsx
import { lazy, Suspense, useEffect, useState } from 'react'

const Analytics = lazy(() => import('some-analytics-library').then(m => ({ default: m.Analytics })))

function App({ children }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div>
      {children}
      {mounted && (
        <Suspense fallback={null}>
          <Analytics />
        </Suspense>
      )}
    </div>
  )
}
```
