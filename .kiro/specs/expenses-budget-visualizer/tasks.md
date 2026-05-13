# Implementation Plan: Expenses & Budget Visualizer

## Overview

Build a fully client-side single-page application using HTML, CSS, and Vanilla JavaScript. The project uses exactly three files:
- `index.html` — all markup
- `css/style.css` — all styles
- `js/app.js` — all JavaScript, organized into clearly labeled sections

The implementation follows a top-to-bottom order within `js/app.js`: constants and storage first, then state and validators, then actions, then UI renderers, and finally the bootstrap. All data persists in `localStorage` with no backend or build tools required.

## Tasks

- [x] 1. Create project structure and HTML scaffold
  - Create `index.html` with semantic HTML: header, main layout sections (dashboard with month nav + summary panel + charts, expense form, budget form, expense list, category manager, filter controls), and `<canvas>` placeholders for pie and bar charts
  - Link `<link rel="stylesheet" href="css/style.css">` and `<script src="js/app.js" defer></script>` in `index.html`
  - Create empty `css/style.css` and `js/app.js` files
  - _Requirements: 1.1, 7.5, 7.6_

- [x] 2. Implement CSS layout and visual design
  - Add CSS custom properties for theming (colors, spacing, typography)
  - Implement base reset and readable typography
  - Implement responsive grid: single-column layout below 768px, multi-column at 768px and above
  - Ensure all interactive elements have a minimum touch target of 44×44 CSS pixels
  - Ensure no horizontal overflow from 320px to 2560px viewport widths
  - Add visual warning style (e.g., red background or warning icon) for budget-exceeded rows in the summary panel
  - _Requirements: 4.5, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [x] 3. Implement Constants, Storage, and State sections in `js/app.js`
  - Add `// ── Constants ──` section: `STORAGE_KEYS` object (`ebv_expenses`, `ebv_budgets`, `ebv_categories`) and `DEFAULT_CATEGORIES` array
  - Add `// ── Storage ──` section: `storageRead(key)`, `storageWrite(key, data)`, `storageAvailable()` — wrap `localStorage` with try/catch; throw `Error` on failure
  - Add `// ── State ──` section: `let state = { expenses, budgets, categories, ui }` and pure mutation helpers: `stateAddExpense`, `stateUpdateExpense`, `stateRemoveExpense`, `stateSetBudget`, `stateAddCategory`, `stateRemoveCategory`, `stateSetFilter`, `stateSetSelectedMonth`
  - _Requirements: 3.1, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 3.1 Write property test for storage round-trip preserving full state
    - **Property 1: Storage Round-Trip Preserves Full State**
    - **Validates: Requirements 8.2, 8.5, 8.6**

  - [x] 3.2 Write property test for valid expense addition growing the list
    - **Property 2: Valid Expense Addition Grows the List**
    - **Validates: Requirements 1.2, 8.1**

  - [x] 3.3 Write property test for expense edit overwriting without duplication
    - **Property 4: Expense Edit Overwrites Without Duplication**
    - **Validates: Requirements 2.3**

  - [x] 3.4 Write property test for delete cancel being a no-op
    - **Property 5: Delete Confirmation Is a No-Op When Cancelled**
    - **Validates: Requirements 2.7**

  - [x] 3.5 Write property test for category filter returning exact match set
    - **Property 7: Category Filter Returns Exact Match Set**
    - **Validates: Requirements 5.2, 5.4**

  - [x] 3.6 Write property test for month filter returning exact match set
    - **Property 8: Month Filter Returns Exact Match Set**
    - **Validates: Requirements 5.3, 5.4**

