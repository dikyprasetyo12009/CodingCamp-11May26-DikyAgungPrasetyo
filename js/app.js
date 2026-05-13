// Expenses & Budget Visualizer — app logic

// ── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  EXPENSES:   'ebv_expenses',
  BUDGETS:    'ebv_budgets',
  CATEGORIES: 'ebv_categories',
};

const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Entertainment', 'Health', 'Shopping', 'Other'];

// ── Storage ───────────────────────────────────────────────────────────────────

/**
 * Read and parse a JSON value from localStorage.
 * @param {string} key
 * @returns {*} Parsed value, or null if the key does not exist.
 * @throws {Error} If localStorage is unavailable or JSON parsing fails.
 */
function storageRead(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw);
  } catch (err) {
    throw new Error('Storage read failed for key "' + key + '": ' + err.message);
  }
}

/**
 * Serialize a value to JSON and write it to localStorage.
 * @param {string} key
 * @param {*} data
 * @throws {Error} If localStorage is unavailable or the write fails (e.g. quota exceeded).
 */
function storageWrite(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    throw new Error('Storage write failed for key "' + key + '": ' + err.message);
  }
}

/**
 * Check whether localStorage is available and functional.
 * @returns {boolean}
 */
function storageAvailable() {
  const testKey = '__ebv_test__';
  try {
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch (_) {
    return false;
  }
}

// ── State ─────────────────────────────────────────────────────────────────────

/**
 * Central application state — single source of truth.
 *
 * @type {{
 *   expenses:   import('./app').Expense[],
 *   budgets:    Object.<string, number>,
 *   categories: string[],
 *   ui: {
 *     selectedMonth:    string,
 *     editingExpenseId: string|null,
 *     filters: { category: string|null, month: string|null },
 *   }
 * }}
 */
let state = {
  expenses:   [],
  budgets:    {},
  categories: [],
  ui: {
    selectedMonth:    getCurrentMonth(),
    editingExpenseId: null,
    filters: { category: null, month: null },
  },
};

/**
 * Return a new state with the given expense appended.
 * @param {object} s  Current state.
 * @param {object} expense  Expense object (must already have id, insertOrder, etc.).
 * @returns {object} New state.
 */
function stateAddExpense(s, expense) {
  return Object.assign({}, s, { expenses: s.expenses.concat(expense) });
}

/**
 * Return a new state where the expense with the given id is replaced by
 * the result of merging it with `updates`.
 * @param {object} s
 * @param {string} id
 * @param {object} updates  Partial expense fields to overwrite.
 * @returns {object} New state.
 */
function stateUpdateExpense(s, id, updates) {
  return Object.assign({}, s, {
    expenses: s.expenses.map(function (e) {
      return e.id === id ? Object.assign({}, e, updates) : e;
    }),
  });
}

/**
 * Return a new state with the expense matching `id` removed.
 * @param {object} s
 * @param {string} id
 * @returns {object} New state.
 */
function stateRemoveExpense(s, id) {
  return Object.assign({}, s, {
    expenses: s.expenses.filter(function (e) { return e.id !== id; }),
  });
}

/**
 * Return a new state with the budget for the given category+month set to `amount`.
 * @param {object} s
 * @param {string} category
 * @param {string} month  'YYYY-MM'
 * @param {number} amount
 * @returns {object} New state.
 */
function stateSetBudget(s, category, month, amount) {
  var newBudgets = Object.assign({}, s.budgets);
  newBudgets[budgetKey(category, month)] = amount;
  return Object.assign({}, s, { budgets: newBudgets });
}

/**
 * Return a new state with `name` appended to the categories list.
 * @param {object} s
 * @param {string} name
 * @returns {object} New state.
 */
function stateAddCategory(s, name) {
  return Object.assign({}, s, { categories: s.categories.concat(name) });
}

/**
 * Return a new state with the category matching `name` removed (case-sensitive).
 * @param {object} s
 * @param {string} name
 * @returns {object} New state.
 */
function stateRemoveCategory(s, name) {
  return Object.assign({}, s, {
    categories: s.categories.filter(function (c) { return c !== name; }),
  });
}

/**
 * Return a new state with the specified filter updated.
 * @param {object} s
 * @param {'category'|'month'} filterType
 * @param {string|null} value
 * @returns {object} New state.
 */
function stateSetFilter(s, filterType, value) {
  var newFilters = Object.assign({}, s.ui.filters);
  newFilters[filterType] = value || null;
  return Object.assign({}, s, {
    ui: Object.assign({}, s.ui, { filters: newFilters }),
  });
}

/**
 * Return a new state with `ui.selectedMonth` set to `month`.
 * @param {object} s
 * @param {string} month  'YYYY-MM'
 * @returns {object} New state.
 */
function stateSetSelectedMonth(s, month) {
  return Object.assign({}, s, {
    ui: Object.assign({}, s.ui, { selectedMonth: month }),
  });
}

// ── Validators ────────────────────────────────────────────────────────────────

/**
 * Validate an expense form submission.
 *
 * Rules:
 *  - amount: required, must be a finite positive number
 *  - category: required, must be a non-empty string that exists in the
 *              current categories list (passed via state.categories at call site)
 *  - date: required, must be a non-empty string (ISO YYYY-MM-DD)
 *  - description: optional; if provided, max 200 characters
 *
 * @param {{ amount: *, category: *, date: *, description: * }} fields
 * @param {string[]} [existingCategories]  Defaults to state.categories.
 * @returns {{ valid: boolean, errors: Object.<string, string> }}
 */
function validateExpense(fields, existingCategories) {
  var categories = existingCategories !== undefined ? existingCategories : state.categories;
  var errors = {};

  // amount
  var amt = fields.amount;
  if (amt === undefined || amt === null || amt === '') {
    errors.amount = 'Amount is required.';
  } else {
    var numAmt = Number(amt);
    if (!isFinite(numAmt) || isNaN(numAmt)) {
      errors.amount = 'Amount must be a number.';
    } else if (numAmt <= 0) {
      errors.amount = 'Amount must be a positive number.';
    }
  }

  // category
  var cat = fields.category;
  if (!cat || String(cat).trim() === '') {
    errors.category = 'Category is required.';
  } else if (categories.indexOf(cat) === -1) {
    errors.category = 'Selected category does not exist.';
  }

  // date
  var dt = fields.date;
  if (!dt || String(dt).trim() === '') {
    errors.date = 'Date is required.';
  }

  // description (optional, max 200 chars)
  var desc = fields.description;
  if (desc && String(desc).length > 200) {
    errors.description = 'Description must not exceed 200 characters.';
  }

  return { valid: Object.keys(errors).length === 0, errors: errors };
}

/**
 * Validate a budget form submission.
 *
 * Rules:
 *  - amount: required, must be a finite positive number
 *  - category: required, non-empty
 *  - month: required, non-empty (YYYY-MM)
 *
 * @param {{ amount: *, category: *, month: * }} fields
 * @returns {{ valid: boolean, errors: Object.<string, string> }}
 */
function validateBudget(fields) {
  var errors = {};

  // amount
  var amt = fields.amount;
  if (amt === undefined || amt === null || amt === '') {
    errors.amount = 'Amount is required.';
  } else {
    var numAmt = Number(amt);
    if (!isFinite(numAmt) || isNaN(numAmt)) {
      errors.amount = 'Amount must be a number.';
    } else if (numAmt <= 0) {
      errors.amount = 'Amount must be a positive number.';
    }
  }

  // category
  var cat = fields.category;
  if (!cat || String(cat).trim() === '') {
    errors.category = 'Category is required.';
  }

  // month
  var month = fields.month;
  if (!month || String(month).trim() === '') {
    errors.month = 'Month is required.';
  }

  return { valid: Object.keys(errors).length === 0, errors: errors };
}

/**
 * Validate a new category name.
 *
 * Rules:
 *  - name: required, 1–50 characters (after trimming), must not be
 *          case-insensitively equal to any existing category name.
 *
 * @param {string} name
 * @param {string[]} existingCategories
 * @returns {{ valid: boolean, errors: Object.<string, string> }}
 */
function validateCategory(name, existingCategories) {
  var errors = {};
  var trimmed = name ? String(name).trim() : '';

  if (trimmed.length === 0) {
    errors.name = 'Category name is required.';
  } else if (trimmed.length > 50) {
    errors.name = 'Category name must not exceed 50 characters.';
  } else {
    var lower = trimmed.toLowerCase();
    var duplicate = existingCategories.some(function (c) {
      return c.toLowerCase() === lower;
    });
    if (duplicate) {
      errors.name = 'A category with this name already exists.';
    }
  }

  return { valid: Object.keys(errors).length === 0, errors: errors };
}

// ── Utils ─────────────────────────────────────────────────────────────────────

/**
 * Generate a UUID v4 string.
 * Falls back to a crypto.getRandomValues-based implementation when
 * crypto.randomUUID is unavailable (older browsers).
 * @returns {string}
 */
function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Polyfill using crypto.getRandomValues
  var bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Set version 4 bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  // Set variant bits
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  var hex = Array.from(bytes).map(function (b) {
    return b.toString(16).padStart(2, '0');
  });
  return (
    hex.slice(0, 4).join('') + '-' +
    hex.slice(4, 6).join('') + '-' +
    hex.slice(6, 8).join('') + '-' +
    hex.slice(8, 10).join('') + '-' +
    hex.slice(10, 16).join('')
  );
}

