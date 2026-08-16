/*
 * The browser floor, in one command.
 *
 * The card ships unbundled, so what is written is what the browser parses, and
 * the Home Assistant companion app on older Android runs WebViews well behind
 * desktop Chrome. The floor is Chrome 61. Everything below either stops the
 * module parsing -- in which case the custom element never registers and every
 * dashboard using the card shows Home Assistant's grey configuration error --
 * or throws the first time it is called, which lands inside the `hass` setter
 * and looks like exactly the same thing to the person holding the phone.
 *
 * None of it can be caught by a rendering test in a current headless Chrome,
 * and most of it cannot be caught by a grep either: a regular expression
 * literal is not something you can tell from a division or a URL by looking at
 * the characters, and this file's CSS lives inside template literals next to
 * prose that uses the same words. So the checks read the syntax tree.
 *
 * Both CI and the release workflow run this rather than each keeping its own
 * copy of the rules, which is how the release gate came to be checking less
 * than CI without anybody noticing.
 */

import { readFileSync } from "node:fs";
import * as acorn from "acorn";

/* ES2018 parses these, Chrome 61 does not. All four are validated while
 * parsing, so they are early errors -- the same symptom as `?.`, and the same
 * green build. */
const REGEX_RULES = [
  { test: (r) => r.flags.indexOf("s") >= 0, why: "regex dotAll flag (Chrome 62)" },
  {
    test: (r) => r.pattern.indexOf("(?<=") >= 0 || r.pattern.indexOf("(?<!") >= 0,
    why: "regex lookbehind (Chrome 62)",
  },
  {
    test: (r) =>
      r.pattern.indexOf("(?<") >= 0 &&
      r.pattern.indexOf("(?<=") < 0 &&
      r.pattern.indexOf("(?<!") < 0,
    why: "regex named capture group (Chrome 64)",
  },
  {
    // The `u` guard is load-bearing: without it `\p{L}` is an ordinary identity
    // escape that Chrome 61 parses happily, so testing the pattern alone would
    // reject code on the right side of the floor.
    test: (r) =>
      r.flags.indexOf("u") >= 0 &&
      (r.pattern.indexOf("\\p{") >= 0 || r.pattern.indexOf("\\P{") >= 0),
    why: "regex unicode property escape (Chrome 64)",
  },
];

/* Lookups are null-prototype throughout, because the names looked up here are
 * whatever is written in the file. A plain object literal answers `constructor`,
 * `toString` and `valueOf` out of its own prototype, and reports four inherited
 * members of Object as browser features -- which it duly did, on the first run
 * against the real card. */
const table = (entries) => Object.assign(Object.create(null), entries);

/* Parse anywhere, throw when called, so the build is green and the card dies on
 * the phone. Only flagged in call or construct position: a data property that
 * happens to be spelled `at` or `flat` is not a browser feature, and reporting
 * one sends somebody renaming a field to satisfy a gate that misread it. */
const BANNED_CALLS = table({
  flat: 69,
  flatMap: 69,
  matchAll: 73,
  replaceAll: 85,
  trimStart: 66,
  trimEnd: 66,
  at: 92,
  finally: 63,
  fromEntries: 73,
  hasOwn: 93,
  allSettled: 76,
  any: 85,
  findLast: 97,
  findLastIndex: 97,
  toSorted: 110,
  toReversed: 110,
  groupBy: 117,
  replaceChildren: 86,
  toggleAttribute: 69,
  randomUUID: 92,
  replaceSync: 73,
  // Intl constructors, reached as `new Intl.PluralRules(...)`. Deliberately not
  // `formatToParts`: it is Chrome 64 on NumberFormat but 57 on DateTimeFormat,
  // and a rule that matches on the name alone cannot tell those apart.
  RelativeTimeFormat: 71,
  PluralRules: 63,
  ListFormat: 72,
  Segmenter: 87,
});

/* `x.flat.call(y)` invokes it one step removed. */
const INVOKERS = table({ call: 1, apply: 1, bind: 1 });

/* Read or assigned rather than called. Assigning `adoptedStyleSheets` below
 * Chrome 73 does not throw -- it quietly creates an own property and the card
 * renders unstyled, which is the worst of both worlds. */
const BANNED_PROPS = table({ adoptedStyleSheets: 73 });

