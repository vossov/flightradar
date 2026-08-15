/*
 * The browser floor, in one command.
 *
 * The card ships unbundled, so what is written is what the browser parses, and
 * the Home Assistant companion app on older Android runs WebViews well behind
 * desktop Chrome. The floor is Chrome 61. Everything below either stops the
 * module parsing -- in which case the custom element never registers and every
 * dashboard using the card shows Home Assistant's grey configuration error --
 * or throws the first time it is called, which lands inside the `hass` setter
 * and looks like exactly the same thing.
 *
 * None of it can be caught by a rendering test in a current headless Chrome,
 * and most of it cannot be caught by a grep either: a regular expression
 * literal is not something you can tell from a division or a URL by looking at
 * the characters, and this file's CSS lives inside template literals. So the
 * checks read the syntax tree.
 *
 * Both CI and the release workflow run this, rather than each keeping its own
 * copy of the rules -- which is how the release gate came to be checking less
 * than CI without anybody noticing.
 */

import { readFileSync } from "node:fs";
import * as acorn from "acorn";

/* ES2018 parses, Chrome 61 does not. The three regex ones are validated while
 * parsing, so they are early errors: the same symptom as `?.`. */
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
];

/* These parse anywhere and throw when called, so a build is green and the card
 * dies on the phone. Chrome version in brackets.
 *
 * Null-prototype, because the names being looked up here are whatever is
 * written in the file: a plain object literal answers `constructor`, `valueOf`
 * and `toString` out of its own prototype and reports four inherited members
 * of Object as browser features. */
const BANNED_MEMBERS = Object.assign(Object.create(null), {
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
});

const BANNED_GLOBALS = Object.assign(Object.create(null), {
  globalThis: 71,
  structuredClone: 98,
  BigInt: 67,
});

/* Dropped silently rather than throwing, which wrecks the layout with nothing
 * in the console to say so. `grid-gap` (57) is the spelling the floor
 * understands and is deliberately not in this list. */
const BANNED_CSS = /(^|[{;])[ \t]*(inset|inset-block|inset-inline|gap|row-gap|column-gap)[ \t]*:/;

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

  (function walk(node) {
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
      const since = BANNED_MEMBERS[node.property.name];
      if (since) found.push(`${at(node)}: .${node.property.name}() is Chrome ${since}`);
    }
    if (node.type === "Identifier" && BANNED_GLOBALS[node.name]) {
      found.push(`${at(node)}: ${node.name} is Chrome ${BANNED_GLOBALS[node.name]}`);
    }

    // The card's CSS lives in template literals, so that is where to look for
    // properties older WebViews drop on the floor.
    if (node.type === "TemplateLiteral") {
      for (const quasi of node.quasis) {
        const text = quasi.value.cooked === null ? quasi.value.raw : quasi.value.cooked;
        for (const line of String(text).split("\n")) {
          if (BANNED_CSS.test(line)) {
            found.push(`${at(node)}: CSS "${line.trim()}" -- gap is Chrome 84, inset is 87`);
          }
        }
      }
    }

    for (const key of Object.keys(node)) {
      if (key === "loc" || key === "regex") continue;
      const child = node[key];
      if (Array.isArray(child)) child.forEach(walk);
      else if (child && typeof child === "object") walk(child);
    }
  })(ast);

  return found;
}

/* A guard that has quietly stopped guarding is worse than no guard, and this
 * one is all pattern matching against a moving parser. So it proves it still
 * bites before it is believed about the real file. */
const MUST_BE_CAUGHT = [
  ["const a = /(?<year>\\d{4})/;", "named capture"],
  ["const a = /a.b/s;", "dotAll"],
  ["const a = /(?<=EUR )\\d+/;", "lookbehind"],
  ["async function* a() {}", "async generator"],
  ["async function a() { for await (const b of c) {} }", "for await"],
  ["const a = b.flat();", "flat"],
  ["const a = Object.fromEntries(b);", "fromEntries"],
  ["const a = b.replaceAll('c', 'd');", "replaceAll"],
  ["const a = globalThis.b;", "globalThis"],
  ["const a = b?.c;", "optional chaining"],
  ["const a = b ?? c;", "nullish coalescing"],
  ["class A { b = 1; }", "class field"],
  ["const a = `.b { display: flex; gap: 8px; }`;", "one-line gap"],
  ["const a = `.b {\\n  inset: 0;\\n}`;", "inset"],
];

const MUST_BE_ALLOWED = [
  ["const a = `.b { display: grid; grid-gap: 10px; }`;", "grid-gap is Chrome 57"],
  ["const a = 'https://x/{z}/{y}.png';", "a URL is not a regex"],
  ["const a = b.padStart(2, '0');", "padStart is Chrome 57"],
  ["const a = { ...b, c: 1 };", "object spread is Chrome 60"],
  ["const a = `${b} gap`;", "the word gap is not the property"],
  ["const a = b.constructor;", "Object.prototype is not a browser feature"],
  ["const a = b.toString();", "nor is toString"],
  ["const a = b.hasOwnProperty('c');", "nor is hasOwnProperty"],
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
  console.log(`::error::The floor is Chrome 61. Spell it out instead.`);
  process.exit(1);
}

console.log(`${file}: nothing above the Chrome 61 floor.`);
