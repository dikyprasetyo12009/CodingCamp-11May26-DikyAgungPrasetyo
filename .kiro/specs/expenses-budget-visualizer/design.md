# Design Document: Expenses & Budget Visualizer

## Overview

The Expenses & Budget Visualizer is a fully client-side single-page application (SPA) built with HTML, CSS, and Vanilla JavaScript. It enables users to track personal expenses, set monthly category budgets, and visualize spending patterns through canvas-rendered charts — all without a backend server or account registration.

All data is persisted in the browser's Local Storage as JSON. The app is designed to be immediately usable as a standalone `index.html` file or packaged as a browser extension.

### Key Design Principles

- **Zero dependencies**: No external libraries, no build tools, no frameworks. The entire app ships as static files.
- **Single-file JS**: All JavaScript lives in one file (`js/app.js`) organized into clearly separated sections using IIFE-style namespaces and comments. No ES Modules, no bundler required.
- **Event-driven UI**: A central state object drives all UI rendering. Data mutations call a central `render()` function that updates the DOM.
- **Graceful degradation**: Storage failures are surfaced as non-blocking warnings; the app continues to function in-memory.

---

## Architecture

The app follows a **unidirectional data flow** pattern adapted for a single vanilla JS file:

```
User Action → Action Handler → State Mutation → Storage Write → render()
```

### File Structure

```
expenses-budget-visualizer/
├── index.html        # Single HTML entry point; all markup scaffolding
├── css/
│   └── style.css     # All styles; CSS custom properties for theming and responsive layout
└── js/
    └── app.js        # All JavaScript in one file, organized into sections:
                      #   - Constants & Storage Keys
                      #   - Storage helpers (read, write, isAvailable)
                      #   - State (central state object + mutation helpers)
                      #   - Validators (validateExpense, validateBudget, validateCategory)
                      #   - Utils (generateId, formatCurrency, formatDate, expensesToCSV, etc.)
                      #   - Actions (saveExpense, deleteExpense, saveBudget, saveCategory, etc.)
                      #   - UI renderers (renderExpenseForm, renderExpenseList, renderSummaryPanel,
                      #                  renderCharts, renderCategoryManager, renderMonthNav,
                      #                  renderBudgetForm, renderFilters)
                      #   - render() — master re-render dispatcher
                      #   - init() — app bootstrap on DOMContentLoaded
```

### Data Flow Diagram

```mermaid
flowchart TD
    U[User Interaction] --> A[Action Handler\napp.js — Actions section]
    A --> V[Validator\napp.js — Validators section]
    V -->|valid| S[State Mutation\napp.js — State section]
    V -->|invalid| E[Inline Error\nDOM update]
    S --> ST[Storage Write\napp.js — Storage section]
    ST -->|success| R[render()\napp.js — UI Renderers]
    ST -->|failure| W[Non-blocking Warning\nDOM update]
    R --> D[DOM Update]
```

---

## Components and Interfaces

All code lives in `js/app.js`, organized into clearly labeled sections with comments. The sections below describe the logical groupings within that single file.

### Section 1: Constants & Storage Keys

```js
// ── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEYS = {
  EXPENSES:   'ebv_expenses',
  BUDGETS:    'ebv_budgets',
  CATEGORIES: 'ebv_categories',
};
const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Entertainment', 'Health', 'Shopping', 'Other'];
```

---

### Section 2: Storage Helpers

Wraps `localStorage` with error handling.

```js
// ── Storage ───────────────────────────────────────────────────────────────────
function storageRead(key) { /* returns parsed JSON or null; throws on failure */ }
function storageWrite(key, data) { /* serializes to JSON and writes; throws on failure */ }
function storageAvailable() { /* returns boolean */ }
```

**Error contract**: Both functions throw a plain `Error` on failure. Callers in the Actions section catch these and surface non-blocking UI warnings.

---

### Section 3: State

Single source of truth for all application data. Mutations return a new state object (immutable update pattern).

```js
// ── State ─────────────────────────────────────────────────────────────────────
let state = {
  expenses:   [],   // Expense[]
  budgets:    {},   // { [categoryKey: string]: number }  — key = "category::YYYY-MM"
  categories: [],   // string[]
  ui: {
    selectedMonth:    'YYYY-MM',
    editingExpenseId: null,
    filters: { category: null, month: null },
  },
};

function stateAddExpense(s, expense) { ... }
function stateUpdateExpense(s, id, updates) { ... }
function stateRemoveExpense(s, id) { ... }
function stateSetBudget(s, category, month, amount) { ... }
function stateAddCategory(s, name) { ... }
function stateRemoveCategory(s, name) { ... }
function stateSetFilter(s, filterType, value) { ... }
function stateSetSelectedMonth(s, month) { ... }
```

