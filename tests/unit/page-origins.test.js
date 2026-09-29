/**
 * Reading a page template for addresses on another origin: the script, style and markup
 * readers behind the UAT page's `no-third-party-requests` guarantee. Each case below is a
 * way a text scan was, or could be, told something other than what a browser does.
 */
const { foreignAddresses, leavesOrigin } = require('../../tools/cli/lib/page-origins');

const inScript = (code) => foreignAddresses(`<script>\n${code}\n</script>`);

describe('an address resolved as each way of opening the page resolves it', () => {
  it.each([
    ['//evil.example/a'],
    ['\\\\evil.example/a'],
    ['/\\evil.example/a'],
    ['\\/evil.example/a'],
    ['https:evil.example/a'],
    ['http:evil.example/a'],
    [' \t//evil.example/a'],
    ['/\t/evil.example/a'],
    ['https://evil.example/a'],
    ['wss://evil.example/a'],
    ['http://[::1'],
  ])('%j leaves the page', (address) => {
    expect(leavesOrigin(address)).toBe(true);
  });

  it.each([['a.png'], ['/a.png'], ['./x/../a.png'], ['?q=1'], ['#top'], ['data:,x'], ['blob:x']])(
    '%j stays on the page',
    (address) => {
      expect(leavesOrigin(address)).toBe(false);
    }
  );
});

describe('a script is read as tokens, not as text', () => {
  it('finds a string after a regular expression that holds a quote', () => {
    expect(inScript('var q = /"/g; new Image().src = "//evil.example/p.gif";')).toEqual([
      'an address on another origin in <script>: //evil.example/p.gif',
    ]);
  });

  it('finds a string after a comment that holds an apostrophe', () => {
    expect(inScript("// the tester's own\nnew Image().src = '//evil.example/p.gif';")).toEqual([
      'an address on another origin in <script>: //evil.example/p.gif',
    ]);
  });

  it('finds the fixed part of a template literal, around and inside a substitution', () => {
    expect(inScript('var a = `\\/\\/evil.example/${id}`;')).toEqual([
      'an address on another origin in <script>: //evil.example/',
    ]);
    expect(inScript('var a = `x${ f({ a: "//evil.example/n" }) }y`;')).toEqual([
      'an address on another origin in <script>: //evil.example/n',
    ]);
  });

  it('decodes every escape a string literal can hold', () => {
    for (const hidden of [
      '"\\x2f\\x2fevil.example/"',
      '"\\u002F\\u{2f}evil.example/"',
      '"/\\\n/evil.example/"',
    ])
      expect(inScript(`new Image().src = ${hidden};`)).toEqual([
        'an address on another origin in <script>: //evil.example/',
      ]);
  });

  it('still refuses a scheme and its slashes the reading did not see as a string', () => {
    expect(inScript('// load https://evil.example/ later')).toEqual([
      'an absolute address in <script>: https://evil.example/',
    ]);
  });

  it('leaves divisions, local paths, plain words and namespace names alone', () => {
    expect(
      inScript(
        [
          'var half = total / 2 / 1;',
          'fetch("__uat/ping"); fetch(serve + "/results/" + id);',
          'var label = "Note: " + "a:b";',
          'var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");',
          'var r = /^n-(.+)-([a-z])$/.exec(id);',
        ].join('\n')
      )
    ).toEqual([]);
  });
});

describe('markup and style are decoded before they are read', () => {
  it('reads an event handler as a script and srcdoc as a page', () => {
    expect(foreignAddresses('<img src="a.png" onerror="this.src=\'//evil.example/b\'">')).toEqual([
      'an address on another origin in <img onerror>: //evil.example/b',
    ]);
    expect(
      foreignAddresses('<iframe srcdoc="&lt;img src=&quot;//evil.example/c&quot;&gt;"></iframe>')
    ).toEqual(['an address on another origin in <img src>: //evil.example/c']);
  });

  it('reads a javascript: address as the script it is', () => {
    expect(
      foreignAddresses('<iframe src="javascript:fetch(\'//evil.example/j\')"></iframe>')
    ).toEqual(['an address on another origin in <iframe src>: //evil.example/j']);
  });

  it('decodes an escaped url function and ignores a commented one', () => {
    expect(foreignAddresses('<style>b { background: u\\72l(//evil.example/u) }</style>')).toEqual([
      'an address on another origin in <style>: //evil.example/u',
    ]);
    expect(foreignAddresses('<style>/* url(//evil.example/u) */ b { color: red }</style>')).toEqual(
      []
    );
  });

  it('refuses a preconnect or a prefetch as it refuses a load', () => {
    expect(foreignAddresses('<link rel="preconnect" href="https://fonts.example">')).toEqual([
      'an address on another origin in <link href>: https://fonts.example',
    ]);
    expect(foreignAddresses('<link rel="dns-prefetch" href="//cdn.example">')).toEqual([
      'an address on another origin in <link href>: //cdn.example',
    ]);
  });

  it('leaves a link the reader follows, an inline image and a namespace alone', () => {
    expect(
      foreignAddresses(
        '<!-- see https://docs.example/ --><svg xmlns="http://www.w3.org/2000/svg"></svg>' +
          '<a href="https://docs.example/">doc</a><img src="data:image/png;base64,AAAA" alt="">' +
          '<meta name="viewport" content="width=device-width, initial-scale=1">'
      )
    ).toEqual([]);
  });
});