/**
 * Format a numeric amount as a locale-aware currency string.
 * Uses the browser's Intl.NumberFormat when available.
 * @param {number} amount
 * @returns {string}  e.g. "1,234.56"
 */
function formatCurrency(amount) {
  if (typeof Intl !== 'undefined' && Intl.NumberFormat) {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }
  return Number(amount).toFixed(2);
}

/**
 * Format an ISO date string ('YYYY-MM-DD') into a human-readable display string.
 * @param {string} dateStr  'YYYY-MM-DD'
 * @returns {string}  e.g. "Jan 15, 2025"
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  // Parse as local date to avoid UTC offset issues
  var parts = dateStr.split('-');
  var year  = parseInt(parts[0], 10);
  var month = parseInt(parts[1], 10) - 1;
  var day   = parseInt(parts[2], 10);
  var d = new Date(year, month, day);
  if (isNaN(d.getTime())) return dateStr;
  if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
    return new Intl.DateTimeFormat(undefined, {
      year:  'numeric',
      month: 'short',
      day:   'numeric',
    }).format(d);
  }
  return dateStr;
}

/**
 * Return the current local date as an ISO string 'YYYY-MM-DD'.
 * @returns {string}
 */
function getCurrentDate() {
  var d = new Date();
  var year  = d.getFullYear();
  var month = String(d.getMonth() + 1).padStart(2, '0');
  var day   = String(d.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

/**
 * Return the current local month as 'YYYY-MM'.
 * @returns {string}
 */
function getCurrentMonth() {
  var d = new Date();
  var year  = d.getFullYear();
  var month = String(d.getMonth() + 1).padStart(2, '0');
  return year + '-' + month;
}

/**
 * Convert an array of expense objects to a CSV string.
 *
 * Header row: date,category,amount,description
 * One data row per expense; absent description becomes an empty cell.
 * Values containing commas, double-quotes, or newlines are quoted per RFC 4180.
 *
 * @param {object[]} expenses
 * @returns {string}
 */
function expensesToCSV(expenses) {
  /**
   * Escape a single CSV cell value.
   * @param {*} val
   * @returns {string}
   */
  function csvCell(val) {
    var s = val === undefined || val === null ? '' : String(val);
    // Quote if the value contains a comma, double-quote, or newline
    if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1 || s.indexOf('\r') !== -1) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  var header = 'date,category,amount,description';
  var rows = expenses.map(function (e) {
    return [
      csvCell(e.date),
      csvCell(e.category),
      csvCell(e.amount),
      csvCell(e.description),
    ].join(',');
  });

  return [header].concat(rows).join('\n');
}

/**
 * Trigger a browser file download with the given content.
 * @param {string} filename
 * @param {string} content
 * @param {string} mimeType  e.g. 'text/csv'
 */
function downloadFile(filename, content, mimeType) {
  var blob = new Blob([content], { type: mimeType });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Build the storage key for a budget entry.
 * @param {string} category
 * @param {string} month  'YYYY-MM'
 * @returns {string}  e.g. 'Food::2025-01'
 */
function budgetKey(category, month) {
  return category + '::' + month;
}

// ── Actions ───────────────────────────────────────────────────────────────────

/**
 * Save an expense — handles both add (when state.ui.editingExpenseId is null)
 * and edit (when state.ui.editingExpenseId is set).
 *
 * Validates input first. On storage failure, shows an error toast and does NOT
 * update in-memory state.
 *
 * @param {{ amount: *, category: *, date: *, description: * }} formData
 */
function saveExpense(formData) {
  var validation = validateExpense(formData, state.categories);
  if (!validation.valid) {
    return;
  }

  var isEdit = state.ui.editingExpenseId !== null;
  var newState;

  if (isEdit) {
    var updates = {
      amount:      Number(formData.amount),
      category:    formData.category,
      date:        formData.date || getCurrentDate(),
      description: formData.description ? String(formData.description) : '',
    };
    newState = stateUpdateExpense(state, state.ui.editingExpenseId, updates);
  } else {
    var expense = {
      id:          generateId(),
      amount:      Number(formData.amount),
      category:    formData.category,
      date:        formData.date || getCurrentDate(),
      description: formData.description ? String(formData.description) : '',
      insertOrder: state.expenses.length,
    };
    newState = stateAddExpense(state, expense);
  }

  try {
    storageWrite(STORAGE_KEYS.EXPENSES, newState.expenses);
  } catch (err) {
    renderToast('Could not save expense: ' + err.message, 'error');
    return;
  }

  // Reset editingExpenseId after successful save
  newState = Object.assign({}, newState, {
    ui: Object.assign({}, newState.ui, { editingExpenseId: null }),
  });

  state = newState;
  render();
}

/**
 * Delete an expense by id after prompting the user for confirmation.
 * Cancellation leaves state unchanged.
 *
 * @param {string} id
 */
function deleteExpense(id) {
  if (!window.confirm('Are you sure you want to delete this expense?')) {
    return;
  }

  var newState = stateRemoveExpense(state, id);

  try {
    storageWrite(STORAGE_KEYS.EXPENSES, newState.expenses);
  } catch (err) {
    renderToast('Could not delete expense: ' + err.message, 'error');
    return;
  }

  state = newState;
  render();
}

/**
 * Save (set or overwrite) a budget for a category and the currently selected month.
 *
 * @param {{ amount: *, category: * }} formData
 */
function saveBudget(formData) {
  var month = state.ui.selectedMonth;
  var fields = {
    amount:   formData.amount,
    category: formData.category,
    month:    month,
  };

  var validation = validateBudget(fields);
  if (!validation.valid) {
    return;
  }

  var newState = stateSetBudget(state, formData.category, month, Number(formData.amount));

  try {
    storageWrite(STORAGE_KEYS.BUDGETS, newState.budgets);
  } catch (err) {
    renderToast('Could not save budget: ' + err.message, 'error');
    return;
  }

  state = newState;
  render();
}

/**
 * Add a new category.
 *
 * @param {string} name
 */
function saveCategory(name) {
  var validation = validateCategory(name, state.categories);
  if (!validation.valid) {
    return;
  }

  var trimmed = String(name).trim();
  var newState = stateAddCategory(state, trimmed);

  try {
    storageWrite(STORAGE_KEYS.CATEGORIES, newState.categories);
  } catch (err) {
    renderToast('Could not save category: ' + err.message, 'error');
    return;
  }

  state = newState;
  render();
}

/**
 * Delete a user-created category after prompting for confirmation.
 *
 * Guards:
 *  - Default categories cannot be deleted (silently ignored).
 *  - Categories referenced by any expense or budget cannot be deleted.
 *
 * @param {string} name
 */
function deleteCategory(name) {
  // Guard: default categories cannot be deleted
  if (DEFAULT_CATEGORIES.indexOf(name) !== -1) {
    return;
  }

  // Guard: category in use by expenses
  var usedByExpense = state.expenses.some(function (e) {
    return e.category === name;
  });
  if (usedByExpense) {
    renderToast('Cannot delete "' + name + '": it is used by one or more expenses.', 'warning');
    return;
  }

  // Guard: category in use by budgets
  var usedByBudget = Object.keys(state.budgets).some(function (key) {
    return key.indexOf(name + '::') === 0;
  });
  if (usedByBudget) {
    renderToast('Cannot delete "' + name + '": it has one or more budgets set.', 'warning');
    return;
  }

  if (!window.confirm('Are you sure you want to delete the category "' + name + '"?')) {
    return;
  }

  var newState = stateRemoveCategory(state, name);

  try {
    storageWrite(STORAGE_KEYS.CATEGORIES, newState.categories);
  } catch (err) {
    renderToast('Could not delete category: ' + err.message, 'error');
    return;
  }

  state = newState;
  render();
}

/**
 * Apply a filter to the expense list.
 *
 * @param {'category'|'month'} filterType
 * @param {string|null} value  Pass null or empty string to clear the filter.
 */
function applyFilter(filterType, value) {
  state = stateSetFilter(state, filterType, value || null);
  render();
}

/**
 * Navigate the selected month forward or backward by one month.
 *
 * @param {'prev'|'next'} direction
 */
function navigateMonth(direction) {
  var current = state.ui.selectedMonth; // 'YYYY-MM'
  var parts   = current.split('-');
  var year    = parseInt(parts[0], 10);
  var month   = parseInt(parts[1], 10); // 1-based

  if (direction === 'prev') {
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
  } else {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  var newMonth = year + '-' + String(month).padStart(2, '0');
  state = stateSetSelectedMonth(state, newMonth);
  render();
}

/**
 * Export all expenses (regardless of active filters) as a CSV file download.
 *
 * - Aborts with an error toast if the CSV lacks all four required columns.
 * - Shows an informational toast if there are no expenses.
 * - Filename: expenses-YYYY-MM-DD.csv
 */
function exportCSV() {
  if (state.expenses.length === 0) {
    renderToast('No expenses to export.', 'info');
    return;
  }

  var csv = expensesToCSV(state.expenses);

  // Validate that all four required columns are present in the header row
  var headerLine = csv.split('\n')[0] || '';
  var requiredColumns = ['date', 'category', 'amount', 'description'];
  var allPresent = requiredColumns.every(function (col) {
    return headerLine.indexOf(col) !== -1;
  });

  if (!allPresent) {
    renderToast('Export failed: CSV is missing one or more required columns.', 'error');
    return;
  }

  var filename = 'expenses-' + getCurrentDate() + '.csv';
  downloadFile(filename, csv, 'text/csv');
}

// ── UI Renderers ──────────────────────────────────────────────────────────────

/**
 * Render the month navigation: prev/next buttons and the selected month label.
 * Wires buttons to navigateMonth('prev') and navigateMonth('next').
 * Requirements: 6.3
 */
function renderMonthNav() {
  var label = document.getElementById('selected-month-label');
  var btnPrev = document.getElementById('btn-prev-month');
  var btnNext = document.getElementById('btn-next-month');

  if (!label || !btnPrev || !btnNext) return;

  // Format selected month as "MMMM YYYY"
  var parts = state.ui.selectedMonth.split('-');
  var year  = parseInt(parts[0], 10);
  var month = parseInt(parts[1], 10) - 1; // 0-based
  var d = new Date(year, month, 1);
  var formatted;
  if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
    formatted = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long' }).format(d);
  } else {
    formatted = state.ui.selectedMonth;
  }
  label.textContent = formatted;

  // Clone and replace to remove old listeners
  var newPrev = btnPrev.cloneNode(true);
  var newNext = btnNext.cloneNode(true);
  btnPrev.parentNode.replaceChild(newPrev, btnPrev);
  btnNext.parentNode.replaceChild(newNext, btnNext);

  newPrev.addEventListener('click', function () { navigateMonth('prev'); });
  newNext.addEventListener('click', function () { navigateMonth('next'); });
}

/**
 * Render the expense add/edit form.
 * Populates fields when state.ui.editingExpenseId is set.
 * Wires submit to saveExpense(formData).
 * Requirements: 1.1, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.4
 */
function renderExpenseForm() {
  var form        = document.getElementById('expense-form');
  var titleEl     = document.getElementById('expense-form-title');
  var amountInput = document.getElementById('expense-amount');
  var catSelect   = document.getElementById('expense-category');
  var dateInput   = document.getElementById('expense-date');
  var descInput   = document.getElementById('expense-description');
  var saveBtn     = document.getElementById('btn-save-expense');
  var cancelBtn   = document.getElementById('btn-cancel-edit');

  if (!form) return;

  // Populate category options
  var currentCatValue = catSelect.value;
  // Remove all options except the placeholder
  while (catSelect.options.length > 1) {
    catSelect.remove(1);
  }
  state.categories.forEach(function (cat) {
    var opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    catSelect.appendChild(opt);
  });

  var editingId = state.ui.editingExpenseId;
  var editingExpense = editingId
    ? state.expenses.find(function (e) { return e.id === editingId; })
    : null;

  if (editingExpense) {
    // Edit mode: populate fields
    if (titleEl) titleEl.textContent = 'Edit Expense';
    if (saveBtn) saveBtn.textContent = 'Save Changes';
    if (cancelBtn) cancelBtn.hidden = false;

    amountInput.value = editingExpense.amount;
    catSelect.value   = editingExpense.category;
    dateInput.value   = editingExpense.date;
    descInput.value   = editingExpense.description || '';
  } else {
    // Add mode: reset fields
    if (titleEl) titleEl.textContent = 'Add Expense';
    if (saveBtn) saveBtn.textContent = 'Add Expense';
    if (cancelBtn) cancelBtn.hidden = true;

    amountInput.value = '';
    catSelect.value   = '';
    dateInput.value   = getCurrentDate();
    descInput.value   = '';

    // Clear validation errors
    ['expense-amount-error', 'expense-category-error', 'expense-date-error', 'expense-description-error'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = '';
    });
  }

  // Replace form to remove old submit listener
  var newForm = form.cloneNode(true);
  form.parentNode.replaceChild(newForm, form);

  // Re-query elements after clone
  var newAmountInput = newForm.querySelector('#expense-amount');
  var newCatSelect   = newForm.querySelector('#expense-category');
  var newDateInput   = newForm.querySelector('#expense-date');
  var newDescInput   = newForm.querySelector('#expense-description');
  var newCancelBtn   = newForm.querySelector('#btn-cancel-edit');

  newForm.addEventListener('submit', function (e) {
    e.preventDefault();

    var formData = {
      amount:      newAmountInput.value,
      category:    newCatSelect.value,
      date:        newDateInput.value,
      description: newDescInput.value,
    };

    var validation = validateExpense(formData, state.categories);

    // Clear previous errors
    ['expense-amount-error', 'expense-category-error', 'expense-date-error', 'expense-description-error'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = '';
    });

    if (!validation.valid) {
      // Display inline errors
      if (validation.errors.amount) {
        var el = document.getElementById('expense-amount-error');
        if (el) el.textContent = validation.errors.amount;
      }
      if (validation.errors.category) {
        var el = document.getElementById('expense-category-error');
        if (el) el.textContent = validation.errors.category;
      }
      if (validation.errors.date) {
        var el = document.getElementById('expense-date-error');
        if (el) el.textContent = validation.errors.date;
      }
      if (validation.errors.description) {
        var el = document.getElementById('expense-description-error');
        if (el) el.textContent = validation.errors.description;
      }
      return;
    }

    saveExpense(formData);
  });

  if (newCancelBtn) {
    newCancelBtn.addEventListener('click', function () {
      state = Object.assign({}, state, {
        ui: Object.assign({}, state.ui, { editingExpenseId: null }),
      });
      render();
    });
  }
}

/**
 * Render the budget form: category selector and amount field.
 * Wires submit to saveBudget(formData).
 * Requirements: 4.1, 4.2, 4.3
 */
function renderBudgetForm() {
  var form      = document.getElementById('budget-form');
  var catSelect = document.getElementById('budget-category');

  if (!form || !catSelect) return;

  // Populate category options
  while (catSelect.options.length > 1) {
    catSelect.remove(1);
  }
  state.categories.forEach(function (cat) {
    var opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    catSelect.appendChild(opt);
  });

  // Replace form to remove old submit listener
  var newForm = form.cloneNode(true);
  form.parentNode.replaceChild(newForm, form);

  var newCatSelect   = newForm.querySelector('#budget-category');
  var newAmountInput = newForm.querySelector('#budget-amount');

  newForm.addEventListener('submit', function (e) {
    e.preventDefault();

    var formData = {
      category: newCatSelect.value,
      amount:   newAmountInput.value,
    };

    var validation = validateBudget({
      amount:   formData.amount,
      category: formData.category,
      month:    state.ui.selectedMonth,
    });

    // Clear previous errors
    ['budget-category-error', 'budget-amount-error'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = '';
    });

    if (!validation.valid) {
      if (validation.errors.category) {
        var el = document.getElementById('budget-category-error');
        if (el) el.textContent = validation.errors.category;
      }
      if (validation.errors.amount) {
        var el = document.getElementById('budget-amount-error');
        if (el) el.textContent = validation.errors.amount;
      }
      return;
    }

    saveBudget(formData);
  });
}