---

### Section 4: Validators

Pure functions — no side effects. Return `{ valid: boolean, errors: { [field]: string } }`.

```js
// ── Validators ────────────────────────────────────────────────────────────────
function validateExpense({ amount, category, date, description }) { ... }
function validateBudget({ amount, category, month }) { ... }
function validateCategory(name, existingCategories) { ... }
```

---

### Section 5: Utils

```js
// ── Utils ─────────────────────────────────────────────────────────────────────
function generateId() { /* returns UUID v4 string */ }
function formatCurrency(amount) { /* returns locale-formatted string */ }
function formatDate(dateStr) { /* returns display-formatted date */ }
function getCurrentDate() { /* returns 'YYYY-MM-DD' */ }
function getCurrentMonth() { /* returns 'YYYY-MM' */ }
function expensesToCSV(expenses) { /* returns CSV string with header row */ }
function downloadFile(filename, content, mimeType) { /* triggers browser download */ }
function budgetKey(category, month) { /* returns 'category::YYYY-MM' */ }
```

---

### Section 6: Actions

Each action validates input, mutates state, writes to storage, and calls `render()`.

```js
// ── Actions ───────────────────────────────────────────────────────────────────
function saveExpense(formData) { ... }    // handles both add and edit
function deleteExpense(id) { ... }        // calls window.confirm() first
function saveBudget(formData) { ... }
function saveCategory(name) { ... }
function deleteCategory(name) { ... }     // calls window.confirm() first
function applyFilter(filterType, value) { ... }
function navigateMonth(direction) { ... } // 'prev' | 'next'
function exportCSV() { ... }
```

---

### Section 7: UI Renderers

Each renderer reads from `state` and updates its DOM subtree. All renderers are called by the master `render()` function.

```js
// ── UI Renderers ──────────────────────────────────────────────────────────────
function renderMonthNav() { ... }         // prev/next buttons + "MMMM YYYY" label
function renderExpenseForm() { ... }      // add/edit form; populates fields in edit mode
function renderBudgetForm() { ... }       // budget set/update form
function renderExpenseList() { ... }      // filtered, sorted expense rows
function renderSummaryPanel() { ... }     // per-category breakdown + total
function renderCharts() { ... }           // pie chart + bar chart via Canvas API
function renderCategoryManager() { ... }  // category list with add/delete controls
function renderFilters() { ... }          // category + month filter dropdowns
function renderToast(message, type) { ... } // non-blocking notification banner
```

---

### Section 8: Master Render & Init

```js
// ── Render & Init ─────────────────────────────────────────────────────────────
function render() {
  renderMonthNav();
  renderExpenseForm();
  renderBudgetForm();
  renderExpenseList();
  renderSummaryPanel();
  renderCharts();
  renderCategoryManager();
  renderFilters();
}

function init() {
  // Load state from localStorage; seed default categories if none exist
  // Mount static HTML structure; call render()
}

document.addEventListener('DOMContentLoaded', init);
```

---

## Data Models

### Expense

```js
/**
 * @typedef {Object} Expense
 * @property {string}  id          - UUID v4, generated on creation
 * @property {number}  amount      - Positive number (e.g., 12.50)
 * @property {string}  category    - Category name (must exist in categories list)
 * @property {string}  date        - ISO date string 'YYYY-MM-DD'
 * @property {string}  description - Optional free text, max 200 chars (empty string if absent)
 * @property {number}  insertOrder - Monotonically increasing integer for same-date ordering
 */
```

### Budget

Budgets are stored as a flat object keyed by `"category::YYYY-MM"`:

```js
/**
 * @typedef {Object} BudgetStore
 * @property {Object.<string, number>} budgets
 * // Key format: "Food::2025-01" → 500
 */
```

### Category

Categories are stored as a plain array of strings:

```js
/**
 * @typedef {string[]} CategoryStore
 * // e.g., ["Food", "Transport", "Entertainment", "Health", "Shopping", "Other", "Gym"]
 */
```

### Default Categories

On first load (when Storage has no category data), the app seeds:
```js
const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Entertainment', 'Health', 'Shopping', 'Other'];
```

### Storage Schema

```js
// localStorage keys and their value shapes:
{
  "ebv_expenses":   Expense[],          // JSON array
  "ebv_budgets":    BudgetStore,        // JSON object
  "ebv_categories": CategoryStore,      // JSON array of strings
}
```

### Serialization Contract

All data is serialized with `JSON.stringify` and deserialized with `JSON.parse`. The round-trip must preserve:
- Expense: `id`, `amount`, `category`, `date`, `description`, `insertOrder`
- Budget: all `category::YYYY-MM` keys and their numeric values
- Category: all category name strings

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Storage Round-Trip Preserves Full State

