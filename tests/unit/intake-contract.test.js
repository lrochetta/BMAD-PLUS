/** The intake contract: what a pack may ask, what an answers file may hold, what the host does next. */
const contract = require('../../tools/build/intake-contract');

const intake = () => ({
  schema_version: 1,
  id: 'design-read',
  pack: 'design',
  title: 'Design read',
  language: 'user',
  max_per_message: 2,
  sections: [
    {
      id: 'surface',
      title: 'What is being built',
      questions: [
        {
          id: 'page_kind',
          ask: 'Which surface is this?',
          kind: 'choice',
          choices: ['landing', 'dashboard', 'form'],
          must_have: true,
          feeds: ['brief.md#surface'],
          risk_if_unknown: 'The wrong module set loads.',
        },
        {
          id: 'audience',
          ask: 'Who uses it?',
          kind: 'text',
          must_have: true,
          risk_if_unknown: 'Generic copy.',
        },
        {
          id: 'motion',
          ask: 'How much motion, 1 to 10?',
          kind: 'number',
          min: 1,
          max: 10,
          default: 5,
        },
      ],
    },
    {
      id: 'constraints',
      title: 'Constraints',
      questions: [
        { id: 'dark_mode', ask: 'Dark mode too?', kind: 'boolean', default: true },
        { id: 'languages', ask: 'Which languages?', kind: 'list' },
        {
          id: 'deadline',
          ask: 'When?',
          kind: 'text',
          must_have: true,
          risk_if_unknown: 'No plan.',
        },
      ],
    },
  ],
});

describe('validateIntake', () => {
  test('accepts the reference intake', () => {
    expect(contract.validateIntake(intake())).toEqual({ ok: true, problems: [] });
  });

  test('refuses anything that is not a mapping', () => {
    for (const value of [[], null, 'intake', 3]) {
      expect(contract.validateIntake(value)).toEqual({
        ok: false,
        problems: ['intake: must be a mapping'],
      });
    }
  });

  test.each([
    ['a wrong schema version', (i) => (i.schema_version = 2), /schema_version must be 1/],
    ['an unknown top-level field', (i) => (i.max_questions = 3), /unknown field "max_questions"/],
    ['an id that is not a slug', (i) => (i.id = 'Design Read'), /"id" must be a lowercase slug/],
    ['a pack that is not a slug', (i) => (i.pack = ''), /"pack" must be a lowercase slug/],
    ['an empty title', (i) => (i.title = ' '), /"title" must be a non-empty text/],
    ['a bad language', (i) => (i.language = 'french'), /"language" must be "user"/],
    ['max_per_message out of range', (i) => (i.max_per_message = 0), /max_per_message/],
    ['no sections', (i) => (i.sections = []), /"sections" must be a non-empty list/],
    ['a duplicate section id', (i) => (i.sections[1].id = 'surface'), /duplicate section id/],
    ['an unknown section field', (i) => (i.sections[0].extra = 1), /unknown field "extra"/],
    ['a section without questions', (i) => (i.sections[1].questions = []), /"questions" must be/],
    [
      'a duplicate question id across sections',
      (i) => (i.sections[1].questions[0].id = 'motion'),
      /duplicate question id "motion"/,
    ],
    [
      'a question id in kebab-case',
      (i) => (i.sections[0].questions[0].id = 'page-kind'),
      /snake_case/,
    ],
    [
      'an unknown question field',
      (i) => (i.sections[0].questions[0].must_have_ = true),
      /unknown field/,
    ],
    [
      'an empty ask',
      (i) => (i.sections[0].questions[1].ask = ''),
      /"ask" must be a non-empty text/,
    ],
    ['an unknown kind', (i) => (i.sections[0].questions[1].kind = 'date'), /"kind" must be one of/],
    [
      'a choice with one option',
      (i) => (i.sections[0].questions[0].choices = ['landing']),
      /at least two/,
    ],
    [
      'a choice with repeated options',
      (i) => (i.sections[0].questions[0].choices = ['a', 'a']),
      /at least two distinct/,
    ],
    [
      'choices on a text question',
      (i) => (i.sections[0].questions[1].choices = ['a', 'b']),
      /belongs to a choice/,
    ],
    ['min on a text question', (i) => (i.sections[0].questions[1].min = 1), /belongs to a number/],
    [
      'a non-numeric max',
      (i) => (i.sections[0].questions[2].max = '10'),
      /"max" must be a finite number/,
    ],
    ['min above max', (i) => (i.sections[0].questions[2].min = 11), /"min" exceeds "max"/],
    ['must_have as a string', (i) => (i.sections[0].questions[0].must_have = 'yes'), /must_have/],
    [
      'a must-have without its risk',
      (i) => delete i.sections[0].questions[1].risk_if_unknown,
      /must-have question needs "risk_if_unknown"/,
    ],
    ['an empty risk', (i) => (i.sections[0].questions[2].risk_if_unknown = ''), /risk_if_unknown/],
    [
      'a must-have with a default',
      (i) => (i.sections[0].questions[0].default = 'landing'),
      /takes no "default"/,
    ],
    [
      'a default outside the bounds',
      (i) => (i.sections[0].questions[2].default = 11),
      /"default" must be at most 10/,
    ],
    [
      'a default of the wrong kind',
      (i) => (i.sections[1].questions[0].default = 'yes'),
      /"default" needs true or false/,
    ],
    [
      'feeds without an anchor shape',
      (i) => (i.sections[0].questions[0].feeds = ['bad anchor']),
      /artifact anchors/,
    ],
  ])('refuses %s', (_name, mutate, message) => {
    const value = intake();
    mutate(value);
    const result = contract.validateIntake(value);
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toMatch(message);
  });

  test('reports every problem, not only the first', () => {
    const value = intake();
    value.title = '';
    value.sections[0].questions[1].ask = '';
    expect(contract.validateIntake(value).problems).toHaveLength(2);
  });
});