/**
 * Render the filter controls: category dropdown and month input.
 * Wires changes to applyFilter().
 * Requirements: 5.2, 5.3, 5.4
 */
function renderFilters() {
  var catFilter   = document.getElementById('filter-category');
  var monthFilter = document.getElementById('filter-month');
  var clearBtn    = document.getElementById('btn-clear-filters');

  if (!catFilter || !monthFilter) return;

  // Populate category options
  while (catFilter.options.length > 1) {
    catFilter.remove(1);
  }
  state.categories.forEach(function (cat) {
    var opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    catFilter.appendChild(opt);
  });

  // Restore current filter values
  catFilter.value   = state.ui.filters.category || '';
  monthFilter.value = state.ui.filters.month    || '';

  // Clone to remove old listeners
  var newCatFilter   = catFilter.cloneNode(true);
  var newMonthFilter = monthFilter.cloneNode(true);
  catFilter.parentNode.replaceChild(newCatFilter, catFilter);
  monthFilter.parentNode.replaceChild(newMonthFilter, monthFilter);

  newCatFilter.addEventListener('change', function () {
    applyFilter('category', newCatFilter.value || null);
  });
  newMonthFilter.addEventListener('change', function () {
    applyFilter('month', newMonthFilter.value || null);
  });

  if (clearBtn) {
    var newClearBtn = clearBtn.cloneNode(true);
    clearBtn.parentNode.replaceChild(newClearBtn, clearBtn);
    newClearBtn.addEventListener('click', function () {
      applyFilter('category', null);
      applyFilter('month', null);
    });
  }
}

