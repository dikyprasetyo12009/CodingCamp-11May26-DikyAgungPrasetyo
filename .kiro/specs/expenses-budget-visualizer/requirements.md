# Requirements Document

## Introduction

The Expenses & Budget Visualizer is a client-side web application that allows users to track their personal expenses, set budget limits per category, and visualize spending patterns through charts and summaries. The app runs entirely in the browser using HTML, CSS, and Vanilla JavaScript, with all data persisted in the browser's Local Storage. It requires no backend server, no account registration, and no complex setup — making it immediately usable as a standalone web page or browser extension.

## Glossary

- **App**: The Expenses & Budget Visualizer web application.
- **Expense**: A single spending record consisting of an amount, category, date, and optional description.
- **Budget**: A user-defined monthly spending limit assigned to a specific category.
- **Category**: A label used to group expenses (e.g., Food, Transport, Entertainment).
- **Dashboard**: The main view of the App that displays a summary of expenses and budget status.
- **Chart**: A visual representation (bar chart or pie chart) of expense data rendered on an HTML canvas element.
- **Storage**: The browser's Local Storage API used to persist all application data client-side.
- **Expense_Form**: The UI component used to add or edit an expense entry.
- **Budget_Form**: The UI component used to set or update a budget limit for a category.
- **Expense_List**: The UI component that displays all recorded expenses in a tabular or list format.
- **Filter**: A UI control that narrows the displayed expenses by category, date range, or month.
- **Summary_Panel**: The UI component that shows total spending, remaining budget, and per-category breakdowns.

---

## Requirements

### Requirement 1: Add an Expense

**User Story:** As a user, I want to add a new expense with an amount, category, date, and description, so that I can keep a record of my spending.

#### Acceptance Criteria

1. THE Expense_Form SHALL include input fields for amount (numeric, positive values only), category (selectable from available categories), date (defaulting to the current date), and description (optional free text, maximum 200 characters).
2. WHEN the user submits the Expense_Form with a valid amount (a positive number), a selected category, and a valid date, THE App SHALL save the expense to Storage and display it in the Expense_List without requiring a page reload.
3. IF the user submits the Expense_Form with a missing amount, a non-numeric amount, or an amount that is zero or negative, THEN THE Expense_Form SHALL display an inline validation error adjacent to the amount field and SHALL NOT save the expense.
4. IF the user submits the Expense_Form with no category selected, THEN THE Expense_Form SHALL display an inline validation error adjacent to the category field and SHALL NOT save the expense.
5. IF the user submits the Expense_Form with no date provided, THEN THE Expense_Form SHALL use the current local date as the expense date before saving.
6. WHEN an expense is saved successfully, THE Expense_Form SHALL clear the amount field, reset the category selector to its default unselected state, reset the date field to the current date, and clear the description field.

---

### Requirement 2: Edit and Delete an Expense

**User Story:** As a user, I want to edit or delete an existing expense, so that I can correct mistakes or remove outdated records.

#### Acceptance Criteria

1. WHEN the user selects an expense from the Expense_List for editing, THE Expense_Form SHALL populate all fields (amount, category, date, description) with the selected expense's current values.
2. WHEN the user submits the Expense_Form while editing an existing expense, IF any required field (amount or category) is invalid, THEN THE Expense_Form SHALL display inline validation errors for all invalid fields and SHALL NOT save any changes to Storage.
3. WHEN the user submits the Expense_Form while editing an existing expense with all required fields valid, THE App SHALL overwrite the existing expense record in Storage with the updated values and refresh the Expense_List without requiring a page reload.
4. WHEN the user saves an edited expense successfully, THE Expense_Form SHALL return to its default add-expense state with all fields reset.
5. IF the user attempts to delete an expense, THEN THE App SHALL display a confirmation prompt asking the user to confirm the deletion before taking any action.
6. WHEN the user confirms the deletion prompt, THE App SHALL remove the expense from Storage and remove it from the Expense_List without requiring a page reload.
7. WHEN the user cancels the deletion prompt, THE App SHALL take no action and leave the expense record unchanged in Storage and the Expense_List.

---

### Requirement 3: Manage Categories

**User Story:** As a user, I want to create and manage expense categories, so that I can organize my spending in a way that fits my lifestyle.

#### Acceptance Criteria

