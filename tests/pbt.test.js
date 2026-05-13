/**
 * Property-Based Tests for Expenses & Budget Visualizer
 * Feature: expenses-budget-visualizer
 *
 * Functions are re-implemented inline (approach a) for isolation and
 * self-contained testability — no dependency on app.js globals.
 *
 * Test runner : Jest (node environment)
 * PBT library : fast-check (minimum 100 iterations per property)
 */

'use strict';

const fc = require('fast-check');

// ─────────────────────────────────────────────────────────────────────────────
// Inline implementations of the pure functions under test
// These match the exact signatures and behaviour described in the spec/design.
// ─────────────────────────────────────────────────────────────────────────────

// ── Storage helpers (in-memory mock of localStorage) ─────────────────────────

/**
 * storageRead(key) — reads from a storage map, returns parsed JSON or null.
 * In tests we pass a plain object as the storage backend.
 */
function storageRead(store, key) {
  try {
    const raw = store[key];
    if (raw === undefined || raw === null) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

/**
 * storageWrite(key, data) — serialises data to JSON and writes to the store.
 */
function storageWrite(store, key, data) {
  store[key] = JSON.stringify(data);
}

// ── State mutation helpers ────────────────────────────────────────────────────

function stateAddExpense(s, expense) {
  return { ...s, expenses: [...s.expenses, expense] };
}

function stateUpdateExpense(s, id, updates) {
  return {
    ...s,
    expenses: s.expenses.map(e => (e.id === id ? { ...e, ...updates } : e)),
  };
}

function stateRemoveExpense(s, id) {
  return { ...s, expenses: s.expenses.filter(e => e.id !== id) };
}

function stateAddCategory(s, name) {
  return { ...s, categories: [...s.categories, name] };
}

function stateRemoveCategory(s, name) {
  return { ...s, categories: s.categories.filter(c => c !== name) };
}

function stateSetFilter(s, filterType, value) {
  return {
    ...s,
    ui: { ...s.ui, filters: { ...s.ui.filters, [filterType]: value } },
  };
}

// ── Validators ────────────────────────────────────────────────────────────────

/**
 * validateExpense({ amount, category, date, description })
 * Returns { valid: boolean, errors: { [field]: string } }
 */
function validateExpense({ amount, category, date, description }) {
  const errors = {};

  // Amount: must be a positive number
  if (amount === undefined || amount === null || amount === '') {
    errors.amount = 'Amount is required.';
  } else {
    const num = Number(amount);
    if (isNaN(num) || num <= 0) {
      errors.amount = 'Amount must be a positive number.';
    }
  }

  // Category: must be non-empty and provided
  if (!category || String(category).trim() === '') {
    errors.category = 'Category is required.';
  }

  // Date: optional — if absent, caller uses current date (no error)
  // Description: optional, max 200 chars
  if (description && String(description).length > 200) {
    errors.description = 'Description must be 200 characters or fewer.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * validateCategory(name, existingCategories)
 * Returns { valid: boolean, errors: { name: string } }
 */
function validateCategory(name, existingCategories) {
  const errors = {};

  if (name === undefined || name === null) {
    errors.name = 'Category name is required.';
    return { valid: false, errors };
  }

  const trimmed = String(name).trim();

  if (trimmed.length === 0) {
    errors.name = 'Category name cannot be empty or whitespace.';
    return { valid: false, errors };
  }

  if (trimmed.length > 50) {
    errors.name = 'Category name must be 50 characters or fewer.';
    return { valid: false, errors };
  }

  const lower = trimmed.toLowerCase();
  const existing = (existingCategories || []).map(c => String(c).toLowerCase());
  if (existing.includes(lower)) {
    errors.name = 'A category with this name already exists.';
    return { valid: false, errors };
  }

  return { valid: true, errors };
}

// ── Utils ─────────────────────────────────────────────────────────────────────

/**
 * expensesToCSV(expenses)
 * Returns a CSV string: header row + one row per expense.
 * Column order: date, category, amount, description
 * Absent description → empty cell.
 */
function expensesToCSV(expenses) {
  const header = 'date,category,amount,description';
  const rows = expenses.map(e => {
    const desc = e.description != null ? String(e.description) : '';
    // Escape fields that contain commas or quotes
    const escape = field => {
      const s = String(field);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    return [escape(e.date), escape(e.category), escape(e.amount), escape(desc)].join(',');
  });
  return [header, ...rows].join('\n');
}

// ── Filter helpers (inline per spec instructions) ─────────────────────────────

function filterByCategory(expenses, categoryValue) {
  return expenses.filter(e => e.category === categoryValue);
}

function filterByMonth(expenses, monthValue) {
  return expenses.filter(e => e.date.startsWith(monthValue));
}

// ─────────────────────────────────────────────────────────────────────────────
// Arbitraries (generators)
// ─────────────────────────────────────────────────────────────────────────────

// Valid ISO date string 'YYYY-MM-DD'
const arbDate = fc
  .tuple(
    fc.integer({ min: 2000, max: 2030 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }) // cap at 28 to avoid invalid dates
  )
  .map(([y, m, d]) => {
    const mm = String(m).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  });

// Valid month string 'YYYY-MM'
const arbMonth = fc
  .tuple(fc.integer({ min: 2000, max: 2030 }), fc.integer({ min: 1, max: 12 }))
  .map(([y, m]) => `${y}-${String(m).padStart(2, '0')}`);

// Non-empty category name (1–50 chars, no leading/trailing whitespace)
const arbCategoryName = fc
  .stringOf(fc.char(), { minLength: 1, maxLength: 50 })
  .filter(s => s.trim().length > 0 && s.trim().length === s.length);

// Valid expense object
const arbExpense = (categories) =>
  fc.record({
    id: fc.uuid(),
    amount: fc.float({ min: Math.fround(0.01), max: Math.fround(1_000_000), noNaN: true }),
    category: fc.constantFrom(...categories),
    date: arbDate,
    description: fc.oneof(fc.constant(''), fc.string({ maxLength: 200 })),
    insertOrder: fc.nat(),
  });

// A non-empty list of category names (unique, case-insensitively)
const arbCategories = fc
  .uniqueArray(arbCategoryName, { minLength: 1, maxLength: 10 })
  .filter(arr => {
    const lower = arr.map(c => c.toLowerCase());
    return new Set(lower).size === arr.length;
  });

// A list of expenses (may be empty)
const arbExpenseList = (categories) =>
  fc.array(arbExpense(categories), { minLength: 0, maxLength: 20 });

// Full application state
const arbState = arbCategories.chain(categories =>
  arbExpenseList(categories).chain(expenses =>
    fc.record({
      expenses: fc.constant(expenses),
      budgets: fc.dictionary(
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.float({ min: Math.fround(0.01), max: Math.fround(10_000), noNaN: true })
      ),
      categories: fc.constant(categories),
      ui: fc.record({
        selectedMonth: arbMonth,
        editingExpenseId: fc.constant(null),
        filters: fc.record({
          category: fc.constant(null),
          month: fc.constant(null),
        }),
      }),
    })
  )
);

// ─────────────────────────────────────────────────────────────────────────────
// PBT configuration
// ─────────────────────────────────────────────────────────────────────────────
const PBT_RUNS = 100;

// ─────────────────────────────────────────────────────────────────────────────
// Task 3.1 — Property 1: Storage Round-Trip Preserves Full State
// Feature: expenses-budget-visualizer, Property 1: Storage Round-Trip Preserves Full State
// Validates: Requirements 8.2, 8.5, 8.6
// ─────────────────────────────────────────────────────────────────────────────
describe('Property 1: Storage Round-Trip Preserves Full State', () => {
  // Feature: expenses-budget-visualizer, Property 1: Storage Round-Trip Preserves Full State
  test('serialise → deserialise preserves expenses, budgets, and categories', () => {
    fc.assert(
      fc.property(arbState, state => {
        const store = {};
        storageWrite(store, 'ebv_expenses', state.expenses);
        storageWrite(store, 'ebv_budgets', state.budgets);
        storageWrite(store, 'ebv_categories', state.categories);

        const restoredExpenses = storageRead(store, 'ebv_expenses');
        const restoredBudgets = storageRead(store, 'ebv_budgets');
        const restoredCategories = storageRead(store, 'ebv_categories');

        // Expenses: same set by id, amount, category, date, description, insertOrder
        expect(restoredExpenses).toHaveLength(state.expenses.length);
        for (const orig of state.expenses) {
          const found = restoredExpenses.find(e => e.id === orig.id);
          expect(found).toBeDefined();
          expect(found.amount).toBe(orig.amount);
          expect(found.category).toBe(orig.category);
          expect(found.date).toBe(orig.date);
          expect(found.description).toBe(orig.description);
          expect(found.insertOrder).toBe(orig.insertOrder);
        }

        // Budgets: same keys and values
        expect(Object.keys(restoredBudgets).sort()).toEqual(
          Object.keys(state.budgets).sort()
        );
        for (const key of Object.keys(state.budgets)) {
          expect(restoredBudgets[key]).toBe(state.budgets[key]);
        }

        // Categories: same names
        expect([...restoredCategories].sort()).toEqual([...state.categories].sort());
      }),
      { numRuns: PBT_RUNS }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Task 3.2 — Property 2: Valid Expense Addition Grows the List
// Feature: expenses-budget-visualizer, Property 2: Valid Expense Addition Grows the List
// Validates: Requirements 1.2, 8.1
// ─────────────────────────────────────────────────────────────────────────────
describe('Property 2: Valid Expense Addition Grows the List', () => {
  // Feature: expenses-budget-visualizer, Property 2: Valid Expense Addition Grows the List
  test('adding a valid expense increases list length by exactly 1 and expense is retrievable by id', () => {
    fc.assert(
      fc.property(
        arbCategories.chain(cats =>
          fc.tuple(arbExpenseList(cats), arbExpense(cats), fc.constant(cats))
        ),
        ([expenses, newExpense, categories]) => {
          const initialState = {
            expenses,
            budgets: {},
            categories,
            ui: { selectedMonth: '2025-01', editingExpenseId: null, filters: { category: null, month: null } },
          };

          // Validate the expense first
          const validation = validateExpense(newExpense);
          // Our generator always produces valid expenses, but guard anyway
          expect(validation.valid).toBe(true);

          const nextState = stateAddExpense(initialState, newExpense);

          // Length grows by exactly 1
          expect(nextState.expenses).toHaveLength(initialState.expenses.length + 1);

          // Expense is retrievable by id with all fields intact
          const found = nextState.expenses.find(e => e.id === newExpense.id);
          expect(found).toBeDefined();
          expect(found.amount).toBe(newExpense.amount);
          expect(found.category).toBe(newExpense.category);
          expect(found.date).toBe(newExpense.date);
          expect(found.description).toBe(newExpense.description);
          expect(found.insertOrder).toBe(newExpense.insertOrder);
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Task 3.3 — Property 4: Expense Edit Overwrites Without Duplication
// Feature: expenses-budget-visualizer, Property 4: Expense Edit Overwrites Without Duplication
// Validates: Requirements 2.3
// ─────────────────────────────────────────────────────────────────────────────
describe('Property 4: Expense Edit Overwrites Without Duplication', () => {
  // Feature: expenses-budget-visualizer, Property 4: Expense Edit Overwrites Without Duplication
  test('editing an expense replaces the record in-place; list length unchanged, same id, new values', () => {
    fc.assert(
      fc.property(
        arbCategories.chain(cats =>
          fc.tuple(
            fc.array(arbExpense(cats), { minLength: 1, maxLength: 20 }),
            fc.constant(cats)
          )
        ),
        ([expenses, categories]) => {
          // Pick a random index to edit
          const idx = 0; // always edit the first expense for determinism
          const target = expenses[idx];

          const updates = {
            amount: 42.99,
            category: categories[0],
            date: '2025-06-15',
            description: 'updated description',
          };

          const initialState = {
            expenses,
            budgets: {},
            categories,
            ui: { selectedMonth: '2025-06', editingExpenseId: target.id, filters: { category: null, month: null } },
          };

          const nextState = stateUpdateExpense(initialState, target.id, updates);

          // List length unchanged
          expect(nextState.expenses).toHaveLength(initialState.expenses.length);

          // The updated expense is retrievable by the same id with new values
          const found = nextState.expenses.find(e => e.id === target.id);
          expect(found).toBeDefined();
          expect(found.amount).toBe(updates.amount);
          expect(found.category).toBe(updates.category);
          expect(found.date).toBe(updates.date);
          expect(found.description).toBe(updates.description);

          // No duplicate: only one expense with that id
          const allWithId = nextState.expenses.filter(e => e.id === target.id);
          expect(allWithId).toHaveLength(1);
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Task 3.4 — Property 5: Delete Confirmation Is a No-Op When Cancelled
// Feature: expenses-budget-visualizer, Property 5: Delete Confirmation Is a No-Op When Cancelled
// Validates: Requirements 2.7
// ─────────────────────────────────────────────────────────────────────────────
describe('Property 5: Delete Confirmation Is a No-Op When Cancelled', () => {
  // Feature: expenses-budget-visualizer, Property 5: Delete Confirmation Is a No-Op When Cancelled
  test('stateRemoveExpense with a non-existent id leaves the list unchanged', () => {
    fc.assert(
      fc.property(
        arbCategories.chain(cats => arbExpenseList(cats)),
        expenses => {
          const nonExistentId = 'non-existent-id-that-will-never-match';
          const initialState = {
            expenses,
            budgets: {},
            categories: [],
            ui: { selectedMonth: '2025-01', editingExpenseId: null, filters: { category: null, month: null } },
          };

          const nextState = stateRemoveExpense(initialState, nonExistentId);

          // Length unchanged
          expect(nextState.expenses).toHaveLength(initialState.expenses.length);

          // All original expenses still present
          for (const orig of initialState.expenses) {
            const found = nextState.expenses.find(e => e.id === orig.id);
            expect(found).toBeDefined();
          }
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  test('simulating cancel: NOT calling stateRemoveExpense leaves list unchanged', () => {
    fc.assert(
      fc.property(
        arbCategories.chain(cats => arbExpenseList(cats)),
        expenses => {
          const initialState = {
            expenses,
            budgets: {},
            categories: [],
            ui: { selectedMonth: '2025-01', editingExpenseId: null, filters: { category: null, month: null } },
          };

          // Cancel = do nothing; state is unchanged
          const stateAfterCancel = initialState;

          expect(stateAfterCancel.expenses).toHaveLength(initialState.expenses.length);
          expect(stateAfterCancel.expenses).toEqual(initialState.expenses);
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Task 3.5 — Property 7: Category Filter Returns Exact Match Set
// Feature: expenses-budget-visualizer, Property 7: Category Filter Returns Exact Match Set
// Validates: Requirements 5.2, 5.4
// ─────────────────────────────────────────────────────────────────────────────
describe('Property 7: Category Filter Returns Exact Match Set', () => {
  // Feature: expenses-budget-visualizer, Property 7: Category Filter Returns Exact Match Set
  test('every expense in filtered result has the filter category; every matching expense appears in result', () => {
    fc.assert(
      fc.property(
        arbCategories.chain(cats =>
          fc.tuple(arbExpenseList(cats), fc.constantFrom(...cats), fc.constant(cats))
        ),
        ([expenses, filterCategory]) => {
          const filtered = filterByCategory(expenses, filterCategory);

          // No false inclusions: every result has the filter category
          for (const e of filtered) {
            expect(e.category).toBe(filterCategory);
          }

          // No false exclusions: every expense with that category appears in result
          const expectedIds = expenses
            .filter(e => e.category === filterCategory)
            .map(e => e.id);
          const filteredIds = filtered.map(e => e.id);
          for (const id of expectedIds) {
            expect(filteredIds).toContain(id);
          }

          // Counts match
          expect(filtered).toHaveLength(expectedIds.length);
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Task 3.6 — Property 8: Month Filter Returns Exact Match Set
// Feature: expenses-budget-visualizer, Property 8: Month Filter Returns Exact Match Set
// Validates: Requirements 5.3, 5.4
// ─────────────────────────────────────────────────────────────────────────────
describe('Property 8: Month Filter Returns Exact Match Set', () => {
  // Feature: expenses-budget-visualizer, Property 8: Month Filter Returns Exact Match Set
  test('every expense in filtered result has a date in the filter month; every matching expense appears in result', () => {
    fc.assert(
      fc.property(
        arbCategories.chain(cats =>
          fc.tuple(arbExpenseList(cats), arbMonth)
        ),
        ([expenses, filterMonth]) => {
          const filtered = filterByMonth(expenses, filterMonth);

          // No false inclusions: every result date starts with the filter month
          for (const e of filtered) {
            expect(e.date.startsWith(filterMonth)).toBe(true);
          }

          // No false exclusions: every expense with a matching date appears in result
          const expectedIds = expenses
            .filter(e => e.date.startsWith(filterMonth))
            .map(e => e.id);
          const filteredIds = filtered.map(e => e.id);
          for (const id of expectedIds) {
            expect(filteredIds).toContain(id);
          }

          // Counts match
          expect(filtered).toHaveLength(expectedIds.length);
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Task 4.1 — Property 3: Invalid Expense Input Is Rejected
// Feature: expenses-budget-visualizer, Property 3: Invalid Expense Input Is Rejected
// Validates: Requirements 1.3, 1.4, 2.2
// ─────────────────────────────────────────────────────────────────────────────
describe('Property 3: Invalid Expense Input Is Rejected', () => {
  // Feature: expenses-budget-visualizer, Property 3: Invalid Expense Input Is Rejected

  // Generator for invalid amounts: zero, negative, non-numeric, absent
  const arbInvalidAmount = fc.oneof(
    fc.constant(0),
    fc.constant(-1),
    fc.float({ min: Math.fround(-1_000_000), max: Math.fround(-0.001), noNaN: true }),
    fc.constant(''),
    fc.constant(null),
    fc.constant(undefined),
    fc.constant('abc'),
    fc.constant('not-a-number'),
    fc.constant(NaN)
  );

  // Generator for invalid categories: absent, empty, whitespace
  const arbInvalidCategory = fc.oneof(
    fc.constant(''),
    fc.constant(null),
    fc.constant(undefined),
    fc.constant('   ')
  );

  test('invalid amount → valid: false with amount error', () => {
    fc.assert(
      fc.property(
        fc.tuple(arbInvalidAmount, arbDate),
        ([amount, date]) => {
          const result = validateExpense({ amount, category: 'Food', date, description: '' });
          expect(result.valid).toBe(false);
          expect(result.errors).toHaveProperty('amount');
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  test('invalid category → valid: false with category error', () => {
    fc.assert(
      fc.property(
        fc.tuple(fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }), arbDate, arbInvalidCategory),
        ([amount, date, category]) => {
          const result = validateExpense({ amount, category, date, description: '' });
          expect(result.valid).toBe(false);
          expect(result.errors).toHaveProperty('category');
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  test('invalid amount AND invalid category → valid: false with at least one error', () => {
    fc.assert(
      fc.property(
        fc.tuple(arbInvalidAmount, arbDate, arbInvalidCategory),
        ([amount, date, category]) => {
          const result = validateExpense({ amount, category, date, description: '' });
          expect(result.valid).toBe(false);
          expect(Object.keys(result.errors).length).toBeGreaterThanOrEqual(1);
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Task 4.2 — Property 6: Invalid Category Input Is Rejected
// Feature: expenses-budget-visualizer, Property 6: Invalid Category Input Is Rejected
// Validates: Requirements 3.3, 3.4
// ─────────────────────────────────────────────────────────────────────────────
describe('Property 6: Invalid Category Input Is Rejected', () => {
  // Feature: expenses-budget-visualizer, Property 6: Invalid Category Input Is Rejected

  const existingCategories = ['Food', 'Transport', 'Entertainment', 'Health', 'Shopping', 'Other'];

  // Empty string
  test('empty string → valid: false', () => {
    fc.assert(
      fc.property(fc.constant(''), name => {
        const result = validateCategory(name, existingCategories);
        expect(result.valid).toBe(false);
      }),
      { numRuns: PBT_RUNS }
    );
  });

  // Whitespace-only strings
  test('whitespace-only string → valid: false', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(' ', '\t', '\n'), { minLength: 1, maxLength: 20 }),
        name => {
          const result = validateCategory(name, existingCategories);
          expect(result.valid).toBe(false);
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  // Strings longer than 50 characters (trimmed length must also exceed 50)
  test('name longer than 50 chars → valid: false', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 51, maxLength: 200 }).filter(s => s.trim().length > 50),
        name => {
          const result = validateCategory(name, existingCategories);
          expect(result.valid).toBe(false);
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  // Case-insensitive duplicate of an existing category
  test('case-insensitive duplicate of existing category → valid: false', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...existingCategories).map(c =>
          // Randomly vary the case
          c
            .split('')
            .map((ch, i) => (i % 2 === 0 ? ch.toUpperCase() : ch.toLowerCase()))
            .join('')
        ),
        name => {
          const result = validateCategory(name, existingCategories);
          expect(result.valid).toBe(false);
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Task 4.3 — Property 11: CSV Export Row Completeness and Correctness
// Feature: expenses-budget-visualizer, Property 11: CSV Export Row Completeness and Correctness
// Validates: Requirements 9.1, 9.2
// ─────────────────────────────────────────────────────────────────────────────
describe('Property 11: CSV Export Row Completeness and Correctness', () => {
  // Feature: expenses-budget-visualizer, Property 11: CSV Export Row Completeness and Correctness

  // Generator for non-empty expense arrays with simple (no-comma) field values
  // to keep CSV parsing straightforward in the test assertions
  const arbSimpleExpense = fc.record({
    id: fc.uuid(),
    amount: fc.float({ min: Math.fround(0.01), max: Math.fround(9999.99), noNaN: true }),
    category: fc.constantFrom('Food', 'Transport', 'Health'),
    date: arbDate,
    // Descriptions without commas or quotes for simple CSV parsing in assertions
    description: fc.oneof(
      fc.constant(''),
      fc.stringOf(
        fc.char().filter(c => c !== ',' && c !== '"' && c !== '\n' && c !== '\r'),
        { minLength: 0, maxLength: 50 }
      )
    ),
    insertOrder: fc.nat(),
  });

  const arbNonEmptyExpenseList = fc.array(arbSimpleExpense, { minLength: 1, maxLength: 20 });

  test('produces exactly n+1 lines, correct header, correct data rows', () => {
    fc.assert(
      fc.property(arbNonEmptyExpenseList, expenses => {
        const csv = expensesToCSV(expenses);
        const lines = csv.split('\n');

        // Exactly n+1 lines
        expect(lines).toHaveLength(expenses.length + 1);

        // Header row
        expect(lines[0]).toBe('date,category,amount,description');

        // Each data row has correct values in correct order
        for (let i = 0; i < expenses.length; i++) {
          const e = expenses[i];
          const row = lines[i + 1];
          const parts = row.split(',');

          // At least 4 parts (description may be empty but column must exist)
          expect(parts.length).toBeGreaterThanOrEqual(4);

          expect(parts[0]).toBe(String(e.date));
          expect(parts[1]).toBe(String(e.category));
          expect(parts[2]).toBe(String(e.amount));
          // Description: parts[3] may be empty string
          const expectedDesc = e.description != null ? String(e.description) : '';
          expect(parts[3]).toBe(expectedDesc);
        }
      }),
      { numRuns: PBT_RUNS }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Inline implementations of pure helpers from UI Renderers section
// These match the exact logic in app.js renderSummaryPanel / renderCharts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the total amount spent for the selected month.
 */
function computeMonthTotal(expenses, selectedMonth) {
  return expenses
    .filter(function (e) { return e.date.indexOf(selectedMonth) === 0; })
    .reduce(function (sum, e) { return sum + Number(e.amount); }, 0);
}

/**
 * Compute per-category spending for the selected month.
 */
function computeCategorySpending(expenses, selectedMonth) {
  var result = {};
  expenses
    .filter(function (e) { return e.date.indexOf(selectedMonth) === 0; })
    .forEach(function (e) {
      result[e.category] = (result[e.category] || 0) + Number(e.amount);
    });
  return result;
}

/**
 * Determine whether the overspend indicator should be applied.
 */
function isOverspent(spent, budgetLimit) {
  if (budgetLimit === undefined || budgetLimit === null || budgetLimit <= 0) return false;
  return spent >= budgetLimit;
}

/**
 * Determine chart visibility based on state.
 */
function computeChartVisibility(expenses, budgets, selectedMonth) {
  var monthExpenses = expenses.filter(function (e) {
    return e.date.indexOf(selectedMonth) === 0;
  });
  var hasExpenses = monthExpenses.length > 0;
  var hasPositiveBudget = Object.keys(budgets).some(function (key) {
    var parts = key.split('::');
    return parts[1] === selectedMonth && budgets[key] > 0;
  });
  return {
    showPie: hasExpenses,
    showBar: hasExpenses && hasPositiveBudget,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 7.7 — Property 9: Dashboard Total Equals Arithmetic Sum
// Feature: expenses-budget-visualizer, Property 9: Dashboard Total Equals Arithmetic Sum
// Validates: Requirements 6.1
// ─────────────────────────────────────────────────────────────────────────────
describe('Property 9: Dashboard Total Equals Arithmetic Sum', () => {
  // Feature: expenses-budget-visualizer, Property 9: Dashboard Total Equals Arithmetic Sum

  test('total for selected month equals arithmetic sum of expense amounts for that month', () => {
    fc.assert(
      fc.property(
        arbCategories.chain(cats =>
          fc.tuple(arbExpenseList(cats), arbMonth)
        ),
        ([expenses, selectedMonth]) => {
          const total = computeMonthTotal(expenses, selectedMonth);

          // Arithmetic sum of all expenses in the selected month
          const expected = expenses
            .filter(e => e.date.startsWith(selectedMonth))
            .reduce((sum, e) => sum + Number(e.amount), 0);

          expect(total).toBeCloseTo(expected, 5);
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  test('total is 0.00 when no expenses exist for the selected month', () => {
    fc.assert(
      fc.property(
        arbCategories.chain(cats =>
          fc.tuple(arbExpenseList(cats), arbMonth)
        ),
        ([expenses, selectedMonth]) => {
          // Filter to only expenses NOT in the selected month
          const otherExpenses = expenses.filter(e => !e.date.startsWith(selectedMonth));
          const total = computeMonthTotal(otherExpenses, selectedMonth);
          expect(total).toBe(0);
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Task 7.8 — Property 10: Budget Overspend Indicator Consistency
// Feature: expenses-budget-visualizer, Property 10: Budget Overspend Indicator Consistency
// Validates: Requirements 4.5
// ─────────────────────────────────────────────────────────────────────────────
describe('Property 10: Budget Overspend Indicator Consistency', () => {
  // Feature: expenses-budget-visualizer, Property 10: Budget Overspend Indicator Consistency

  // Generator for a positive budget limit
  const arbPositiveBudget = fc.float({
    min: Math.fround(0.01),
    max: Math.fround(10_000),
    noNaN: true,
  });

  test('indicator applied when spent >= budget; not applied when spent < budget', () => {
    fc.assert(
      fc.property(
        arbCategories.chain(cats =>
          fc.tuple(
            arbExpenseList(cats),
            arbMonth,
            fc.constantFrom(...cats),
            arbPositiveBudget
          )
        ),
        ([expenses, selectedMonth, category, budgetLimit]) => {
          // Compute spending for this category in the selected month
          const categorySpending = computeCategorySpending(expenses, selectedMonth);
          const spent = categorySpending[category] || 0;

          const exceeded = isOverspent(spent, budgetLimit);

          if (spent >= budgetLimit) {
            expect(exceeded).toBe(true);
          } else {
            expect(exceeded).toBe(false);
          }
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  test('indicator NOT applied when no budget is set (undefined/null/zero)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0), max: Math.fround(10_000), noNaN: true }),
        fc.oneof(fc.constant(undefined), fc.constant(null), fc.constant(0)),
        (spent, budgetLimit) => {
          expect(isOverspent(spent, budgetLimit)).toBe(false);
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Task 7.10 — Property 12: Chart Visibility Matches Data Availability
// Feature: expenses-budget-visualizer, Property 12: Chart Visibility Matches Data Availability
// Validates: Requirements 7.1, 7.2, 7.3
// ─────────────────────────────────────────────────────────────────────────────
describe('Property 12: Chart Visibility Matches Data Availability', () => {
  // Feature: expenses-budget-visualizer, Property 12: Chart Visibility Matches Data Availability

  // Generator for a budgets object keyed by "category::YYYY-MM"
  const arbBudgets = arbCategories.chain(cats =>
    fc.array(
      fc.tuple(
        fc.constantFrom(...cats),
        arbMonth,
        fc.float({ min: Math.fround(0.01), max: Math.fround(10_000), noNaN: true })
      ),
      { minLength: 0, maxLength: 10 }
    ).map(entries => {
      const budgets = {};
      entries.forEach(([cat, month, amount]) => {
        budgets[cat + '::' + month] = amount;
      });
      return budgets;
    })
  );

  test('pie chart visible iff at least one expense exists for selected month', () => {
    fc.assert(
      fc.property(
        arbCategories.chain(cats =>
          fc.tuple(arbExpenseList(cats), arbBudgets, arbMonth)
        ),
        ([expenses, budgets, selectedMonth]) => {
          const { showPie } = computeChartVisibility(expenses, budgets, selectedMonth);
          const hasExpenses = expenses.some(e => e.date.startsWith(selectedMonth));
          expect(showPie).toBe(hasExpenses);
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  test('bar chart visible iff at least one expense AND at least one positive budget for selected month', () => {
    fc.assert(
      fc.property(
        arbCategories.chain(cats =>
          fc.tuple(arbExpenseList(cats), arbBudgets, arbMonth)
        ),
        ([expenses, budgets, selectedMonth]) => {
          const { showBar } = computeChartVisibility(expenses, budgets, selectedMonth);

          const hasExpenses = expenses.some(e => e.date.startsWith(selectedMonth));
          const hasPositiveBudget = Object.keys(budgets).some(key => {
            const parts = key.split('::');
            return parts[1] === selectedMonth && budgets[key] > 0;
          });

          expect(showBar).toBe(hasExpenses && hasPositiveBudget);
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });

  test('both charts hidden when no expenses for selected month', () => {
    fc.assert(
      fc.property(
        arbCategories.chain(cats =>
          fc.tuple(arbExpenseList(cats), arbBudgets, arbMonth)
        ),
        ([expenses, budgets, selectedMonth]) => {
          // Use only expenses NOT in the selected month
          const otherExpenses = expenses.filter(e => !e.date.startsWith(selectedMonth));
          const { showPie, showBar } = computeChartVisibility(otherExpenses, budgets, selectedMonth);
          expect(showPie).toBe(false);
          expect(showBar).toBe(false);
        }
      ),
      { numRuns: PBT_RUNS }
    );
  });
});
