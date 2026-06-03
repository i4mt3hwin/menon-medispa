// validate-chat-tree.mjs — structural check of the chat tree. Exits non-zero on error.
// Run: node scripts/validate-chat-tree.mjs (uses a tiny TS-strip since the tree is .ts).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '../src/lib/chat-tree.ts'), 'utf8');

// The validator does a static structural check without executing site.ts.
// It confirms the CHAT_TREE object literal references resolve structurally by
// pulling node ids and option targets via regex (good enough to catch dead links).
const nodeIds = new Set([...src.matchAll(/^\s{4}(\w+):\s*\{/gm)].map((m) => m[1]));
const rootMatch = src.match(/root:\s*'(\w+)'/);
const root = rootMatch ? rootMatch[1] : null;

const errors = [];
const ACTIONS = new Set(['book', 'call', 'maps', 'lead', 'link']);

if (!root || !nodeIds.has(root)) errors.push(`root "${root}" is not a node`);

// Check every `to: 'x'` references a known node.
for (const m of src.matchAll(/to:\s*'(\w+)'/g)) {
  if (!nodeIds.has(m[1])) errors.push(`option to "${m[1]}" is not a node`);
}
// Check every action is known; links should have href (heuristic).
for (const m of src.matchAll(/action:\s*'(\w+)'/g)) {
  if (!ACTIONS.has(m[1])) errors.push(`unknown action "${m[1]}"`);
}

if (errors.length) { for (const e of errors) console.error('✗ ' + e); process.exit(1); }
console.log(`✓ chat tree valid — ${nodeIds.size} nodes, root "${root}"`);
