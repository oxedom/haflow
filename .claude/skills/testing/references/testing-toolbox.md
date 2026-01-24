# Testing Toolbox

## Table of Contents

1. [Fixtures (beforeEach/afterEach)](#fixtures)
2. [Parametrization (test.each)](#parametrization)
3. [Mocks (vi.fn, vi.spyOn)](#mocks)
4. [VCR Pattern (HTTP recording)](#vcr-pattern)

---

## Fixtures

Use `beforeEach`/`afterEach` for shared setup and teardown:

```typescript
describe('ShoppingCart', () => {
  let user: User;
  let pizza: Item;

  beforeEach(() => {
    user = createAccount({ name: 'Adam' });
    pizza = createItem({ name: 'Pizza', price: 9.99 });
  });

  afterEach(() => {
    closeAccount(user);
  });

  test('add item to cart', () => {
    addToCart(user, pizza, { quantity: 1 });
    expect(getCart(user)).toHaveLength(1);
  });

  test('remove item from cart', () => {
    addToCart(user, pizza, { quantity: 2 });
    removeFromCart(user, pizza, { quantity: 1 });
    expect(getCart(user)[0].quantity).toBe(1);
  });
});
```

### Fixture Scopes

```typescript
// Once per file
beforeAll(() => { /* expensive setup */ });
afterAll(() => { /* cleanup */ });

// Once per test
beforeEach(() => { /* per-test setup */ });
afterEach(() => { /* per-test cleanup */ });
```

---

## Parametrization

Use `test.each` for testing many similar cases:

```typescript
test.each([
  [1, 'one shekel'],
  [2, 'two shekels'],
  [10, 'ten shekels'],
  [1.23, 'one shekel and twenty-three agorot'],
  [null, ''],
  ['invalid', 'invalid amount'],
])('converts %s to "%s"', (amount, expected) => {
  expect(amountToHebrew(amount)).toBe(expected);
});
```

### With Named Parameters

```typescript
test.each([
  { input: 1, expected: 'one' },
  { input: 2, expected: 'two' },
  { input: 10, expected: 'ten' },
])('converts $input to "$expected"', ({ input, expected }) => {
  expect(numberToWord(input)).toBe(expected);
});
```

### Table Syntax

```typescript
test.each`
  a    | b    | expected
  ${1} | ${1} | ${2}
  ${1} | ${2} | ${3}
  ${2} | ${1} | ${3}
`('add($a, $b) returns $expected', ({ a, b, expected }) => {
  expect(add(a, b)).toBe(expected);
});
```

---

## Mocks

### vi.fn() - Create Mock Functions

```typescript
const mockCallback = vi.fn();
mockCallback.mockReturnValue(42);

doSomething(mockCallback);

expect(mockCallback).toHaveBeenCalledTimes(1);
expect(mockCallback).toHaveBeenCalledWith('expected-arg');
```

### vi.spyOn() - Spy on Existing Methods

```typescript
const spy = vi.spyOn(paymentService, 'charge');
spy.mockResolvedValue({ id: '123', status: 'success' });

await processOrder(order);

expect(spy).toHaveBeenCalledWith({
  amount: 9.99,
  currency: 'USD',
});

spy.mockRestore(); // restore original implementation
```

### vi.mock() - Mock Entire Modules

```typescript
vi.mock('./payment-service', () => ({
  charge: vi.fn().mockResolvedValue({ id: '123' }),
  refund: vi.fn().mockResolvedValue({ success: true }),
}));

// In test
import { charge } from './payment-service';
expect(charge).toHaveBeenCalled();
```

### Mock Timers

```typescript
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

test('expires after 24 hours', async () => {
  const token = createToken();

  vi.advanceTimersByTime(24 * 60 * 60 * 1000);

  expect(isTokenValid(token)).toBe(false);
});
```

---

## VCR Pattern

Record HTTP interactions once, replay in tests. Use `nock` or `msw`:

### Using MSW (Mock Service Worker)

```typescript
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const server = setupServer(
  http.post('https://api.stripe.com/v1/charges', () => {
    return HttpResponse.json({ id: 'ch_123', status: 'succeeded' });
  }),
  http.get('https://api.example.com/users/:id', ({ params }) => {
    return HttpResponse.json({ id: params.id, name: 'Test User' });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('processes payment', async () => {
  const result = await processPayment({ amount: 100 });
  expect(result.status).toBe('succeeded');
});
```

### Dynamic Responses

```typescript
server.use(
  http.post('https://api.stripe.com/v1/charges', () => {
    // First call fails
    return HttpResponse.json({ error: 'declined' }, { status: 402 });
  })
);

// Override for specific test
test('handles retry on failure', async () => {
  let calls = 0;
  server.use(
    http.post('https://api.stripe.com/v1/charges', () => {
      calls++;
      if (calls === 1) {
        return HttpResponse.json({ error: 'declined' }, { status: 402 });
      }
      return HttpResponse.json({ id: 'ch_123' });
    })
  );

  const result = await processPaymentWithRetry({ amount: 100 });
  expect(result.id).toBe('ch_123');
});
```

### What to Mock vs What to Keep Real

| Mock | Keep Real |
|------|-----------|
| External APIs (Stripe, Twilio) | Database (use SQLite/in-memory) |
| Email services | File system (use temp dirs) |
| SMS gateways | Your own service logic |
| Third-party webhooks | ORM queries |
| System time (when relevant) | Internal utility functions |