describe('validateAnswers', () => {
  const answers = () => ({
    schemaVersion: 1,
    intake: 'design-read',
    answers: {
      page_kind: { value: 'landing', status: 'answered' },
      motion: { value: 5, status: 'defaulted' },
      audience: { status: 'unknown', risk: 'Generic copy.' },
      languages: { status: 'unknown' },
    },
  });

  test('accepts answered, defaulted and unknown entries', () => {
    expect(contract.validateAnswers(answers(), intake())).toEqual({ ok: true, problems: [] });
  });

  test.each([
    ['a wrong schema version', (a) => (a.schemaVersion = 2), /schemaVersion must be 1/],
    ['another intake id', (a) => (a.intake = 'other'), /intake must be "design-read"/],
    ['an unknown top-level field', (a) => (a.notes = 'x'), /unknown field "notes"/],
    ['answers that are a list', (a) => (a.answers = []), /keyed by question id/],
    [
      'an unknown question',
      (a) => (a.answers.colour = { value: 'red', status: 'answered' }),
      /no such question/,
    ],
    [
      'an entry with a foreign field',
      (a) => (a.answers.page_kind.note = 'x'),
      /unknown field "note"/,
    ],
    [
      'a status outside the enum',
      (a) => (a.answers.page_kind.status = 'guessed'),
      /status must be one of/,
    ],
    [
      'an unknown with a value',
      (a) => (a.answers.audience.value = 'x'),
      /unknown and carries a value/,
    ],
    [
      'a must-have unknown without its risk',
      (a) => delete a.answers.audience.risk,
      /unknown without its risk/,
    ],
    [
      'an answered entry carrying a risk',
      (a) => (a.answers.page_kind.risk = 'x'),
      /carries a risk/,
    ],
    [
      'a defaulted entry on a question without default',
      (a) => (a.answers.audience = { value: 'x', status: 'defaulted' }),
      /has no default/,
    ],
    [
      'a defaulted entry with another value',
      (a) => (a.answers.motion.value = 6),
      /other than the default/,
    ],
    [
      'a choice outside the list',
      (a) => (a.answers.page_kind.value = 'poster'),
      /must be one of landing/,
    ],
    [
      'a number above max',
      (a) => (a.answers.motion = { value: 11, status: 'answered' }),
      /at most 10/,
    ],
    [
      'an empty list',
      (a) => (a.answers.languages = { value: [], status: 'answered' }),
      /non-empty list/,
    ],
    [
      'a text that is blank',
      (a) => (a.answers.audience = { value: '  ', status: 'answered' }),
      /non-empty text/,
    ],
  ])('refuses %s', (_name, mutate, message) => {
    const value = answers();
    mutate(value);
    const result = contract.validateAnswers(value, intake());
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toMatch(message);
  });
});

