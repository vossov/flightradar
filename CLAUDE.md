# Skywatch

A Home Assistant integration that polls Flightradar24, plus the Lovelace card
it serves. One HACS repository, category **integration**. `README.md` is the
user-facing description; this file is the working knowledge.

## Bump the version on every change

Three files carry it and they must always agree:

| File | Constant |
| --- | --- |
| `custom_components/skywatch/const.py` | `VERSION` |
| `custom_components/skywatch/manifest.json` | `version` |
| `custom_components/skywatch/frontend/skywatch-card.js` | `CARD_VERSION` |

**Bump all three in the same commit as the change itself.** Not afterwards, not
at release time. Two reasons, and both bite silently:

- HACS only offers an update when the manifest version is higher than what is
  installed. A fix shipped without a bump reaches nobody, and there is no error
  anywhere to tell you.
- The integration serves the card at `/skywatch/skywatch-card.js?v=<VERSION>`.
  That query string is the whole cache-busting story. Ship new card code under
  the old version and browsers keep the old module, so the change appears to
  have done nothing.

Patch for fixes, minor for new options or behaviour, major for anything that
makes an existing dashboard or install stop working. CI fails a push where the
three disagree, and a pull request touching `custom_components/` that does not
raise them above `main`.

A change that touches nothing under `custom_components/` — the README, CI, the
tests — ships nothing to anybody and needs no bump.

## Layout

```
custom_components/skywatch/
  flightradar24.py   the feed client; deliberately free of Home Assistant
  coordinator.py     polling, and backing off when the feed refuses
  sensor.py          the count, with the flights in an attribute
  config_flow.py     position, radius, and how hard to poll
  __init__.py        setup, and serving the card to the frontend
  frontend/          the card
test/
  model.test.mjs     the visibility and loudness maths
  contract.test.mjs  the card's side of the sensor contract
  test_feed.py       the feed client
  floor.mjs          the whole Chrome 61 floor: parse, syntax, built-ins, CSS
  fixtures/          what the sensor puts in front of the card
  preview.html       the card against fixed flights, no Home Assistant
```

## Tests

```
node --test test/model.test.mjs test/contract.test.mjs
python3 -m unittest discover -s test -p 'test_*.py'
npm install --no-save --silent acorn@8
node test/floor.mjs custom_components/skywatch/frontend/skywatch-card.js
ruff check custom_components/skywatch test/test_feed.py
```

acorn is the only dependency anything here has. It is not committed — there is
no `package.json` and `node_modules` is ignored — so a fresh clone installs it
with `--no-save`, which is what both workflows do before running the floor
check. Without it `node test/floor.mjs` exits 1 with `ERR_MODULE_NOT_FOUND`; it
cannot pass by accident.

CI pins ruff. Its default rule set grows between releases, and an unpinned one
fails a build for something the change under test did not do — which is how a
pull request that had bumped the version correctly came to be reported as
failing the version gate. Raise the pin deliberately, in its own diff.

Four things here fail silently and are covered because of it:

- **The geometry and the sound model.** A wrong curvature term hides the wrong
  aeroplanes, confidently, with no error.
- **The feed rows.** Bare lists where position is the only thing naming a
  field, so an index off by one reports a squawk code as an altitude.
- **The seam.** The sensor writes field names and the card reads them, with
  nothing in between checking. `test/fixtures/sensor.json` is exactly what the
  sensor publishes; the Python tests assert the client still produces it and
  `contract.test.mjs` asserts the card still reads it, units included. Change a
  field name on either side and regenerate the fixture on purpose, never to
  make a test go green.

- **The `hass` setter surviving.** See below; the test is
  *a card that cannot render is not a configuration error* in
  `contract.test.mjs`, and it works by there being no `document` in that file.

## Nothing may throw out of `set hass`

Home Assistant calls the card's `hass` setter for every state change in the
system, and it wraps the call. Whatever escapes is caught in `hui-card`, which
throws the card away and puts its grey *Configuration error* tile there
instead. That tile has no `hass` property, so every later update lands on
nothing: **one unlucky update kills the dashboard until the page is reloaded.**
It is not a flicker.

Three things follow, and the first attempt at this bug got all three wrong:

- `setConfig` is not the path to harden. Home Assistant sets the config
  *before* it sets `hass`, so `this._hass` is null there and the `if (this._hass)`
  guard skips the build. The first build — and every rebuild — happens in the
  setter. Guarding `setConfig` alone changes nothing.
- The tile is **blank** on a normal dashboard. Home Assistant renders the
  message only when `preview` is true, so a missing element, a refused config
  and a throw while rendering are indistinguishable to the user. Do not write
  documentation that asks them to read the line under the tile; there isn't
  one. The console has it.
- A throw from the two-second ticker cannot produce the tile — timers report to
  `window.onerror`, not to Home Assistant. Useful when working out which path
  actually failed: if the tile stays until a reload it came through the setter.

