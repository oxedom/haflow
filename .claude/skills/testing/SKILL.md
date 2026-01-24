---
name: testing
description: Software testing expertise for writing effective tests. Use when writing tests, reviewing test quality, designing test suites, debugging test failures, or implementing TDD. Covers xUnit patterns, test case selection, mocks/fixtures, parametrization, testing stateful systems, BDD, golden/snapshot testing, and LLM output evaluation.
---

# Testing Skill

**Core principle: Testing is risk management.** Tests catch mistakes before production. Code never works the first time, and working code won't stay working without tests.

## Test Case Selection (The Map Analogy)

Think of your code's behavior as a map. Select test cases systematically:

1. **Start simple** - Basic happy path cases first
2. **Cover every subdivision** - Each distinct behavior region needs coverage
3. **Find surprising subdivisions** - Edge cases that aren't obvious (embassies on a map)
4. **Hug borders tightly** - Test boundary conditions precisely
5. **Look for multipoints** - Where multiple boundaries meet (0, 1, -1 for ranges)

### Example: Testing `range(start, stop, step)`

```typescript
// Start simple
expect(range(3)).toEqual([0, 1, 2]);

// Cover subdivisions
expect(range(5, 0, -1)).toEqual([5, 4, 3, 2, 1]); // negative step
expect(range(3, 1)).toEqual([]);                    // empty range

// Hug borders
expect(range(1, 5, 2)).toEqual([1, 3]); // stop not included
expect(range(1, 4, 2)).toEqual([1, 3]); // just under boundary
expect(range(1, 3, 2)).toEqual([1]);     // at boundary

// Multipoints (where 0, 1, -1 intersect)
expect(range(0, 1, 1)).toEqual([0]);
expect(() => range(0, 1, 0)).toThrow();
```

## Test Structure: Given-When-Then

```typescript
test('finalize order empties shopping cart', () => {
  // Given: a user's shopping cart with one pizza
  const user = createAccount({ name: 'Adam' });
  addToShoppingCart(user, pizza, { quantity: 1 });

  // When: I finalize the order
  finalizeOrder(user, { creditCard: 'XXXX-...' });

  // Then: The shopping cart is now empty
  expect(getShoppingCart(user)).toBeUndefined();
});
```

## DRY vs DAMP

- **DAMP (Descriptive And Meaningful Phrase)**: Each test readable in isolation, some repetition OK
- **DRY**: Share setup code to reduce duplication

**Guideline**: With 100 similar tests, build a test harness. With 5 tests, copy-paste is fine.

## Quick Reference

| Need | Solution | See |
|------|----------|-----|
| Shared setup | Fixtures | [testing-toolbox.md](references/testing-toolbox.md) |
| Many similar cases | Parametrize | [testing-toolbox.md](references/testing-toolbox.md) |
| External dependencies | Mocks/VCR | [testing-toolbox.md](references/testing-toolbox.md) |
| Stateful systems | Functional core pattern | [testing-stateful.md](references/testing-stateful.md) |
| Design-first workflow | TDD | [advanced-patterns.md](references/advanced-patterns.md) |
| Executable specs | BDD | [advanced-patterns.md](references/advanced-patterns.md) |
| Complex outputs | Golden/Snapshot | [advanced-patterns.md](references/advanced-patterns.md) |
| Non-deterministic LLMs | Evals + metrics | [llm-evals.md](references/llm-evals.md) |

## Anti-patterns

- Tests that depend on execution order
- Tests that share mutable state
- Over-mocking (mock the DB? Usually no. Mock Stripe API? Yes.)
- Testing implementation details instead of behavior
- 100% coverage as a goal (coverage shows what you DIDN'T test, not quality)

## Things Hard to Test

- **UI**: Automated visual tests rarely worth the effort
- **Nondeterministic code**: Question why you're writing it
- **Distributed systems**: Read Jepsen posts, good luck