*For any* application state (expenses, budgets, categories), writing the state to Storage and then reading it back SHALL produce a state with the same set of expenses (by id, amount, category, date, description, and insertOrder), budgets (by category::month key and amount), and categories (by name).

**Validates: Requirements 8.2, 8.5, 8.6**

---

### Property 2: Valid Expense Addition Grows the List

*For any* expense list and any valid expense (positive numeric amount, non-empty category from the existing category list, valid ISO date), adding the expense SHALL result in the expense list length increasing by exactly one, and the new expense SHALL be retrievable by its id with all field values intact.

**Validates: Requirements 1.2, 8.1**

---

### Property 3: Invalid Expense Input Is Rejected

*For any* expense form submission where the amount is zero, negative, non-numeric, or absent, OR the category is absent or not in the category list, the validator SHALL return `valid: false` with at least one field-level error, and the expense list SHALL remain unchanged in length and content.

**Validates: Requirements 1.3, 1.4, 2.2**

---

### Property 4: Expense Edit Overwrites Without Duplication

*For any* existing expense and any valid set of updated field values (amount, category, date, description), saving the edit SHALL replace the original expense record in Storage with the updated values, the expense list length SHALL remain unchanged (no duplicate created), and the updated expense SHALL be retrievable by the same id with the new field values.

**Validates: Requirements 2.3**

---

### Property 5: Delete Confirmation Is a No-Op When Cancelled

*For any* expense in the list, cancelling the deletion confirmation prompt SHALL leave the expense list length and all expense records in Storage completely unchanged.

**Validates: Requirements 2.7**

---

### Property 6: Invalid Category Input Is Rejected

*For any* string that is either empty, composed entirely of whitespace, longer than 50 characters, or equal (case-insensitively) to any existing category name, attempting to create a category with that name SHALL be rejected by the validator, and the category list SHALL remain unchanged in length and content.

**Validates: Requirements 3.3, 3.4**

---

### Property 7: Category Filter Returns Exact Match Set

*For any* expense list and any category filter value, every expense in the filtered result SHALL have a category equal to the filter value, and every expense in the full list with that category SHALL appear in the filtered result — no false inclusions and no false exclusions.

**Validates: Requirements 5.2, 5.4**

---

### Property 8: Month Filter Returns Exact Match Set

*For any* expense list and any month filter value (YYYY-MM), every expense in the filtered result SHALL have a date whose year and month match the filter, and every expense in the full list with a matching date SHALL appear in the filtered result — no false inclusions and no false exclusions.

**Validates: Requirements 5.3, 5.4**

---

### Property 9: Dashboard Total Equals Arithmetic Sum

*For any* set of expenses for a selected month, the total amount displayed on the Dashboard SHALL equal the arithmetic sum of all expense amounts for that month (with 0.00 when no expenses exist for the month).

**Validates: Requirements 6.1**

---

### Property 10: Budget Overspend Indicator Consistency

*For any* category and selected month, if the sum of all expense amounts in that category for that month is greater than or equal to the budget limit for that category and month, the Summary_Panel SHALL apply the overspend visual indicator to that category's row; if the sum is strictly less than the budget limit, the indicator SHALL NOT be applied.

**Validates: Requirements 4.5**

---

### Property 11: CSV Export Row Completeness and Correctness

*For any* non-empty expense list, the CSV string produced by `expensesToCSV` SHALL contain exactly `n + 1` lines (one header row plus one data row per expense), the header row SHALL contain the columns `date,category,amount,description` in that order, and each data row SHALL contain the correct date, category, amount, and description values for the corresponding expense in that same column order.

**Validates: Requirements 9.1, 9.2**

---

### Property 12: Chart Visibility Matches Data Availability

*For any* application state and selected month: the pie chart SHALL be visible if and only if there is at least one expense for the selected month; the bar chart SHALL be visible if and only if there is at least one expense AND at least one category with a positive budget set for the selected month.

**Validates: Requirements 7.1, 7.2, 7.3**

---

## Error Handling

### Validation Errors (User Input)

- Displayed as inline messages adjacent to the offending field
- Do not block other UI interactions
- Cleared when the user corrects the field and re-submits

### Storage Errors

| Scenario | Behavior |
|---|---|
| `localStorage` unavailable on load | Display non-blocking banner warning; operate with empty in-memory state |
| Read error on load | Same as above |
| Write failure during save | Display non-blocking toast error; do NOT update in-memory state |
| Quota exceeded | Treat as write failure; surface specific message about storage being full |

### Chart Rendering Errors