- [x] 4. Implement Validators and Utils sections in `js/app.js`
  - Add `// ── Validators ──` section: `validateExpense({ amount, category, date, description })`, `validateBudget({ amount, category, month })`, `validateCategory(name, existingCategories)` — each returns `{ valid, errors }`
  - Enforce: amount must be a positive number; category must be non-empty and exist in the category list; category name must be 1–50 chars and case-insensitively unique
  - Add `// ── Utils ──` section: `generateId()`, `formatCurrency()`, `formatDate()`, `getCurrentDate()`, `getCurrentMonth()`, `expensesToCSV(expenses)`, `downloadFile(filename, content, mimeType)`, `budgetKey(category, month)`
  - `expensesToCSV` must produce a header row `date,category,amount,description` followed by one row per expense; absent description is an empty cell
  - _Requirements: 1.3, 1.4, 2.2, 3.3, 3.4, 4.2, 9.2, 9.3_

  - [x] 4.1 Write property test for invalid expense input being rejected
    - **Property 3: Invalid Expense Input Is Rejected**
    - **Validates: Requirements 1.3, 1.4, 2.2**

  - [x] 4.2 Write property test for invalid category input being rejected
    - **Property 6: Invalid Category Input Is Rejected**
    - **Validates: Requirements 3.3, 3.4**

  - [x] 4.3 Write property test for CSV export row completeness and correctness
    - **Property 11: CSV Export Row Completeness and Correctness**
    - **Validates: Requirements 9.1, 9.2**

- [x] 5. Checkpoint — Verify core logic before building UI
  - Manually test storage read/write, state mutations, validators, and CSV generation in the browser console
  - Confirm default categories seed correctly on first load

- [x] 6. Implement Actions section in `js/app.js`
  - Add `// ── Actions ──` section with: `saveExpense(formData)`, `deleteExpense(id)`, `saveBudget(formData)`, `saveCategory(name)`, `deleteCategory(name)`, `applyFilter(filterType, value)`, `navigateMonth(direction)`, `exportCSV()`
  - Each action: validates input → mutates state → writes to storage → calls `render()`
  - `deleteExpense` and `deleteCategory` call `window.confirm()` before proceeding; cancellation leaves state unchanged
  - On storage write failure: call `renderToast(message, 'error')` and do NOT update in-memory state
  - `exportCSV`: abort and show error if CSV lacks all four required columns; show informational toast if no expenses exist; filename must match `expenses-YYYY-MM-DD.csv`
  - _Requirements: 1.2, 1.5, 2.3, 2.5, 2.6, 2.7, 3.2, 3.5, 3.6, 3.7, 4.1, 4.3, 8.3, 8.4, 9.1, 9.3, 9.4, 9.5_