/**
 * Compute the filtered and sorted expense list from state.
 * Sorted by date descending, then insertOrder descending for ties.
 * @returns {object[]}
 */
function getFilteredExpenses() {
  var expenses = state.expenses.slice();

  // Apply category filter
  if (state.ui.filters.category) {
    expenses = expenses.filter(function (e) {
      return e.category === state.ui.filters.category;
    });
  }

  // Apply month filter
  if (state.ui.filters.month) {
    expenses = expenses.filter(function (e) {
      return e.date.indexOf(state.ui.filters.month) === 0;
    });
  }

  // Sort: date descending, then insertOrder descending
  expenses.sort(function (a, b) {
    if (a.date > b.date) return -1;
    if (a.date < b.date) return 1;
    return (b.insertOrder || 0) - (a.insertOrder || 0);
  });

  return expenses;
}

/**
 * Render the expense list table.
 * Requirements: 2.1, 2.5, 2.6, 2.7, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */
function renderExpenseList() {
  var tbody    = document.getElementById('expense-table-body');
  var emptyMsg = document.getElementById('expense-list-empty');
  var table    = document.getElementById('expense-table');

  if (!tbody) return;

  var filtered = getFilteredExpenses();

  if (filtered.length === 0) {
    if (emptyMsg) emptyMsg.hidden = false;
    if (table)    table.hidden    = true;
    return;
  }

  if (emptyMsg) emptyMsg.hidden = true;
  if (table)    table.hidden    = false;

  tbody.innerHTML = '';

  filtered.forEach(function (expense) {
    var tr = document.createElement('tr');

    // Date cell
    var tdDate = document.createElement('td');
    tdDate.textContent = formatDate(expense.date);
    tr.appendChild(tdDate);

    // Category cell
    var tdCat = document.createElement('td');
    tdCat.textContent = expense.category;
    tr.appendChild(tdCat);

    // Amount cell
    var tdAmt = document.createElement('td');
    tdAmt.textContent = formatCurrency(expense.amount);
    tr.appendChild(tdAmt);

    // Description cell
    var tdDesc = document.createElement('td');
    tdDesc.textContent = expense.description || '';
    tr.appendChild(tdDesc);

    // Actions cell
    var tdActions = document.createElement('td');

    var editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-ghost btn-sm';
    editBtn.textContent = 'Edit';
    editBtn.setAttribute('aria-label', 'Edit expense from ' + expense.date);
    editBtn.addEventListener('click', (function (id) {
      return function () {
        state = Object.assign({}, state, {
          ui: Object.assign({}, state.ui, { editingExpenseId: id }),
        });
        render();
        // Scroll to form
        var formSection = document.querySelector('.expense-form-section');
        if (formSection) formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
    })(expense.id));

    var deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-danger btn-sm';
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('aria-label', 'Delete expense from ' + expense.date);
    deleteBtn.addEventListener('click', (function (id) {
      return function () { deleteExpense(id); };
    })(expense.id));

    tdActions.appendChild(editBtn);
    tdActions.appendChild(deleteBtn);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });
}

/**
 * Compute the total amount spent for the selected month.
 * Pure helper — used by renderSummaryPanel and property tests.
 * @param {object[]} expenses
 * @param {string} selectedMonth  'YYYY-MM'
 * @returns {number}
 */
function computeMonthTotal(expenses, selectedMonth) {
  return expenses
    .filter(function (e) { return e.date.indexOf(selectedMonth) === 0; })
    .reduce(function (sum, e) { return sum + Number(e.amount); }, 0);
}

/**
 * Compute per-category spending for the selected month.
 * Pure helper — used by renderSummaryPanel and property tests.
 * @param {object[]} expenses
 * @param {string} selectedMonth  'YYYY-MM'
 * @returns {Object.<string, number>}  { category: totalSpent }
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
 * Determine whether the overspend indicator should be applied for a category.
 * Pure helper — used by renderSummaryPanel and property tests.
 * @param {number} spent
 * @param {number|undefined} budgetLimit
 * @returns {boolean}
 */
function isOverspent(spent, budgetLimit) {
  if (budgetLimit === undefined || budgetLimit === null || budgetLimit <= 0) return false;
  return spent >= budgetLimit;
}

/**
 * Render the summary panel: total spent + per-category breakdown.
 * Requirements: 4.4, 4.5, 6.1, 6.2
 */
function renderSummaryPanel() {
  var totalEl      = document.getElementById('summary-total-amount');
  var categoriesEl = document.getElementById('summary-categories');

  if (!totalEl || !categoriesEl) return;

  var selectedMonth = state.ui.selectedMonth;
  var total = computeMonthTotal(state.expenses, selectedMonth);
  totalEl.textContent = formatCurrency(total);

  var categorySpending = computeCategorySpending(state.expenses, selectedMonth);

  categoriesEl.innerHTML = '';

  // Collect all categories that have a budget OR have expenses for this month
  var relevantCategories = new Set();

  // Categories with a budget for this month
  Object.keys(state.budgets).forEach(function (key) {
    var parts = key.split('::');
    if (parts[1] === selectedMonth && state.budgets[key] > 0) {
      relevantCategories.add(parts[0]);
    }
  });

  // Categories with expenses for this month
  Object.keys(categorySpending).forEach(function (cat) {
    relevantCategories.add(cat);
  });

  relevantCategories.forEach(function (cat) {
    var spent  = categorySpending[cat] || 0;
    var budget = state.budgets[budgetKey(cat, selectedMonth)];
    var hasBudget = budget !== undefined && budget > 0;
    var exceeded  = isOverspent(spent, budget);

    var row = document.createElement('div');
    row.className = 'summary-category-row' + (exceeded ? ' summary-category-row--exceeded' : '');
    row.setAttribute('role', 'listitem');

    var nameEl = document.createElement('span');
    nameEl.className = 'summary-category-name';
    nameEl.textContent = cat;
    row.appendChild(nameEl);

    var spentEl = document.createElement('span');
    spentEl.className = 'summary-category-spent';
    spentEl.textContent = formatCurrency(spent);
    row.appendChild(spentEl);

    if (hasBudget) {
      var diff = budget - spent;
      var pct  = (spent / budget) * 100;

      var budgetEl = document.createElement('span');
      budgetEl.className = 'summary-category-budget';
      budgetEl.textContent = 'Budget: ' + formatCurrency(budget) + ' | Diff: ' + formatCurrency(diff);
      row.appendChild(budgetEl);

      var pctEl = document.createElement('span');
      pctEl.className = 'summary-category-pct';
      pctEl.textContent = pct.toFixed(1) + '%';
      row.appendChild(pctEl);
    }

    categoriesEl.appendChild(row);
  });
}

// ── Chart helpers ─────────────────────────────────────────────────────────────

var CHART_COLORS = [
  '#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed',
  '#0891b2', '#db2777', '#65a30d', '#ea580c', '#6366f1',
];

/**
 * Draw a pie chart on the given canvas context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 * @param {{ label: string, value: number }[]} slices
 */
function drawPieChart(ctx, width, height, slices) {
  var total = slices.reduce(function (s, sl) { return s + sl.value; }, 0);
  if (total === 0) return;

  var cx = width / 2;
  var cy = height / 2;
  var radius = Math.min(cx, cy) - 20;
  var startAngle = -Math.PI / 2;

  ctx.clearRect(0, 0, width, height);

  slices.forEach(function (sl, i) {
    var sliceAngle = (sl.value / total) * 2 * Math.PI;
    var endAngle   = startAngle + sliceAngle;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label at midpoint of arc
    var midAngle = startAngle + sliceAngle / 2;
    var labelR   = radius * 0.65;
    var lx = cx + labelR * Math.cos(midAngle);
    var ly = cy + labelR * Math.sin(midAngle);

    var pct = ((sl.value / total) * 100).toFixed(0) + '%';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (sliceAngle > 0.2) {
      ctx.fillText(pct, lx, ly);
    }

    startAngle = endAngle;
  });

  // Legend
  var legendX = 10;
  var legendY = height - (slices.length * 18) - 10;
  if (legendY < 10) legendY = 10;

  slices.forEach(function (sl, i) {
    ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
    ctx.fillRect(legendX, legendY + i * 18, 12, 12);
    ctx.fillStyle = '#1e293b';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    var label = sl.label.length > 12 ? sl.label.slice(0, 12) + '…' : sl.label;
    ctx.fillText(label, legendX + 16, legendY + i * 18);
  });
}

/**
 * Draw a bar chart on the given canvas context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 * @param {{ label: string, spent: number, budget: number }[]} bars
 */
function drawBarChart(ctx, width, height, bars) {
  if (bars.length === 0) return;

  ctx.clearRect(0, 0, width, height);

  var paddingLeft   = 50;
  var paddingRight  = 20;
  var paddingTop    = 20;
  var paddingBottom = 60;

  var chartWidth  = width  - paddingLeft - paddingRight;
  var chartHeight = height - paddingTop  - paddingBottom;

  var maxVal = bars.reduce(function (m, b) {
    return Math.max(m, b.spent, b.budget);
  }, 0);
  if (maxVal === 0) maxVal = 1;

  var barGroupWidth = chartWidth / bars.length;
  var barWidth      = Math.max(8, barGroupWidth * 0.35);

  // Y-axis
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth   = 1;
  var ySteps = 5;
  for (var i = 0; i <= ySteps; i++) {
    var yVal = (maxVal / ySteps) * i;
    var yPos = paddingTop + chartHeight - (yVal / maxVal) * chartHeight;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, yPos);
    ctx.lineTo(paddingLeft + chartWidth, yPos);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(yVal.toFixed(0), paddingLeft - 5, yPos);
  }

  bars.forEach(function (bar, i) {
    var groupX = paddingLeft + i * barGroupWidth + barGroupWidth / 2;

    // Spent bar
    var spentH = (bar.spent / maxVal) * chartHeight;
    var spentX = groupX - barWidth - 2;
    var spentY = paddingTop + chartHeight - spentH;
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(spentX, spentY, barWidth, spentH);

    // Budget bar
    var budgetH = (bar.budget / maxVal) * chartHeight;
    var budgetX = groupX + 2;
    var budgetY = paddingTop + chartHeight - budgetH;
    ctx.fillStyle = '#e2e8f0';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.fillRect(budgetX, budgetY, barWidth, budgetH);
    ctx.strokeRect(budgetX, budgetY, barWidth, budgetH);

    // Label
    var label = bar.label.length > 8 ? bar.label.slice(0, 8) + '…' : bar.label;
    ctx.fillStyle = '#1e293b';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, groupX, paddingTop + chartHeight + 5);
  });

  // Legend
  var legendY = height - 20;
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(paddingLeft, legendY, 10, 10);
  ctx.fillStyle = '#1e293b';
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Spent', paddingLeft + 14, legendY);

  ctx.fillStyle = '#e2e8f0';
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.fillRect(paddingLeft + 70, legendY, 10, 10);
  ctx.strokeRect(paddingLeft + 70, legendY, 10, 10);
  ctx.fillStyle = '#1e293b';
  ctx.fillText('Budget', paddingLeft + 84, legendY);
}