describe('planIntake', () => {
  test('asks must-haves first, in file order, bounded by max_per_message', () => {
    const plan = contract.planIntake(intake());
    expect(plan.ready).toBe(false);
    expect(plan.missing).toEqual(['page_kind', 'audience', 'deadline']);
    expect(plan.next.map((q) => q.id)).toEqual(['page_kind', 'audience']);
    expect(plan.next[0]).toMatchObject({
      kind: 'choice',
      choices: ['landing', 'dashboard', 'form'],
      mustHave: true,
      risk: 'The wrong module set loads.',
      section: 'surface',
    });
    expect(plan.counts).toEqual({
      questions: 6,
      answered: 0,
      defaulted: 0,
      unknown: 0,
      pending: 6,
    });
    expect(plan.maxPerMessage).toBe(2);
    expect(plan.language).toBe('user');
  });

  test('is ready once every must-have is answered or unknown, and still lists the optional rest', () => {
    const answers = {
      schemaVersion: 1,
      intake: 'design-read',
      answers: {
        page_kind: { value: 'form', status: 'answered' },
        audience: { status: 'unknown', risk: 'Generic copy.' },
        deadline: { value: 'June', status: 'answered' },
      },
    };
    const plan = contract.planIntake(intake(), answers);
    expect(plan.ready).toBe(true);
    expect(plan.missing).toEqual([]);
    expect(plan.next.map((q) => q.id)).toEqual(['motion', 'dark_mode']);
    expect(plan.next[0].default).toBe(5);
    expect(plan.unknowns).toEqual([{ id: 'audience', mustHave: true, risk: 'Generic copy.' }]);
    expect(plan.counts).toMatchObject({ answered: 2, unknown: 1, pending: 3 });
  });

  test('falls back to six questions per message', () => {
    const value = intake();
    delete value.max_per_message;
    delete value.language;
    const plan = contract.planIntake(value);
    expect(plan.maxPerMessage).toBe(6);
    expect(plan.next).toHaveLength(6);
    expect(plan.language).toBe('user');
  });
});

describe('parseCliValue', () => {
  const question = (id) => contract.listQuestions(intake()).find((q) => q.id === id);

  test.each([
    ['page_kind', 'form', 'form'],
    ['audience', '  busy parents ', 'busy parents'],
    ['motion', '7', 7],
    ['dark_mode', 'no', false],
    ['dark_mode', 'TRUE', true],
    ['languages', 'fr, en ,', ['fr', 'en']],
  ])('%s = %p becomes %p', (id, raw, expected) => {
    expect(contract.parseCliValue(question(id), raw)).toEqual({ value: expected });
  });

  test.each([
    ['page_kind', 'poster', /must be one of/],
    ['motion', 'seven', /finite number/],
    ['motion', '', /finite number/],
    ['motion', '11', /at most 10/],
    ['dark_mode', 'maybe', /true or false/],
    ['languages', ' , ', /non-empty list/],
    ['audience', '', /non-empty text/],
  ])('%s = %p is refused', (id, raw, message) => {
    expect(() => contract.parseCliValue(question(id), raw)).toThrow(message);
  });

  test('the unknown mark is recognised for every kind', () => {
    for (const q of contract.listQuestions(intake())) {
      expect(contract.parseCliValue(q, contract.UNKNOWN_MARK)).toEqual({ unknown: true });
    }
  });
});

describe('recordAnswers', () => {
  test('records values, unknowns with their risk and proposed defaults without touching the rest', () => {
    const before = contract.emptyAnswers(intake());
    const after = contract.recordAnswers(intake(), before, {
      sets: { page_kind: 'landing', audience: 'UNKNOWN', languages: 'UNKNOWN' },
      defaults: ['motion'],
    });
    expect(after.answers).toEqual({
      page_kind: { value: 'landing', status: 'answered' },
      audience: { status: 'unknown', risk: 'Generic copy.' },
      languages: { status: 'unknown' },
      motion: { value: 5, status: 'defaulted' },
    });
    expect(before.answers).toEqual({});
    expect(contract.validateAnswers(after, intake()).ok).toBe(true);
  });

  test.each([
    ['an unknown question', { sets: { colour: 'red' } }, /no question "colour"/],
    ['a default on a question without one', { defaults: ['audience'] }, /has no default/],
    [
      'the same question set and defaulted',
      { sets: { motion: '3' }, defaults: ['motion'] },
      /set twice/,
    ],
    ['a value outside the kind', { sets: { motion: 'x' } }, /finite number/],
  ])('refuses %s', (_name, changes, message) => {
    expect(() =>
      contract.recordAnswers(intake(), contract.emptyAnswers(intake()), changes)
    ).toThrow(message);
  });
});

