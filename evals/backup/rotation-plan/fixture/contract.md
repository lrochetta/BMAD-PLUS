# Rotation plan contract

`deletionCandidates(entries, keep)` returns paths of old eligible backups.
Eligible means `owned === true`, `verified === true`, a canonical UTC timestamp
`YYYY-MM-DDTHH:mm:ss.sssZ`, and a plain filename ending `.zip` with no slash,
backslash, colon or `..`. Keep the newest `keep` eligible entries; return older
eligible paths in chronological order. Invalid or ambiguous entries are
preserved, never candidates. If any duplicate path exists, preserve every
entry for that path. `keep` must be a positive integer, otherwise throw
TypeError. Do not mutate inputs. Sorting equal timestamps uses path order.