- If Canvas API is unavailable, hide chart containers and display a text fallback
- Each `<canvas>` element always has an `aria-label` and text content fallback

### Export Errors

- If CSV generation fails to produce all four required columns, abort the download and display an error message
- If no expenses exist, display an informational message and do not initiate a download

### Deletion Confirmation

- All delete actions (expense, category) require a `window.confirm()` prompt before proceeding
- Cancellation leaves data unchanged

---

## Testing Strategy

### Overview

This feature is a client-side vanilla JS application. The core logic (validation, state mutations, data transformation, CSV generation, filtering) consists of **pure functions** that are highly amenable to property-based testing. UI rendering and canvas chart drawing are tested with example-based and snapshot approaches.

### Property-Based Testing

**Library**: [fast-check](https://github.com/dubzzz/fast-check) (JavaScript PBT library, no framework dependency)

**Configuration**: Each property test runs a minimum of **100 iterations**.

**Tag format**: `// Feature: expenses-budget-visualizer, Property N: <property_text>`

Properties to implement as PBT tests:

| Property | Section Under Test | Generator Strategy |
|---|---|---|
| P1: Storage round-trip preserves full state | Storage section | Arbitrary full state objects (expenses, budgets, categories) |
| P2: Valid expense addition grows list | State section | Arbitrary valid expenses + existing lists |
| P3: Invalid expense input is rejected | Validators section | Arbitrary invalid amount/category combos |
| P4: Expense edit overwrites without duplication | State section | Arbitrary existing expenses + valid update values |
| P5: Delete cancel is a no-op | State + Actions sections | Arbitrary expense lists |
| P6: Invalid category input is rejected | Validators section | Arbitrary invalid category names (empty, whitespace, too long, duplicate) |
| P7: Category filter returns exact match set | State section filter logic | Arbitrary expense lists + category filter values |
| P8: Month filter returns exact match set | State section filter logic | Arbitrary expense lists + month filter values |
| P9: Dashboard total equals arithmetic sum | UI Renderers — renderSummaryPanel | Arbitrary expense amounts for a month |
| P10: Budget overspend indicator consistency | UI Renderers — renderSummaryPanel | Arbitrary expense amounts + budget limits |
| P11: CSV export row completeness and correctness | Utils section — expensesToCSV | Arbitrary non-empty expense arrays |
| P12: Chart visibility matches data availability | UI Renderers — renderCharts | Arbitrary states with varying expense/budget presence |

### Unit Tests (Example-Based)

Focus on specific scenarios and integration points:

- **Form reset after successful save** (Req 1.6, 2.4): Verify all fields return to default state
- **Edit mode population** (Req 2.1): Verify form fields are populated with selected expense values
- **Default categories on first load** (Req 3.1): Verify seeding when Storage is empty
- **Category deletion blocked when in use** (Req 3.6): Verify error message and no deletion
- **Default category deletion disabled** (Req 3.7): Verify delete action is unavailable
- **Budget overwrite** (Req 4.3): Verify existing budget is replaced, not duplicated
- **No-results message** (Req 5.5): Verify message appears when filters yield empty list
- **Dashboard update within 1 second** (Req 6.3, 6.4, 6.5): Verify synchronous re-render on data change
- **Chart hidden when no expenses** (Req 7.3): Verify chart containers are hidden
- **Bar chart hidden when no budgets** (Req 7.2): Verify bar chart is hidden
- **Storage unavailable warning** (Req 8.3): Verify non-blocking warning is shown
- **Write failure does not update state** (Req 8.4): Verify in-memory state is unchanged after failed write
- **Export filename format** (Req 9.3): Verify filename matches `expenses-YYYY-MM-DD.csv`
- **Export with no expenses** (Req 9.5): Verify informational message, no download
- **Responsive layout breakpoint** (Req 10.2, 10.3, 10.4): Verify CSS class/layout changes at 768px

### Integration Tests

- **Full add-expense flow**: Fill form → submit → verify Storage updated → verify Expense_List updated → verify Dashboard updated
- **Full edit-expense flow**: Select expense → modify → submit → verify Storage updated → verify list reflects change
- **Full delete-expense flow**: Click delete → confirm → verify removed from Storage and list
- **Full budget-set flow**: Set budget → verify Summary_Panel shows budget → add expense → verify overspend indicator triggers
- **Full export flow**: Add expenses → trigger export → verify CSV content and filename

### Accessibility Testing

- Verify all `<canvas>` elements have `aria-label` attributes (Req 7.6)
- Verify all interactive elements meet 44×44px touch target minimum on mobile viewport (Req 10.5)
- Verify no horizontal overflow at 320px viewport width (Req 10.6)
