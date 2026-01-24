# Advanced Testing Patterns

## Table of Contents

1. [Test-Driven Development (TDD)](#tdd)
2. [Behavior-Driven Development (BDD)](#bdd)
3. [Golden/Snapshot Testing](#golden-testing)
4. [Coverage Metrics](#coverage)

---

## TDD

Test-Driven Development: Write tests before implementation.

### The Cycle

1. **Red** - Write a failing test
2. **Green** - Write minimal code to pass
3. **Refactor** - Clean up while tests stay green
4. **Repeat**

### Example: FizzBuzz with TDD

```typescript
// Step 1: RED - Write failing test
test('returns "1" for 1', () => {
  expect(fizzbuzz(1)).toBe('1');
});

// Step 2: GREEN - Minimal implementation
function fizzbuzz(n: number): string {
  return '1';
}

// Step 3: RED - New failing test
test('returns "2" for 2', () => {
  expect(fizzbuzz(2)).toBe('2');
});

// Step 4: GREEN - Generalize
function fizzbuzz(n: number): string {
  return String(n);
}

// Step 5: RED - Fizz case
test('returns "Fizz" for 3', () => {
  expect(fizzbuzz(3)).toBe('Fizz');
});

// Continue cycle...
```

### TDD Benefits

- Forces testable design upfront
- Documents intended behavior
- Prevents over-engineering (only write what tests require)
- Builds confidence in refactoring

### Pseudo-TDD

Write test cases as pseudocode before implementation, then implement:

```typescript
// Design phase - sketch test cases
// test: empty array returns empty
// test: single element returns same
// test: already sorted returns same
// test: reverse sorted gets sorted
// test: duplicates preserved
// test: negative numbers handled

// Then implement tests and code
```

---

## BDD

Behavior-Driven Development: Tests as executable specifications.

### Gherkin Syntax (Cucumber)

```gherkin
Feature: Shopping Cart

  Scenario: Add item to cart
    Given a user with an empty cart
    When the user adds a pizza to the cart
    Then the cart should contain 1 item
    And the cart total should be $9.99

  Scenario: Apply discount code
    Given a user with a pizza in their cart
    When the user applies code "SAVE10"
    Then the cart total should be $8.99
```

### BDD in Vitest/Jest

```typescript
describe('Feature: Shopping Cart', () => {
  describe('Scenario: Add item to cart', () => {
    let user: User;
    let cart: Cart;

    test('Given a user with an empty cart', () => {
      user = createUser();
      cart = getCart(user);
      expect(cart.items).toHaveLength(0);
    });

    test('When the user adds a pizza to the cart', () => {
      addToCart(user, { name: 'Pizza', price: 9.99 });
    });

    test('Then the cart should contain 1 item', () => {
      cart = getCart(user);
      expect(cart.items).toHaveLength(1);
    });

    test('And the cart total should be $9.99', () => {
      expect(cart.total).toBe(9.99);
    });
  });
});
```

### When BDD Helps

- Complex business rules that stakeholders need to verify
- Acceptance criteria that map directly to tests
- When product managers want to read/write test cases

---

## Golden Testing

Also called **snapshot testing**. Compare output against saved "golden" files.

### Basic Snapshot

```typescript
test('renders user profile', () => {
  const html = renderProfile({ name: 'Alice', role: 'admin' });
  expect(html).toMatchSnapshot();
});
```

First run creates `.snap` file. Subsequent runs compare against it.

### Inline Snapshots

```typescript
test('formats currency', () => {
  expect(formatCurrency(1234.56)).toMatchInlineSnapshot(`"$1,234.56"`);
  expect(formatCurrency(0)).toMatchInlineSnapshot(`"$0.00"`);
  expect(formatCurrency(-99.9)).toMatchInlineSnapshot(`"-$99.90"`);
});
```

### When to Use Golden Tests

**Good for:**
- Complex output (HTML, JSON, formatted text)
- Detecting unintended changes
- Bootstrapping tests for legacy code
- Testing serialization/formatting

**Pitfalls:**
- Tests become "change detectors" - any change fails
- Easy to blindly update snapshots without review
- Non-deterministic data (timestamps, IDs) causes flaky tests

### Normalizing Non-Deterministic Data

```typescript
function normalizeForSnapshot(data: any) {
  return JSON.parse(
    JSON.stringify(data, (key, value) => {
      if (key === 'id') return '[ID]';
      if (key === 'createdAt') return '[TIMESTAMP]';
      if (key === 'updatedAt') return '[TIMESTAMP]';
      return value;
    })
  );
}

test('creates order', async () => {
  const order = await createOrder({ items: [{ sku: 'PIZZA', qty: 1 }] });
  expect(normalizeForSnapshot(order)).toMatchSnapshot();
});
```

---

## Coverage

### Running Coverage

```bash
vitest run --coverage
```

### Interpreting Coverage

```
File          | % Stmts | % Branch | % Funcs | % Lines
--------------|---------|----------|---------|--------
cart.ts       |   92.5  |    85.0  |  100.0  |   92.5
payment.ts    |   78.3  |    60.0  |   80.0  |   78.3
```

- **Statements**: Lines of code executed
- **Branches**: if/else paths taken
- **Functions**: Functions called
- **Lines**: Source lines executed

### Coverage Wisdom

**100% coverage ≠ bug-free code**

```typescript
function divide(a: number, b: number): number {
  return a / b;
}

test('divides numbers', () => {
  expect(divide(10, 2)).toBe(5);  // 100% coverage!
});

// But divide(1, 0) = Infinity - not tested!
```

**Coverage shows what you DIDN'T test**, not what you tested well.

### Useful Coverage Goals

- Use as a floor, not a ceiling (e.g., "no PR drops below 80%")
- Focus on branch coverage for complex logic
- Ignore coverage for boilerplate (config, types)
- High coverage on critical paths (auth, payments, data integrity)
