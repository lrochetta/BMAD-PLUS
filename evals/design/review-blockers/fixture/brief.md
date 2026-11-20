# Design read — Ledgerly invoice list

Rendered from the design intake. Every answer below was given by the product owner unless
marked otherwise.

## Surface

Data table: the invoice list of a small invoicing workspace (`index.html`, `styles.css`,
`tokens.css`). One page, one list, row actions.

## Audience

Freelancers and two-person studios checking who has not paid yet. Weekly, on a laptop, often
in the evening, keyboard and trackpad; some users never touch the mouse.

## Job

Find the unpaid and overdue invoices and act on them: send a reminder, or delete a draft that
was created by mistake. The page has done its job when an overdue invoice is found in under ten
seconds and acted on without leaving the list.

## Brand

Partial: `tokens.css` is the token sheet. Components take every colour, radius and spacing
from it; a raw colour value inside a component is a defect.

## Design system

None. Plain HTML and CSS, no component library.

## Dials

Aesthetic family: none. Variance 3, motion 2, density 6 (product surface: calm and dense).

## Stack

Static HTML with one stylesheet importing the token sheet.

## Accessibility

WCAG 2.2 AA. Keyboard-only use is a first-class path, not an edge case.

## Languages

One language, LTR.

## States

The list is empty on first login and whenever a filter matches nothing. Loading and error
states are handled by the shell around this page and are out of scope here.
