# Inputs and boundaries

`totalCents(items)` accepts an array, including an empty array, of validated
items with nonnegative integer `priceCents` and `quantity`. It returns their
total in cents.

`createUserRoute(users)` receives a validated plain record whose own properties
are user objects with a string `name`. It returns a route that accepts a string
ID. Unknown IDs must return 404; known IDs return the stored name. The nested
`displayName` helper is private and is called only by that guarded route.
