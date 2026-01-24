# Testing Stateful Systems

## The Problem

Stateful tests accumulate complexity:

```typescript
// BAD: Stateful test - hard to understand, debug, extend
test('shopping cart workflow', () => {
  const user = createAccount({ name: 'Adam' });
  const pizza = createItem({ name: 'Pizza', price: 9.99 });

  addToCart(user, pizza, { quantity: 2 });
  expect(getCart(user)[0].quantity).toBe(2);

  removeFromCart(user, pizza, { quantity: 1 });
  expect(getCart(user)[0].quantity).toBe(1);

  finalizeOrder(user, { creditCard: 'XXXX' });
  expect(getCart(user)).toHaveLength(0);
});
```

Problems:
- State accumulates across assertions
- Failure at step N pollutes steps N+1, N+2...
- Adding new cases risks breaking existing flow
- Hard to identify which specific behavior failed

## Solution 1: Isolate Each Test Case

```typescript
// GOOD: Each test is independent
describe('ShoppingCart', () => {
  let user: User;
  let pizza: Item;

  beforeEach(() => {
    user = createAccount({ name: 'Adam' });
    pizza = createItem({ name: 'Pizza', price: 9.99 });
  });

  test('add item sets correct quantity', () => {
    addToCart(user, pizza, { quantity: 2 });
    expect(getCart(user)[0].quantity).toBe(2);
  });

  test('remove item decrements quantity', () => {
    addToCart(user, pizza, { quantity: 2 });
    removeFromCart(user, pizza, { quantity: 1 });
    expect(getCart(user)[0].quantity).toBe(1);
  });

  test('finalize order clears cart', () => {
    addToCart(user, pizza, { quantity: 1 });
    finalizeOrder(user, { creditCard: 'XXXX' });
    expect(getCart(user)).toHaveLength(0);
  });
});
```

## Solution 2: Functional Core, Imperative Shell

Separate pure business logic from stateful I/O:

```
┌─────────────────────────────────────────┐
│         Imperative Shell                │
│  (I/O, database, network, side effects) │
│                                         │
│    ┌───────────────────────────┐        │
│    │     Functional Core       │        │
│    │  (pure business logic)    │        │
│    │  - easy to test           │        │
│    │  - no mocks needed        │        │
│    └───────────────────────────┘        │
│                                         │
└─────────────────────────────────────────┘
```

### Example: Cart Price Calculator

```typescript
// Functional core - pure, easy to test
interface CartItem {
  price: number;
  quantity: number;
  discount?: number;
}

function calculateCartTotal(items: CartItem[]): number {
  return items.reduce((total, item) => {
    const itemTotal = item.price * item.quantity;
    const discount = item.discount ?? 0;
    return total + itemTotal * (1 - discount);
  }, 0);
}

// Tests are trivial - no setup, no mocks
test.each([
  { items: [], expected: 0 },
  { items: [{ price: 10, quantity: 1 }], expected: 10 },
  { items: [{ price: 10, quantity: 2 }], expected: 20 },
  { items: [{ price: 10, quantity: 1, discount: 0.1 }], expected: 9 },
  {
    items: [
      { price: 10, quantity: 2 },
      { price: 5, quantity: 3, discount: 0.2 }
    ],
    expected: 32  // 20 + 12
  },
])('calculateCartTotal($items) = $expected', ({ items, expected }) => {
  expect(calculateCartTotal(items)).toBe(expected);
});
```

```typescript
// Imperative shell - handles I/O, calls functional core
async function getCartTotal(userId: string): Promise<number> {
  const cart = await db.carts.findByUserId(userId);  // I/O
  const items = cart.items.map(item => ({
    price: item.product.price,
    quantity: item.quantity,
    discount: item.appliedDiscount,
  }));
  return calculateCartTotal(items);  // Pure function
}
```

## Solution 3: Builder Pattern for Complex Setup

```typescript
class CartTestBuilder {
  private user: User;
  private items: Array<{ item: Item; quantity: number }> = [];

  constructor() {
    this.user = createAccount({ name: 'TestUser' });
  }

  withItem(name: string, price: number, quantity: number = 1) {
    const item = createItem({ name, price });
    this.items.push({ item, quantity });
    return this;
  }

  build() {
    for (const { item, quantity } of this.items) {
      addToCart(this.user, item, { quantity });
    }
    return { user: this.user, cart: getCart(this.user) };
  }
}

// Usage
test('cart with multiple items', () => {
  const { user, cart } = new CartTestBuilder()
    .withItem('Pizza', 9.99, 2)
    .withItem('Soda', 2.99, 3)
    .build();

  expect(cart).toHaveLength(2);
  expect(calculateTotal(cart)).toBeCloseTo(28.95);
});
```

## Anti-pattern: Tests That Depend on Order

```typescript
// BAD: Tests depend on execution order
let sharedUser: User;

test('create user', () => {
  sharedUser = createAccount({ name: 'Adam' });
  expect(sharedUser.id).toBeDefined();
});

test('user can add to cart', () => {
  // FAILS if previous test didn't run first!
  addToCart(sharedUser, pizza, { quantity: 1 });
  expect(getCart(sharedUser)).toHaveLength(1);
});
```

Each test must be runnable in isolation and in any order.