describe('markup is split as the HTML tokenizer splits it', () => {
  const img = (address) => `an address on another origin in <img src>: ${address}`;

  it.each([
    ['<!--> <img src="https://evil.example/a.png"> -->'],
    ['<!---> <img src="https://evil.example/a.png"> -->'],
    ['<!-- x --!> <img src="https://evil.example/a.png"> -->'],
  ])('ends a comment where a browser ends it: %j', (markup) => {
    expect(foreignAddresses(markup)).toEqual([img('https://evil.example/a.png')]);
  });

  it('keeps what a comment, a bogus comment or an unfinished tag really hides', () => {
    expect(
      foreignAddresses(
        '<!-- <img src="//evil.example/a"> --><? <img src=//evil.example/b ><!doctype html>' +
          '<!----><p>x</p><!-- <img src="//evil.example/c">'
      )
    ).toEqual([]);
    expect(foreignAddresses('<p>x</p><img src="//evil.example/d" alt="')).toEqual([]);
  });

  it('reads attributes as the tag states do', () => {
    expect(foreignAddresses('<img/src=//evil.example/p>')).toEqual([img('//evil.example/p')]);
    expect(foreignAddresses('<img alt=a"b src=//evil.example/p>')).toEqual([
      img('//evil.example/p'),
    ]);
    expect(foreignAddresses('<img alt="a>b" src=\'//evil.example/p\'>')).toEqual([
      img('//evil.example/p'),
    ]);
  });

  it('ends a raw text at any end tag a browser accepts, and a script not inside an escape', () => {
    expect(foreignAddresses('<script>x</script x><img src=//evil.example/p>')).toEqual([
      img('//evil.example/p'),
    ]);
    expect(foreignAddresses('<style>b{}</style\t><img src=//evil.example/p>')).toEqual([
      img('//evil.example/p'),
    ]);
    // `<!--<script>` defers the end: the first `</script>` is still script, and so is the rest.
    expect(inScript('0<!--<script>\n0</script>/i\nnew Image().src="//evil.example/p"')).toEqual([
      'an address on another origin in <script>: //evil.example/p',
    ]);
    // A comment in a script is not one in markup.
    expect(foreignAddresses('<script>0<!--</script><img src=//evil.example/q>-->')).toEqual([
      img('//evil.example/q'),
    ]);
  });

  it('refuses a style or a script whose reading depends on the tree around it', () => {
    const unreadable = (what) => `${what}, which the check cannot read as a browser does`;
    expect(foreignAddresses('<svg><style>b{}</style></svg>')).toEqual([
      unreadable('a <style> inside <svg>'),
    ]);
    expect(foreignAddresses('<math><script>0</script></math>')).toEqual([
      unreadable('a <script> inside <math>'),
    ]);
    expect(foreignAddresses('<select><style>b{}</style></select>')).toEqual([
      unreadable('a <style> inside <select>'),
    ]);
    expect(foreignAddresses('<svg><![CDATA[ x ]]></svg>')).toEqual([
      unreadable('a CDATA section in <svg>'),
    ]);
    expect(foreignAddresses('<frameset></frameset>')).toEqual([unreadable('a <frameset>')]);
    // Inside svg, math is an svg element: its mi is no integration point.
    expect(foreignAddresses('<svg><math><mi><style></style></mi></math></svg>')).toEqual([
      unreadable('a <style> inside <svg>'),
    ]);
  });

  it('follows svg and math back out to HTML, where a style is read again', () => {
    const css = '<style>b { background: url(//evil.example/s) }</style>';
    const named = ['an address on another origin in <style>: //evil.example/s'];
    expect(foreignAddresses(`<svg><foreignObject>${css}</foreignObject></svg>`)).toEqual(named);
    expect(foreignAddresses(`<svg><g></g></svg>${css}`)).toEqual(named);
    expect(foreignAddresses(`<svg/>${css}`)).toEqual(named);
    expect(foreignAddresses(`<svg><p>x</p>${css}`)).toEqual(named);
    expect(foreignAddresses(`<math><mi>${css}</mi></math>`)).toEqual(named);
    expect(foreignAddresses(`<select id="lang"></select>${css}`)).toEqual(named);
    expect(foreignAddresses('<svg><title><img src=//evil.example/t></title></svg>')).toEqual([
      img('//evil.example/t'),
    ]);
  });
});

