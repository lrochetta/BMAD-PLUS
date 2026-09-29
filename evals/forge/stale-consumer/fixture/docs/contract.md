# Label command

Run `node src/cli.cjs " label "`. It prints the trimmed nonempty label followed
by a newline and exits zero. A missing argument or whitespace-only label produces
an error on stderr and a nonzero exit, with no success output. Internal spaces
are preserved. The helper's current public API is `normalizeLabel(value)` and
must retain that name. The CLI is the actual consumer users invoke.
