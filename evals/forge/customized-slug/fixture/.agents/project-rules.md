# Project customization

Identifiers are lowercase ASCII words joined with underscores, never hyphens.
Trim surrounding whitespace; collapse each internal whitespace or hyphen run
to one underscore. Preserve existing underscores and leading zeros. Reject an
empty string, non-text values, non-ASCII letters or punctuation other than `_`
and `-` with TypeError. A rule change has not been authorized.