describe('a data: document or script is read as what loads it', () => {
  const inData = (entry, where) => `${entry}, in the data: address of ${where}`;
  const img = (address) => `an address on another origin in <img src>: ${address}`;

  it('reads a data: frame, object or embed as a page', () => {
    expect(
      foreignAddresses('<iframe src="data:text/html,<img src=https://evil.example/d.png>">')
    ).toEqual([inData(img('https://evil.example/d.png'), '<iframe src>')]);
    expect(
      foreignAddresses('<object data="data:text/html,%3Cimg%20src=//evil.example/o%3E"></object>')
    ).toEqual([inData(img('//evil.example/o'), '<object data>')]);
    const base64 = Buffer.from('<img src=//evil.example/e>').toString('base64');
    expect(foreignAddresses(`<embed src="data:text/html;base64,${base64}">`)).toEqual([
      inData(img('//evil.example/e'), '<embed src>'),
    ]);
    expect(
      foreignAddresses(
        '<iframe src="data:text/html,<iframe src=\'data:text/html,<img src=//evil.example/n>\'>">'
      )
    ).toEqual([inData(inData(img('//evil.example/n'), '<iframe src>'), '<iframe src>')]);
  });

  it('reads a data: script as a script and a data: stylesheet as a style sheet', () => {
    const inside = (where, address) =>
      `an address on another origin in the data: address of ${where}: ${address}`;
    expect(
      foreignAddresses('<script src="data:text/javascript,fetch(`//evil.example/f`)"></script>')
    ).toEqual([inside('<script src>', '//evil.example/f')]);
    expect(
      foreignAddresses(
        '<link rel="stylesheet" href="data:text/css,b{background:url(//evil.example/c)}">'
      )
    ).toEqual([inside('<link href>', '//evil.example/c')]);
  });

  it('refuses a data: address it cannot read byte for byte', () => {
    const utf16 = Buffer.from('<img src=//evil.example/u>', 'utf16le').toString('base64');
    expect(
      foreignAddresses(`<iframe src="data:text/html;charset=utf-16le;base64,${utf16}"></iframe>`)
    ).toEqual([
      'the data: address of <iframe src>, which the check cannot read (charset utf-16le)',
    ]);
    expect(foreignAddresses('<iframe src="data:text/html;base64,A"></iframe>')).toEqual([
      'the data: address of <iframe src>, which the check cannot read (bad base64)',
    ]);
  });

  it('leaves an image alone, and a data: page that loads nothing', () => {
    expect(
      foreignAddresses(
        '<img src="data:image/svg+xml,<svg><image href=\'https://evil.example/i\'/></svg>" alt="">' +
          '<iframe src="data:text/html,<p>Hello</p><a href=\'#top\'>top</a>"></iframe>'
      )
    ).toEqual([]);
  });
});

describe('an attribute that is not an address is still read for the one it holds', () => {
  const named = (where, address) => `an address on another origin in <${where}>: ${address}`;

  it('reads the url() of a presentation attribute', () => {
    expect(foreignAddresses('<svg><rect mask="url(//evil.example/m.svg#m)"/></svg>')).toEqual([
      named('rect mask', '//evil.example/m.svg#m'),
    ]);
    expect(foreignAddresses('<svg><rect cursor="url(//evil.example/c.cur), auto"/></svg>')).toEqual(
      [named('rect cursor', '//evil.example/c.cur')]
    );
    expect(foreignAddresses('<svg><rect filter="u\\72l(//evil.example/f)"/></svg>')).toEqual([
      named('rect filter', '//evil.example/f'),
    ]);
    expect(
      foreignAddresses('<svg><rect fill="url(#grad)" mask="url(\'m.svg#m\')"/></svg>')
    ).toEqual([]);
  });

  it('reads the values an SVG animation gives an address', () => {
    expect(
      foreignAddresses(
        '<svg><image href="a.png"><animate attributeName="href" values="a.png;//evil.example/v"/></image></svg>'
      )
    ).toEqual([named('animate values', '//evil.example/v')]);
    expect(foreignAddresses('<svg><animate attributeName="x" values="0;10;0"/></svg>')).toEqual([]);
  });

  it('resolves an attribution report source as the address it is', () => {
    expect(foreignAddresses('<img src="a.png" attributionsrc="a.png /\\evil.example/r">')).toEqual([
      named('img attributionsrc', '/\\evil.example/r'),
    ]);
  });
});