/**
 * Determine chart visibility based on state.
 * Pure helper — used by renderCharts and property tests.
 * @param {object[]} expenses
 * @param {object} budgets
 * @param {string} selectedMonth
 * @returns {{ showPie: boolean, showBar: boolean }}
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

/**
 * Render pie and bar charts using the HTML Canvas API.
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */
function renderCharts() {
  var pieWrapper  = document.getElementById('pie-chart-wrapper');
  var barWrapper  = document.getElementById('bar-chart-wrapper');
  var noDataMsg   = document.getElementById('charts-no-data');
  var pieCanvas   = document.getElementById('pie-chart');
  var barCanvas   = document.getElementById('bar-chart');

  if (!pieWrapper || !barWrapper || !noDataMsg) return;

  var selectedMonth = state.ui.selectedMonth;
  var visibility    = computeChartVisibility(state.expenses, state.budgets, selectedMonth);

  // Check Canvas API availability
  var canvasAvailable = pieCanvas && typeof pieCanvas.getContext === 'function';

  if (!canvasAvailable) {
    // Canvas unavailable: hide chart containers, show text fallback
    pieWrapper.hidden = true;
    barWrapper.hidden = true;
    noDataMsg.hidden  = false;
    noDataMsg.textContent = 'Charts are not available in this browser.';
    return;
  }

  if (!visibility.showPie && !visibility.showBar) {
    pieWrapper.hidden = true;
    barWrapper.hidden = true;
    noDataMsg.hidden  = false;
    noDataMsg.textContent = 'No expenses recorded for this month.';
    return;
  }

  noDataMsg.hidden = true;

  // Pie chart
  if (visibility.showPie) {
    pieWrapper.hidden = false;
    var categorySpending = computeCategorySpending(state.expenses, selectedMonth);
    var pieSlices = Object.keys(categorySpending).map(function (cat) {
      return { label: cat, value: categorySpending[cat] };
    });

    var pieCtx = pieCanvas.getContext('2d');
    drawPieChart(pieCtx, pieCanvas.width, pieCanvas.height, pieSlices);

    // Update aria-label
    var pieTotal = pieSlices.reduce(function (s, sl) { return s + sl.value; }, 0);
    pieCanvas.setAttribute('aria-label',
      'Pie chart: spending by category for ' + selectedMonth + '. Total: ' + formatCurrency(pieTotal));
  } else {
    pieWrapper.hidden = true;
  }

  // Bar chart
  if (visibility.showBar) {
    barWrapper.hidden = false;
    var categorySpending2 = computeCategorySpending(state.expenses, selectedMonth);

    var bars = [];
    Object.keys(state.budgets).forEach(function (key) {
      var parts = key.split('::');
      if (parts[1] === selectedMonth && state.budgets[key] > 0) {
        var cat    = parts[0];
        var budget = state.budgets[key];
        var spent  = categorySpending2[cat] || 0;
        bars.push({ label: cat, spent: spent, budget: budget });
      }
    });

    var barCtx = barCanvas.getContext('2d');
    drawBarChart(barCtx, barCanvas.width, barCanvas.height, bars);

    barCanvas.setAttribute('aria-label',
      'Bar chart: spending vs budget per category for ' + selectedMonth);
  } else {
    barWrapper.hidden = true;
  }
}