1. THE App SHALL provide a default set of categories on first load: Food, Transport, Entertainment, Health, Shopping, and Other.
2. WHEN the user creates a new category with a name that is unique (case-insensitive) and between 1 and 50 characters in length, THE App SHALL save the category to Storage, make it immediately available in the Expense_Form and Budget_Form category selectors, and reset the category creation input field.
3. IF the user attempts to create a category with a name that already exists (case-insensitive comparison against all existing category names), THEN THE App SHALL display an inline error message and SHALL NOT create a duplicate category.
4. IF the user attempts to create a category with an empty name or a name exceeding 50 characters, THEN THE App SHALL display an inline validation error and SHALL NOT save the category.
5. WHEN the user deletes a user-created category that has no associated expenses or budgets, THE App SHALL remove the category from Storage and remove it from all category selectors without requiring a page reload.
6. IF the user attempts to delete a user-created category that has one or more associated expenses or budgets, THEN THE App SHALL display a warning message identifying the conflict and SHALL NOT delete the category.
7. THE App SHALL NOT allow deletion of any default category (Food, Transport, Entertainment, Health, Shopping, Other); the delete action SHALL be unavailable or disabled for default categories.

---

### Requirement 4: Set and Update Budgets

**User Story:** As a user, I want to set a monthly budget limit for each category, so that I can control my spending and stay within my financial goals.

#### Acceptance Criteria

1. WHEN the user submits the Budget_Form with a valid positive numeric amount for a selected category, THE App SHALL save the budget limit to Storage keyed by that category and the selected month, and update the Summary_Panel to reflect the new budget.
2. IF the user submits the Budget_Form with a missing amount, a non-numeric amount, or an amount that is zero or negative, THEN THE Budget_Form SHALL display an inline validation error adjacent to the amount field and SHALL NOT save the budget.
3. WHEN the user submits the Budget_Form for a category and month that already has a budget, THE App SHALL overwrite the existing budget value in Storage for that same category and month with the new value.
4. THE Summary_Panel SHALL display the budget limit, total amount spent, and the difference (budget limit minus total spent, which may be negative) only for categories that have a valid positive budget amount set for the selected month.
5. WHEN total spending in a category for the selected month reaches or exceeds the budget limit for that category and month, THE App SHALL apply a distinct visual indicator (such as a red background or warning icon) to that category's row in the Summary_Panel to indicate the budget has been reached or exceeded.

---

### Requirement 5: View Expense List with Filtering

**User Story:** As a user, I want to view and filter my expense history, so that I can review my spending for a specific period or category.

#### Acceptance Criteria

1. THE Expense_List SHALL display all recorded expenses sorted by date in descending order by default; when two expenses share the same date, they SHALL be ordered by insertion order (most recently added first). When no filters are active, all recorded expenses SHALL be displayed.
2. WHEN the user applies a Filter by category, THE Expense_List SHALL display only expenses that match the selected category and SHALL exclude all expenses that do not match.
3. WHEN the user applies a Filter by month, THE Expense_List SHALL display only expenses whose date falls within the selected month and year; when no month filter is active, expenses from all months SHALL be displayed.
4. WHEN the user applies multiple filters simultaneously, THE Expense_List SHALL display only expenses that satisfy all active filter conditions.
5. WHEN no expenses match the active filters, THE Expense_List SHALL display a message indicating no results were found.
6. THE Expense_List SHALL display each expense's amount, category, date, and description; when a description is absent, the description field SHALL be displayed as empty.

---

### Requirement 6: Dashboard Summary

**User Story:** As a user, I want to see a summary of my total spending and budget status at a glance, so that I can quickly understand my financial situation for the current month.

#### Acceptance Criteria

1. THE Dashboard SHALL display the total amount spent across all categories for the selected month; when no expenses exist for the selected month, THE Dashboard SHALL display a total of 0.00.
2. THE Summary_Panel SHALL display a per-category breakdown for the selected month: for each category that has a budget set, it SHALL show the amount spent and the percentage of the budget used; for each category that has expenses but no budget set, it SHALL show the amount spent without a percentage value.
3. WHEN the user navigates to a different month, THE Dashboard SHALL update the Summary_Panel and Chart to reflect data for the newly selected month within 1 second.
4. WHEN an expense is added, edited, or deleted, THE Dashboard SHALL update all displayed totals, summaries, and charts to reflect the change within 1 second without requiring a page reload.
5. WHEN a budget is added or changed, THE Dashboard SHALL update all displayed totals, summaries, and charts to reflect the change within 1 second without requiring a page reload.

