/**
 * Manual mock for @clack/prompts (ESM-only) so Jest (CommonJS) can load
 * command modules that `require('@clack/prompts')` at module scope.
 *
 * The unit tests exercise pure `_internal` functions that never invoke these
 * prompts; this mock only needs to make the top-level require succeed and be
 * harmless if any UI helper is called. Fixes audit finding TEST-02.
 *
 * Author: Laurent Rochetta
 */
const noop = () => {};
const asyncNoop = async () => {};

module.exports = {
  intro: noop,
  outro: noop,
  cancel: noop,
  isCancel: () => false,
  text: asyncNoop,
  password: asyncNoop,
  confirm: asyncNoop,
  select: asyncNoop,
  multiselect: asyncNoop,
  groupMultiselect: asyncNoop,
  spinner: () => ({ start: noop, stop: noop, message: noop }),
  note: noop,
  log: {
    info: noop,
    success: noop,
    warn: noop,
    warning: noop,
    error: noop,
    step: noop,
    message: noop,
  },
  group: asyncNoop,
  tasks: asyncNoop,
};
