# Lookup contract

`createLookup(read)` returns a function accepting a key. A successful return
value is cached exactly, including the empty string, zero, false, null and
undefined. Later calls with the same key return the cached value without calling
`read` again. Different keys are independent. If `read` throws, the error is
forwarded and a later call must retry. `src/labels.cjs` is an existing consumer.