- [x] 7. Implement UI Renderer functions in `js/app.js`
  - Add `// ── UI Renderers ──` section with the following functions, each reading from `state` and updating its DOM subtree:

  - [x] 7.1 `renderMonthNav()`
    - Render previous/next month buttons and display selected month as `MMMM YYYY`
    - Wire buttons to `navigateMonth('prev')` and `navigateMonth('next')`
    - _Requirements: 6.3_

  - [x] 7.2 `renderExpenseForm()`
    - Render add/edit form: amount, category (select), date (default current date), description (optional, max 200 chars)
    - When `state.ui.editingExpenseId` is set, populate all fields with the matching expense's values
    - Display inline validation errors adjacent to offending fields on failed submit
    - Reset all fields to default after successful save
    - Wire submit to `saveExpense(formData)`
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.4_

  - [x] 7.3 `renderBudgetForm()`
    - Render budget form: category selector and amount field
    - Display inline validation errors on invalid submission
    - Wire submit to `saveBudget(formData)`
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 7.4 `renderFilters()`
    - Render category filter dropdown and month filter input
    - Wire changes to `applyFilter('category', value)` and `applyFilter('month', value)`
    - _Requirements: 5.2, 5.3, 5.4_

  - [x] 7.5 `renderExpenseList()`
    - Render filtered expense rows sorted by date descending, then by `insertOrder` descending for same-date ties
    - Display amount, category, date, and description (empty string when absent)
    - Show "no results found" message when filtered list is empty
    - Render edit and delete buttons per row; edit sets `state.ui.editingExpenseId`; delete calls `deleteExpense(id)`
    - _Requirements: 2.1, 2.5, 2.6, 2.7, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 7.6 `renderSummaryPanel()`
    - Display total amount spent for the selected month (0.00 when no expenses)
    - For each category with a budget set: show budget limit, amount spent, difference, and percentage used
    - For each category with expenses but no budget: show amount spent only (no percentage)
    - Apply the CSS warning class when spending ≥ budget limit for a category
    - _Requirements: 4.4, 4.5, 6.1, 6.2_

  - [x] 7.7 Write property test for dashboard total equaling arithmetic sum
    - **Property 9: Dashboard Total Equals Arithmetic Sum**
    - **Validates: Requirements 6.1**

  - [x] 7.8 Write property test for budget overspend indicator consistency
    - **Property 10: Budget Overspend Indicator Consistency**
    - **Validates: Requirements 4.5**

  - [x] 7.9 `renderCharts()`
    - Render pie chart (spending proportion per category) using HTML Canvas API only
    - Render bar chart (spending vs budget per category) using HTML Canvas API only
    - Hide pie chart when no expenses exist for the selected month
    - Hide bar chart when no expenses exist OR no category has a positive budget for the selected month
    - Display "no expenses recorded for this month" message when all charts are hidden
    - Add `aria-label` and text content fallback to each `<canvas>` element
    - If Canvas API is unavailable, hide chart containers and show a text fallback
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 7.10 Write property test for chart visibility matching data availability
    - **Property 12: Chart Visibility Matches Data Availability**
    - **Validates: Requirements 7.1, 7.2, 7.3**

  - [x] 7.11 `renderCategoryManager()`
    - Render category list with add input and delete buttons
    - Disable delete button for all default categories
    - Disable delete button (with tooltip) for user categories that have associated expenses or budgets
    - Wire add to `saveCategory(name)` and delete to `deleteCategory(name)`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 7.12 `renderToast(message, type)`
    - Render a non-blocking notification banner (type: `'error'` | `'warning'` | `'info'`)
    - Banner must not prevent the user from interacting with the rest of the app
    - Auto-dismiss after a few seconds
    - _Requirements: 8.3, 8.4_

- [x] 8. Implement master `render()` and `init()` in `js/app.js`
  - Add `// ── Render & Init ──` section
  - `render()` calls all renderer functions in order: `renderMonthNav`, `renderExpenseForm`, `renderBudgetForm`, `renderFilters`, `renderExpenseList`, `renderSummaryPanel`, `renderCharts`, `renderCategoryManager`
  - `init()`: check `storageAvailable()`; if unavailable, call `renderToast` with a warning and use empty in-memory state; otherwise load state from storage; seed `DEFAULT_CATEGORIES` if no categories exist; set `state.ui.selectedMonth` to current month; call `render()`
  - Register `document.addEventListener('DOMContentLoaded', init)`
  - _Requirements: 3.1, 6.3, 6.4, 6.5, 8.2, 8.3_

- [x] 9. Final end-to-end verification
  - Open `index.html` directly in a browser (no server needed) and verify:
    - Add, edit, and delete expenses work and persist across page reloads
    - Budget setting and overspend indicator work correctly
    - Category add/delete works with all guard conditions
    - Filters narrow the expense list correctly
    - Charts render and update on data changes
    - CSV export downloads with correct filename and content
    - Layout is correct at 320px, 768px, and 1280px viewport widths
  - _Requirements: all_

## Notes

- Tasks marked with `*` are optional property-based tests — skip for a faster MVP (aligned with NFR-1: Simplicity — no test setup required)
- The entire app ships as three static files: `index.html`, `css/style.css`, `js/app.js` — no build step, no server required
- All JavaScript sections in `app.js` are separated by clearly labeled comment banners (e.g., `// ── Storage ──────────────────────────────────────────────────────────────────`)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["3", "4"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "4.1", "4.2", "4.3"] },
    { "id": 3, "tasks": ["5", "6"] },
    { "id": 4, "tasks": ["7.1", "7.2", "7.3", "7.4", "7.5", "7.6", "7.9", "7.11", "7.12"] },
    { "id": 5, "tasks": ["7.7", "7.8", "7.10"] },
    { "id": 6, "tasks": ["8"] },
    { "id": 7, "tasks": ["9"] }
  ]
}
```