/**
 * Render the category manager: list with add input and delete buttons.
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 */
function renderCategoryManager() {
  var list    = document.getElementById('category-list');
  var form    = document.getElementById('category-form');
  var nameInput = document.getElementById('new-category-name');
  var errorEl   = document.getElementById('new-category-error');

  if (!list) return;

  list.innerHTML = '';

  state.categories.forEach(function (cat) {
    var isDefault = DEFAULT_CATEGORIES.indexOf(cat) !== -1;

    var usedByExpense = state.expenses.some(function (e) { return e.category === cat; });
    var usedByBudget  = Object.keys(state.budgets).some(function (key) {
      return key.indexOf(cat + '::') === 0;
    });
    var inUse = usedByExpense || usedByBudget;

    var li = document.createElement('li');
    li.className = 'category-list-item';
    li.setAttribute('role', 'listitem');

    var nameEl = document.createElement('span');
    nameEl.className = 'category-list-item-name';
    nameEl.textContent = cat;
    li.appendChild(nameEl);

    var deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-danger btn-sm';
    deleteBtn.textContent = 'Delete';

    if (isDefault) {
      deleteBtn.disabled = true;
      deleteBtn.title    = 'Default categories cannot be deleted.';
      deleteBtn.setAttribute('aria-disabled', 'true');
    } else if (inUse) {
      deleteBtn.disabled = true;
      deleteBtn.title    = 'This category has associated expenses or budgets and cannot be deleted.';
      deleteBtn.setAttribute('aria-disabled', 'true');
    } else {
      deleteBtn.addEventListener('click', (function (name) {
        return function () { deleteCategory(name); };
      })(cat));
    }

    li.appendChild(deleteBtn);
    list.appendChild(li);
  });

  // Wire the add-category form
  if (form) {
    var newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    var newNameInput = newForm.querySelector('#new-category-name');
    var newErrorEl   = newForm.querySelector('#new-category-error');

    newForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = newNameInput ? newNameInput.value : '';

      var validation = validateCategory(name, state.categories);
      if (newErrorEl) newErrorEl.textContent = '';

      if (!validation.valid) {
        if (newErrorEl) newErrorEl.textContent = validation.errors.name || 'Invalid category name.';
        return;
      }

      saveCategory(name);
    });
  }
}