So the setter, and the ticker, catch and log and set `_built = false`, and the
next update starts over. Anything reached from either — `_build`, `_refresh`,
`_render`, the map, the popup — is free to be written plainly, because none of
it can take the card down. Keep it that way; the guard is the whole design.

## The card is parsed by old WebViews

It ships unbundled, so what is written is what the browser parses, and the
Home Assistant companion app on older Android runs well behind desktop Chrome.
The floor is **Chrome 61**.

- Optional chaining and `??` are Chrome 80 and are a *parse* error — the whole
  module dies and the element never registers.
- Flexbox `gap` (84) and the `inset` shorthand (87) are dropped silently and
  wreck the layout. Use longhand offsets and adjacent-sibling margins.

`test/floor.mjs` is the whole guard, and it reads the syntax tree rather than
the characters. A rendering test in a current headless Chrome catches none of
this, and a grep cannot tell a regex literal from a URL, or CSS from prose.
It covers four things:

- **The parse**, at ES2018, which is what rejects `?.` and `??` (Chrome 80),
  class fields, private names and logical assignment.
- **The seven constructs in the gap** between ES2018 and Chrome 61 — async
  generators, `for await`, the template literal revision, and regex `dotAll`,
  lookbehind, named capture groups and unicode property escapes. The regex four
  are validated while parsing, so one of them kills the module exactly like
  `?.` does, with CI green.
- **Built-ins**, which parse fine and throw when called: `flat`, `matchAll`,
  `replaceAll`, `findLast`, `Object.fromEntries`, `toggleAttribute`, the newer
  `Intl` constructors and the rest, all Chrome 63 or later, and the call that
  matters lands in the `hass` setter. Flagged only in call position, because a
  field named `at` is not `Array.prototype.at`. `padStart` (57) and `grid-gap`
  (57) are on the right side of the floor; `ResizeObserver` (64) is not, and is
  used only behind a check.
- **CSS**, in template literals and plain strings and through the CSSOM,
  matching the property after a `{`, a `;` or the quote that opens a `style="`
  attribute, as well as at the start of a line — this file's CSS is mostly one
  rule per line and its inline styles carry a single declaration. Comments are
  blanked first, so a note explaining why `gap:` is avoided is not read as
  using it. Beyond `gap` and `inset`: `aspect-ratio` (88), `clamp()`/`min()`/
  `max()` (79) and `:is()` (88), which take the whole declaration or the whole
  rule down with them. `backdrop-filter` (76) is deliberately absent — Chrome
  61 renders no blur and nothing else moves.

Two things about it are deliberate. It **self-tests first**: known-bad snippets
that must be caught and known-good ones that must not, checked before it will
say anything about the card, because a guard that has quietly stopped guarding
is worse than none. And **both CI and the release workflow run the same
command** — the release gate had already fallen a parse behind CI by keeping
its own copy of the rules.

## Flightradar24

There is no free documented API. `feed.js` answers a bounding box with
positional rows; `clickhandler` answers a flight id with the model, airline,
route and photographs. Neither is a contract — treat a missing field as absent,
never as an error. Details are cached per flight until it leaves. Being refused
(401/402/403/429) is told apart from a network failure and stretches the poll
interval, because polling harder makes that worse.

The sensor keeps the field names the Flightradar24 custom integration
established, so the card reads either source. Do not rename them for tidiness.

## How the card reaches the browser

`add_extra_js_url` writes into a list that is read once, when the dashboard's
HTML is served, and rendered into the page as an `import()`. There is no live
delivery: a page served before the integration set up has no line for the card
at all and cannot recover, which is why a dashboard opened during a Home
Assistant restart shows *Configuration error* until it is reloaded. Registering
first thing in `async_setup` is as early as it goes; the window is real and the
README says so rather than pretending otherwise.

Once the line is on the page, registration still races a hard two-second
deadline in the frontend. That one self-heals — the tile is hidden for the two
seconds and swapped back when the element registers — so it shows as a grey
flash, most likely on the first load after a version bump, when the `?v=`
change makes the browser fetch the file rather than take it from cache. The
file is ~92 KB and that is the whole budget; adding to it costs the people on
the oldest phones first.

## HACS

The category is recorded when a user *adds* the custom repository, not from
`hacs.json` and not again afterwards. Anyone who had the card-only Dashboard
version has to delete the custom repository entry — not just the download — and
restart before adding it back as an integration. The README has the steps; keep
them there, it is the question that gets asked.

`brands` validation is skipped on purpose: it wants the domain registered in
`home-assistant/brands`, which is for integrations shipping with Home
Assistant. The HACS workflow runs only on `main`, because it inspects the
repository as GitHub serves it rather than the checkout.

## Releasing

Versions bumped as above, then:

```
git tag v1.2.3 && git push origin v1.2.3
```

The release workflow refuses a tag that disagrees with any of the three, runs
the tests, and publishes. HACS installs `custom_components/skywatch` from the
newest release, so there is nothing to attach.