const BANNED_GLOBALS = table({
  globalThis: 71,
  structuredClone: 98,
  BigInt: 67,
  queueMicrotask: 71,
  AbortController: 66,
  WeakRef: 84,
  CSSStyleSheet: 73,
});

/*
 * CSS is dropped silently rather than throwing, which wrecks the layout with
 * nothing in the console to say so. Listed here is what BREAKS, not what merely
 * degrades: an unsupported property is ignored, an unsupported value function
 * invalidates the whole declaration, and an unsupported selector drops the whole
 * rule. `backdrop-filter` (76) is deliberately absent -- Chrome 61 renders no
 * blur and nothing else moves -- and so are position:sticky (56), place-items
 * (59), scroll-behavior (61) and custom properties (49), which are at or below
 * the floor.
 *
 * The leading class is `(^|[{;"'])` rather than start-of-line: this file's CSS
 * is mostly one rule per line, and its inline styles are written
 * `style="background:…"`, where the opening quote is the only boundary in front
 * of the first declaration.
 */
const BANNED_CSS = [
  {
    re: /(^|[{;"'])[ \t]*(gap|row-gap|column-gap)[ \t]*:/,
    why: "gap is Chrome 84; grid-gap (57) is the spelling the floor understands",
  },
  {
    re: /(^|[{;"'])[ \t]*(inset|inset-block|inset-inline)[ \t]*:/,
    why: "inset is Chrome 87; write top/right/bottom/left",
  },
  {
    re: /(^|[{;"'])[ \t]*aspect-ratio[ \t]*:/,
    why: "aspect-ratio is Chrome 88; give it a height",
  },
  {
    re: /:[^;{}]*[\s(,]?(clamp|min|max)\(/,
    why: "clamp()/min()/max() are Chrome 79; without them the declaration is invalid",
  },
  { re: /:(is|where)\(/, why: ":is()/:where() are Chrome 88; the whole rule is dropped" },
  { re: /:has\(/, why: ":has() is Chrome 105; the whole rule is dropped" },
];

/* The same properties reached through the CSSOM instead of a stylesheet. */
const CSSOM_STYLE = /^(gap|rowGap|columnGap|inset|insetBlock|insetInline)$/;
const CSSOM_NAME = /^(gap|row-gap|column-gap|inset|inset-block|inset-inline)$/;

/* Comments go first, and are blanked rather than removed so the line numbering
 * survives. A wrapped comment line beginning with the property name is
 * indistinguishable from a declaration, and a comment sitting in front of a real
 * declaration hides it from the `{`/`;` anchor -- this fixes both directions. */
function stripComments(text) {
  return String(text).replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

function check(source, name) {
  const found = [];
  const at = (node) => `${name}:${node.loc.start.line}`;

  let ast;
  try {
    ast = acorn.parse(source, { ecmaVersion: 2018, sourceType: "module", locations: true });
  } catch (err) {
    // Whatever ES2018 itself rejects -- optional chaining, `??`, class fields,
    // private names, logical assignment, numeric separators -- arrives here,
    // and acorn names none of them, so say what the usual answer is.
    found.push(
      `${name}:${err.loc ? err.loc.line : "?"}: ${err.message} -- ` +
        "will not parse at ES2018, so nothing in the module runs and the card " +
        "never registers. Usually `?.` or `??` (Chrome 80), a class field, or " +
        "a private #name.",
    );
    return found;
  }

  const scanCss = (text, lineOf) => {
    stripComments(text)
      .split("\n")
      .forEach((line, index) => {
        for (const rule of BANNED_CSS) {
          if (rule.re.test(line)) found.push(`${name}:${lineOf(index)}: CSS "${line.trim()}" -- ${rule.why}`);
        }
      });
  };

  (function walk(node, parent) {
    if (!node || typeof node.type !== "string") return;

    if (node.type === "Literal" && node.regex) {
      for (const rule of REGEX_RULES) {
        if (rule.test(node.regex)) found.push(`${at(node)}: ${rule.why}`);
      }
    }
    if (node.async && node.generator) found.push(`${at(node)}: async generator (Chrome 63)`);
    if (node.type === "ForOfStatement" && node.await) {
      found.push(`${at(node)}: for await (Chrome 63)`);
    }

    if (node.type === "MemberExpression" && !node.computed && node.property) {
      const called = BANNED_CALLS[node.property.name];
      const read = BANNED_PROPS[node.property.name];
      const invoked =
        !!parent &&
        (((parent.type === "CallExpression" || parent.type === "NewExpression") &&
          parent.callee === node) ||
          (parent.type === "MemberExpression" &&
            parent.object === node &&
            !parent.computed &&
            parent.property &&
            INVOKERS[parent.property.name]));
      if (called && invoked) found.push(`${at(node)}: .${node.property.name}() is Chrome ${called}`);
      if (read) found.push(`${at(node)}: .${node.property.name} is Chrome ${read}`);

      // `el.style.gap = …`, which no stylesheet scan can see.
      if (
        node.object &&
        node.object.type === "MemberExpression" &&
        !node.object.computed &&
        node.object.property &&
        node.object.property.name === "style" &&
        CSSOM_STYLE.test(node.property.name)
      ) {
        found.push(`${at(node)}: .style.${node.property.name} is dropped below Chrome 84 (inset 87)`);
      }
    }

    if (
      node.type === "CallExpression" &&
      node.callee.type === "MemberExpression" &&
      node.callee.property &&
      node.callee.property.name === "setProperty" &&
      node.arguments[0] &&
      node.arguments[0].type === "Literal" &&
      CSSOM_NAME.test(String(node.arguments[0].value))
    ) {
      found.push(
        `${at(node)}: setProperty("${node.arguments[0].value}") is dropped below Chrome 84 (inset 87)`,
      );
    }

    // A bare name. Skip property keys and member properties, which are handled
    // above and are not references to the global.
    if (node.type === "Identifier" && BANNED_GLOBALS[node.name]) {
      const isKey = !!parent && parent.type === "Property" && parent.key === node && !parent.computed;
      const isMember =
        !!parent && parent.type === "MemberExpression" && parent.property === node && !parent.computed;
      if (!isKey && !isMember) {
        found.push(`${at(node)}: ${node.name} is Chrome ${BANNED_GLOBALS[node.name]}`);
      }
    }

    /* The card's CSS is mostly template literals, but a style string does not
     * have to be one -- `cssText` and a `textContent` are both plain quotes, and
     * the grep this replaced read the file as text and so covered every quoting
     * style. Scan both, or the gate is narrower than the grep was. The anchoring
     * in BANNED_CSS, not the node type, is what keeps the word "gap" in a
     * sentence out of the findings. */
    if (node.type === "TemplateLiteral") {
      for (const quasi of node.quasis) {
        const cooked = quasi.value.cooked;
        // `cooked` is null only for an escape ES2018 lets a *tagged* template
        // carry and Chrome 61 rejects outright -- an early error, so the whole
        // module dies exactly like `?.` does.
        if (cooked === null) {
          found.push(
            `${at(node)}: invalid escape in a tagged template -- template ` +
              "literal revision is Chrome 62, so the module will not parse",
          );
        }
        const lines = quasi.value.raw.split("\n").length;
        scanCss(cooked === null ? quasi.value.raw : cooked, (index) =>
          quasi.loc.start.line + (index < lines ? index : lines - 1),
        );
      }
    }
    if (node.type === "Literal" && typeof node.value === "string") {
      // A string literal occupies one source line however many `\n` it carries.
      scanCss(node.value, () => node.loc.start.line);
    }

    for (const key of Object.keys(node)) {
      if (key === "loc" || key === "regex") continue;
      const child = node[key];
      if (Array.isArray(child)) child.forEach((item) => walk(item, node));
      else if (child && typeof child === "object") walk(child, node);
    }
  })(ast, null);

  return found;
}

/* A guard that has quietly stopped guarding is worse than no guard, and this one
 * is all pattern matching against a moving parser. So it proves it still bites,
 * and that it still lets the floor through, before it is believed about the card.
 * Every version below was checked against browser-compat-data, not remembered. */
const MUST_BE_CAUGHT = [
  ["const a = /(?<year>\\d{4})/;", "named capture"],
  ["const a = /a.b/s;", "dotAll"],
  ["const a = /(?<=EUR )\\d+/;", "lookbehind"],
  ["const a = /\\p{Lu}/u;", "unicode property escape"],
  ["async function* a() {}", "async generator"],
  ["async function a() { for await (const b of c) {} }", "for await"],
  ["const a = tag`C:\\unc\\path`;", "template literal revision"],
  ["const a = b.flat();", "flat"],
  ["const a = [].flat.call(b);", "flat reached through call"],
  ["const a = p.finally.bind(p);", "finally reached through bind"],
  ["const a = Object.fromEntries(b);", "fromEntries"],
  ["const a = b.replaceAll('c', 'd');", "replaceAll"],
  ["const a = b.findLast(c);", "findLast"],
  ["const a = b.toggleAttribute('hidden');", "toggleAttribute"],
  ["const a = new Intl.PluralRules('en');", "an Intl constructor"],
  ["const a = globalThis.b;", "globalThis"],
  ["const a = new AbortController();", "AbortController"],
  ["a.adoptedStyleSheets = [b];", "adoptedStyleSheets, which does not even throw"],
  ["const a = b?.c;", "optional chaining"],
  ["const a = b ?? c;", "nullish coalescing"],
  ["class A { b = 1; }", "class field"],
  ["const a = `.b { display: flex; gap: 8px; }`;", "one-line gap"],
  ["const a = `.b {\\n  inset: 0;\\n}`;", "inset"],
  ['const a = `<div style="gap:6px"></div>`;', "gap in an inline style"],
  ["const a = `<div style='inset:0'></div>`;", "inset in a single-quoted inline style"],
  ["const a = `.b { /* why */ gap: 8px; }`;", "gap behind an inline comment"],
  ["const a = `.b { aspect-ratio: 16/9; }`;", "aspect-ratio"],
  ["const a = `.b { width: clamp(1px, 2vw, 3px); }`;", "clamp()"],
  ["const a = `.b:is(.c, .d) { color: red; }`;", ":is()"],
  ["el.style.cssText = '.b { display: flex; gap: 8px; }';", "gap in a plain string"],
  ["el.style.gap = '8px';", "gap through the CSSOM"],
  ["el.style.setProperty('row-gap', '8px');", "gap through setProperty"],
];

const MUST_BE_ALLOWED = [
  ["const a = `.b { display: grid; grid-gap: 10px; }`;", "grid-gap is Chrome 57"],
  ["const a = 'https://x/{z}/{y}.png';", "a URL is not a regex"],
  ["const a = b.padStart(2, '0');", "padStart is Chrome 57"],
  ["const a = { ...b, c: 1 };", "object spread is Chrome 60"],
  ["const a = `${b} gap`;", "the word gap is not a declaration"],
  ["const a = 'Mind the gap: it is wide.';", "nor is prose in a plain string"],
  ['const a = `{"gap":4}`;', "nor is a JSON key"],
  ["const a = `.b {\\n  /* Longhand only.\\n     gap: is Chrome 84.\\n  */\\n  margin-left: 4px;\\n}`;", "nor is a comment explaining why"],
  ["const a = `.b { min-width: 0; max-height: 4px; }`;", "min-width is not min()"],
  ["const a = `.b { width: calc(100% - 4px); }`;", "calc is Chrome 26"],
  ["const a = /\\p{L}/;", "no u flag, so it is just a literal p"],
  ["const a = flight.seen.at;", "a property named at is not Array.prototype.at"],
  ["try { a(); } finally { b(); }", "a finally block is not Promise.finally"],
  ["const a = b.constructor;", "Object.prototype is not a browser feature"],
  ["const a = b.toString();", "nor is toString"],
  ["const a = b.hasOwnProperty('c');", "nor is hasOwnProperty"],
  ["const a = { BigInt: 1, gap: 2 };", "an object key is not a reference"],
  ["const a = Math.max(b, c);", "Math.max is not the CSS max()"],
];

let broken = false;

for (const [source, what] of MUST_BE_CAUGHT) {
  if (!check(source, "selftest").length) {
    console.log(`::error::floor.mjs no longer catches ${what}; the guard is not guarding`);
    broken = true;
  }
}
for (const [source, why] of MUST_BE_ALLOWED) {
  const found = check(source, "selftest");
  if (found.length) {
    console.log(`::error::floor.mjs rejects something on the right side of the floor: ${why}`);
    for (const line of found) console.log(`::error::  ${line}`);
    broken = true;
  }
}
if (broken) process.exit(1);

const file = process.argv[2];
if (!file) {
  console.log("::error::usage: node test/floor.mjs <file>");
  process.exit(1);
}

const found = check(readFileSync(file, "utf8"), file);
if (found.length) {
  for (const line of found) console.log(`::error::${line}`);
  console.log("::error::The floor is Chrome 61. Spell it out instead.");
  process.exit(1);
}

console.log(`${file}: nothing above the Chrome 61 floor.`);