/**
 * Render a non-blocking toast notification banner.
 * Auto-dismisses after 4 seconds.
 * @param {string} message
 * @param {'error'|'warning'|'info'} type
 * Requirements: 8.3, 8.4
 */
function renderToast(message, type) {
  var container = document.getElementById('toast-container');
  if (!container) return;

  var toast = document.createElement('div');
  toast.className = 'toast toast--' + (type || 'info');
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  var msgEl = document.createElement('span');
  msgEl.textContent = message;
  toast.appendChild(msgEl);

  // Close button
  var closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn btn-ghost btn-sm';
  closeBtn.setAttribute('aria-label', 'Dismiss notification');
  closeBtn.textContent = '×';
  closeBtn.style.marginLeft = 'auto';
  closeBtn.style.padding = '0 4px';
  closeBtn.style.minHeight = 'unset';
  closeBtn.style.minWidth  = 'unset';
  closeBtn.addEventListener('click', function () {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  });
  toast.appendChild(closeBtn);

  container.appendChild(toast);

  // Auto-dismiss after 4 seconds
  setTimeout(function () {
    if (toast.parentNode) {
      toast.style.transition = 'opacity 0.3s ease';
      toast.style.opacity    = '0';
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }
  }, 4000);
}

// ── Render & Init ─────────────────────────────────────────────────────────────

