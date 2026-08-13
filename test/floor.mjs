/*
 * The syntax floor, for the constructs a parser cannot be asked about.
 *
 * The card ships unbundled, so whatever is written is what the browser parses,
 * and the floor is Chrome 61. CI parses at ES2018, which rejects optional
 * chaining, `??`, class fields and the rest -- but ES2018 is not Chrome 61.
 * Five constructs sit in the gap, and three of them are regular expression
 * literals, which are validated while parsing: one named capture group added
 * while reshaping a route string is an early SyntaxError that kills the whole
 * module, so the custom element never registers and every dashboard using the
 * card shows Home Assistant's grey configuration error. On desktop Chrome, and
 * in CI, it looks perfect.
 *
 * Grep cannot do this: a regular expression literal is not something you can
 * tell from a division or a URL by looking at the characters. The AST can.
 */

import { readFileSync } from "node:fs";
import * as acorn from "acorn";

const file = process.argv[2];

const ast = acorn.parse(readFileSync(file, "utf8"), {
  ecmaVersion: 2018,
  sourceType: "module",
  locations: true,
});

const bad = [];
const at = (node) => `${file}:${node.loc.start.line}`;

(function walk(node) {
  if (!node || typeof node.type !== "string") return;

  if (node.type === "Literal" && node.regex) {
    const { flags, pattern } = node.regex;
    if (flags.indexOf("s") >= 0) bad.push(`${at(node)}: regex dotAll flag (Chrome 62)`);
    if (pattern.indexOf("(?<=") >= 0 || pattern.indexOf("(?<!") >= 0) {
      bad.push(`${at(node)}: regex lookbehind (Chrome 62)`);
    } else if (pattern.indexOf("(?<") >= 0) {
      bad.push(`${at(node)}: regex named capture group (Chrome 64)`);
    }
  }
  if (node.async && node.generator) bad.push(`${at(node)}: async generator (Chrome 63)`);
  if (node.type === "ForOfStatement" && node.await) bad.push(`${at(node)}: for await (Chrome 63)`);

  for (const key of Object.keys(node)) {
    if (key === "loc" || key === "regex") continue;
    const child = node[key];
    if (Array.isArray(child)) child.forEach(walk);
    else if (child && typeof child === "object") walk(child);
  }
})(ast);

if (bad.length) {
  for (const line of bad) console.log(`::error::${line}`);
  process.exit(1);
}

console.log(`${file}: no syntax above the Chrome 61 floor.`);
