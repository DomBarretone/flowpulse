# Spec Delta

## Purpose

Ensures WCAG 2.1 AA accessibility compliance across FlowPulse web interfaces, providing keyboard navigation, visible focus indicators, screen reader accessibility, and color-redundant status indicators.

## ADDED Requirements

### Requirement: Keyboard Navigation and Focus Visibility
All interactive elements across the primary web console pages (`/dashboard`, `/automations`, `/automations/[id]`, `/automations/new`, `/incidents`, `/incidents/[id]`) SHALL be operable via standard keyboard interactions and provide a clearly visible focus indicator when navigated with the keyboard.

#### Scenario: Navigating interactive controls with Tab
- **WHEN** a user navigates through interactive buttons, links, form inputs, and tab triggers using the `Tab` key
- **THEN** every focused control displays a visible, high-contrast focus ring (`focus-visible:ring-2`) and focus advances in logical DOM reading order

### Requirement: Accessible Status and Severity Indicators
Platform status and severity badges SHALL NOT convey state through color alone, combining explicit textual labels, distinct icons, and accessible text alternatives.

#### Scenario: Status badges render text and icons
- **WHEN** an automation, incident, or execution status badge is rendered in the interface
- **THEN** the badge includes an explicit textual description alongside a distinct visual icon with `aria-hidden="true"`, ensuring comprehension for colorblind users and screen readers

### Requirement: Semantic Tables and Landmark Structure
Tabular data views (such as the recent incidents table and automations list) SHALL use semantic HTML table elements with explicit header scopes, and pages SHALL use standard landmark regions.

#### Scenario: Table column headers have scope
- **WHEN** an incident or execution data table renders in `/dashboard`, `/automations`, or `/incidents`
- **THEN** every header cell is a `<th scope="col">` element and the table provides an accessible label or caption describing its contents

### Requirement: Accessible Dialogs and Focus Trapping
Modal dialogs (such as the incident resolution modal and API key single-view modal) SHALL conform to WAI-ARIA dialog specifications, trapping focus within the modal while open and closing upon pressing `Escape`.

#### Scenario: Modal opening and escape key closure
- **WHEN** an operator opens the incident resolution modal
- **THEN** the container has `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`, focus is automatically placed within the dialog, and pressing the `Escape` key dismisses the dialog returning focus to the trigger

### Requirement: Form Accessibility and Error Association
All form fields across creation and resolution forms SHALL have explicitly associated labels and communicate validation errors to assistive technologies.

#### Scenario: Form input label and error association
- **WHEN** a required field in `/automations/new` or the resolution modal has an invalid value
- **THEN** the input element is associated with its label via `id`/`htmlFor`, marks `aria-invalid="true"`, and links to the error message container via `aria-describedby`