---

### Requirement 7: Visualize Spending with Charts

**User Story:** As a user, I want to see visual charts of my spending, so that I can quickly identify patterns and categories where I spend the most.

#### Acceptance Criteria

1. WHEN the selected month has at least one expense, THE Dashboard SHALL display a pie chart showing the proportion of total spending per category for the selected month.
2. WHEN the selected month has at least one expense and at least one category with a valid positive budget set for the selected month, THE Dashboard SHALL display a bar chart showing the spending amount versus the budget limit for each such category; when no category has a budget set for the selected month, the bar chart SHALL be hidden.
3. WHEN there are no expenses for the selected month, THE Dashboard SHALL hide all charts and display a message indicating that no expenses have been recorded for the selected month.
4. WHEN expense or budget data changes, THE Chart SHALL re-render to reflect the updated data without requiring a page reload.
5. THE Chart SHALL render using the HTML Canvas API without relying on external charting libraries.
6. EACH canvas element used for a chart SHALL include a descriptive accessible fallback text (via the element's text content or aria-label) that summarizes the chart's purpose for users who cannot view the canvas.

---

### Requirement 8: Data Persistence

**User Story:** As a user, I want my expense and budget data to be saved automatically, so that my records are available the next time I open the app.

#### Acceptance Criteria

1. WHEN the user creates, updates, or deletes an expense, budget, or category, THE App SHALL write the updated expenses, budgets, and categories data to Storage before the operation is considered complete.
2. WHEN the App is loaded, THE App SHALL read all expense, budget, and category data from Storage and restore the previous application state before rendering any interactive UI.
3. IF Storage is unavailable or returns a read error on load, THEN THE App SHALL display a non-blocking warning message (one that does not prevent the user from interacting with the App) and operate with an empty in-memory state.
4. IF a write to Storage fails during a create, update, or delete operation, THEN THE App SHALL display a non-blocking error message informing the user that the change could not be saved, and SHALL NOT update the in-memory state to reflect the failed write.
5. THE App SHALL serialize expense, budget, and category data as JSON before writing to Storage and deserialize JSON when reading from Storage.
6. WHEN expense, budget, and category data is serialized to JSON and then deserialized from that JSON, THE resulting in-memory state SHALL contain the same set of expenses (by id, amount, category, date, and description), budgets (by category, month, and amount), and categories (by name) as the original state.

---

### Requirement 9: Export Data

**User Story:** As a user, I want to export my expense data, so that I can back it up or analyze it in another tool.

#### Acceptance Criteria

1. WHEN the user triggers the export action, IF there is at least one recorded expense, THE App SHALL generate a CSV file containing all recorded expenses (regardless of any active filters) and initiate a browser file download without requiring a server request.
2. THE generated CSV file SHALL include a header row with the columns in this order: date, category, amount, description. Each subsequent row SHALL represent one expense with values in the same column order; when a description is absent, the description cell SHALL be empty.
3. THE generated CSV file SHALL be named using the pattern `expenses-YYYY-MM-DD.csv` where `YYYY-MM-DD` is the current local date at the time of export.
4. IF the CSV generation process fails to produce all four required columns (date, category, amount, description) in the output, THEN THE App SHALL abort the download and display an error message.
5. WHEN the user triggers the export action and there are no recorded expenses, THE App SHALL display an informational message indicating there is no data to export and SHALL NOT initiate a file download.

---

### Requirement 10: Responsive Layout

**User Story:** As a user, I want the app to be usable on different screen sizes, so that I can access it on both desktop and mobile browsers.

#### Acceptance Criteria

1. THE App SHALL render a layout on viewport widths from 320px to 2560px in which no UI elements overlap, no content is clipped or hidden outside the viewport, and all interactive elements (buttons, inputs, selectors) are reachable and operable.
2. WHEN the viewport width is below 768px, THE App SHALL stack the Dashboard, Expense_Form, and Expense_List vertically in a single-column layout.
3. WHEN the viewport width is 768px or above, THE App SHALL display the Dashboard and Expense_Form in a multi-column layout.
4. WHEN the viewport width is exactly 768px, THE App SHALL apply the multi-column layout.
5. WHEN the viewport width is below 768px, all interactive elements (buttons, inputs, links) SHALL have a minimum touch target size of 44×44 CSS pixels.
6. THE App SHALL not produce horizontal overflow or require horizontal scrolling on any supported viewport width from 320px to 2560px.