describe('renderBrief', () => {
  test('writes one section per intake section, each answer with its status, and the open questions', () => {
    const answers = contract.recordAnswers(intake(), contract.emptyAnswers(intake()), {
      sets: { page_kind: 'landing', audience: 'UNKNOWN', languages: 'fr,en', dark_mode: 'no' },
      defaults: ['motion'],
    });
    const brief = contract.renderBrief(intake(), answers);
    expect(brief.startsWith('# Design read\n' + contract.briefMarker(intake()) + '\n\n')).toBe(
      true
    );
    expect(contract.briefMarker(intake())).toBe(
      '<!-- owned by bmad-plus intake design-read; written by bmad-plus intake render, do not edit -->'
    );
    expect(brief).toContain('1 unknown, 1 not asked yet. Not ready: a must-have is open.');
    expect(brief).toContain('## What is being built');
    expect(brief).toContain('## Constraints');
    expect(brief).toContain(
      '### page_kind (must-have)\n\nWhich surface is this?\n\nAnswer:\n    landing\nFeeds: brief.md#surface'
    );
    expect(brief).toContain('Answer (proposed default, not confirmed by the user):\n    5\n');
    expect(brief).toContain('Answer: unknown — risk: Generic copy.');
    expect(brief).toContain('Answer:\n    fr\n    en\n');
    expect(brief).toContain('Answer:\n    no\n');
    expect(brief).toContain('### deadline (must-have)\n\nWhen?\n\nAnswer: not asked yet.');
    expect(brief).toContain(
      '## Open questions\n\n- audience (must-have): unknown — risk: Generic copy.\n- deadline (must-have): not asked yet — risk: No plan.\n'
    );
    expect(brief.endsWith('\n')).toBe(true);
  });

  test('says ready and "None." once nothing is open', () => {
    const answers = contract.recordAnswers(intake(), contract.emptyAnswers(intake()), {
      sets: { page_kind: 'form', audience: 'kids', deadline: 'May', languages: 'fr' },
      defaults: ['motion', 'dark_mode'],
    });
    const brief = contract.renderBrief(intake(), answers);
    expect(brief).toContain('0 not asked yet. Ready.');
    expect(brief).toContain('## Open questions\n\nNone.\n');
  });

  test('a value that looks like Markdown structure stays an indented block', () => {
    const hostile = 'kids\n\n## Open questions\n\nNone.\n- fake item\n> quote\n| cell |\n# title';
    const answers = contract.recordAnswers(intake(), contract.emptyAnswers(intake()), {
      sets: { audience: hostile, languages: '# fr,- en' },
    });
    const brief = contract.renderBrief(intake(), answers);
    expect(brief).toContain(
      'Answer:\n    kids\n    \n    ## Open questions\n    \n    None.\n    - fake item\n    > quote\n    | cell |\n    # title\n'
    );
    expect(brief).toContain('Answer:\n    # fr\n    - en\n');
    expect(brief.match(/^## Open questions$/gm)).toHaveLength(1);
    expect(brief.match(/^#{1,6} /gm)).toHaveLength(
      1 + intake().sections.length + contract.listQuestions(intake()).length + 1
    );
    expect(brief.match(/^- /gm)).toHaveLength(4);
  });
});

describe('control characters and reserved names', () => {
  test('text and list values keep line breaks and tabs and refuse other control characters', () => {
    const question = (id) => contract.listQuestions(intake()).find((q) => q.id === id);
    expect(contract.parseCliValue(question('audience'), 'two\nlines\twith a tab')).toEqual({
      value: 'two\nlines\twith a tab',
    });
    for (const raw of ['bell\u0007', 'esc\u001b[31m', 'nul\u0000', 'del\u007f', 'cr\rline']) {
      expect(() => contract.parseCliValue(question('audience'), raw)).toThrow(
        /holds a control character/
      );
      expect(() => contract.parseCliValue(question('languages'), 'fr,' + raw)).toThrow(
        /holds a control character/
      );
    }
    const answers = contract.emptyAnswers(intake());
    answers.answers.audience = { value: 'x\u0008', status: 'answered' };
    expect(contract.validateAnswers(answers, intake()).problems).toEqual([
      'answers.audience: value holds a control character',
    ]);
  });

  test('a question id that is an Object.prototype name is refused', () => {
    const value = intake();
    value.sections[1].questions[1].id = 'constructor';
    expect(contract.validateIntake(value).problems).toEqual([
      'sections[1].questions[1]: "id" constructor is a reserved object property name',
    ]);
  });

  test('a prototype name is never read as a recorded answer', () => {
    // An intake that slipped past validation with such an id still asks the question.
    const value = intake();
    value.sections[1].questions[1].id = 'constructor';
    const answers = contract.emptyAnswers(value);
    const plan = contract.planIntake(value, answers);
    expect(plan.counts).toMatchObject({ pending: 6, answered: 0 });
    expect(
      contract.planIntake({ ...value, max_per_message: 6 }, answers).next.map((q) => q.id)
    ).toContain('constructor');
    expect(contract.renderBrief(value, answers).match(/Answer: not asked yet\./g)).toHaveLength(6);
    for (const id of Object.getOwnPropertyNames(Object.prototype)) {
      const forged = { ...answers, answers: { [id]: { status: 'unknown' } } };
      expect(contract.validateAnswers(forged, intake()).ok).toBe(false);
    }
  });
});