/**
 * Master re-render dispatcher.
 * Calls all renderer functions in order so the entire UI reflects the current state.
 * Requirements: 6.3, 6.4, 6.5
 */
function render() {
  renderMonthNav();
  renderExpenseForm();
  renderBudgetForm();
  renderFilters();
  renderExpenseList();
  renderSummaryPanel();
  renderCharts();
  renderCategoryManager();
}

/**
 * Application bootstrap — called once on DOMContentLoaded.
 *
 * 1. Check localStorage availability.
 *    - If unavailable: show a non-blocking warning toast and operate with
 *      empty in-memory state (Requirements 8.3).
 *    - If available: load persisted expenses, budgets, and categories
 *      (Requirements 8.2).
 * 2. Seed DEFAULT_CATEGORIES if no categories are stored (Requirements 3.1).
 * 3. Set state.ui.selectedMonth to the current month (Requirements 6.3).
 * 4. Call render() to paint the initial UI.
 */
function init() {
  if (!storageAvailable()) {
    // Storage unavailable — operate with empty in-memory state
    state = {
      expenses:   [],
      budgets:    {},
      categories: DEFAULT_CATEGORIES.slice(),
      ui: {
        selectedMonth:    getCurrentMonth(),
        editingExpenseId: null,
        filters: { category: null, month: null },
      },
    };
    // Wire the Export CSV button (Req 9.1, 9.3)
    var exportBtnNoStorage = document.getElementById('btn-export-csv');
    if (exportBtnNoStorage) {
      exportBtnNoStorage.addEventListener('click', exportCSV);
    }

    render();
    // Show warning after render so the toast container exists in the DOM
    renderToast(
      'Local storage is unavailable. Your data will not be saved between sessions.',
      'warning'
    );
    return;
  }

  // Load persisted data from storage
  var expenses, budgets, categories;

  try {
    expenses = storageRead(STORAGE_KEYS.EXPENSES);
  } catch (err) {
    expenses = null;
  }

  try {
    budgets = storageRead(STORAGE_KEYS.BUDGETS);
  } catch (err) {
    budgets = null;
  }

  try {
    categories = storageRead(STORAGE_KEYS.CATEGORIES);
  } catch (err) {
    categories = null;
  }

  // Seed defaults when no categories are stored yet (first load)
  if (!Array.isArray(categories) || categories.length === 0) {
    categories = DEFAULT_CATEGORIES.slice();
    try {
      storageWrite(STORAGE_KEYS.CATEGORIES, categories);
    } catch (_) {
      // Non-critical — continue with in-memory defaults
    }
  }

  state = {
    expenses:   Array.isArray(expenses) ? expenses : [],
    budgets:    (budgets && typeof budgets === 'object' && !Array.isArray(budgets)) ? budgets : {},
    categories: categories,
    ui: {
      selectedMonth:    getCurrentMonth(),
      editingExpenseId: null,
      filters: { category: null, month: null },
    },
  };

  // Wire the Export CSV button (Req 9.1, 9.3)
  var exportBtn = document.getElementById('btn-export-csv');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportCSV);
  }

  render();
}

document.addEventListener('DOMContentLoaded', init);
