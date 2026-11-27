#!/usr/bin/env node
// Writes src/items/itemlist.ts from the rerelease's g_items.cpp (itemlist[]) and the enums in
// g_local.h and game.h (fetched into .id-source by scripts/fetch-id-source.sh): every item the
// game knows, in item_id_t order, with its classname, models, sounds, names, flags and the names
// of its pickup, use, drop and weapon functions.
// Usage: node packages/game/scripts/gen-itemlist.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const src = execFileSync('sh', [join(repo, 'scripts/fetch-id-source.sh'), 'rerelease'], { encoding: 'utf8' }).trim();
const read = (f) => readFileSync(join(src, 'rerelease', f), 'latin1');
const items = read('g_items.cpp').replace(/^#if 0[\s\S]*?^#endif/gm, '');
const headers = read('g_local.h') + '\n' + read('bg_local.h') + '\n' + read('game.h');

const stripComments = (s) =>
  s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^#if 0[\s\S]*?^#endif/gm, '').replace(/^\s*#.*$/gm, '');

// Every simple enum's names and values (bit_v<n>, sums of earlier names, implicit increments).
const names = new Map();
const evaluate = (expr) => {
  const e = expr.trim().replace(/bit_v\s*<\s*(\d+)\s*>/g, '(1 << $1)').replace(/(\d+)u\b/g, '$1');
  const js = e.replace(/[A-Za-z_]\w*/g, (n) => {
    if (!names.has(n)) throw new Error(`unknown name ${n} in ${expr}`);
    return String(names.get(n));
  });
  // eslint-disable-next-line no-new-func
  return Function(`return (${js});`)();
};
for (const m of headers.matchAll(/enum\s*(?:class\s+)?(\w*)\s*(?::\s*[\w:]+)?\s*\{([^}]*)\}/g)) {
  let next = 0;
  for (const part of stripComments(m[2]).split(',')) {
    const p = part.trim();
    if (!p) continue;
    const [name, value] = p.split('=').map((s) => s.trim());
    if (!/^\w+$/.test(name)) continue;
    let v = next;
    if (value !== undefined) {
      try {
        v = evaluate(value);
      } catch {
        continue;
      }
    }
    names.set(name, v >>> 0 === v ? v : v | 0);
    next = v + 1;
  }
}

// itemlist[]: the brace-delimited entries after "{ }, // leave index 0 alone"
const start = items.indexOf('itemlist[] =');
const body = items.slice(items.indexOf('{', start) + 1, items.indexOf('\n};', start));
const entries = [];
{
  let depth = 0;
  let from = -1;
  let inString = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '/' && body[i + 1] === '*') i = body.indexOf('*/', i) + 1;
    else if (c === '/' && body[i + 1] === '/') i = body.indexOf('\n', i);
    else if (c === '{') {
      if (depth === 0) from = i + 1;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) entries.push(body.slice(from, i));
    }
  }
}

const FIELDS = [
  'id', 'classname', 'pickup', 'use', 'drop', 'weaponthink', 'pickup_sound', 'world_model', 'world_model_flags',
  'view_model', 'icon', 'use_name', 'pickup_name', 'pickup_name_definite', 'quantity', 'ammo', 'chain', 'flags',
  'vwep_model', 'armor_info', 'tag', 'precaches', 'sort_id', 'quantity_warn',
];

/** Splits an entry at its top-level commas; keeps the /* field *\/ label of each value. */
function split(entry) {
  const values = [];
  let cur = '';
  let depth = 0;
  let inString = false;
  for (let i = 0; i < entry.length; i++) {
    const c = entry[i];
    if (inString) {
      cur += c;
      if (c === '\\') cur += entry[++i];
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    if (c === '/' && entry[i + 1] === '/') {
      i = entry.indexOf('\n', i);
      if (i < 0) break;
      continue;
    }
    if (c === '(' || c === '{') depth++;
    if (c === ')' || c === '}') depth--;
    if (c === ',' && depth === 0) {
      values.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur.trim()) values.push(cur);
  return values.map((v) => {
    const label = v.match(/\/\*\s*(\w+)\s*\*\//);
    return { label: label?.[1], text: v.replace(/\/\*[\s\S]*?\*\//g, ' ').trim() };
  });
}

const str = (t) => {
  if (t === 'nullptr') return null;
  const parts = [...t.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
  if (!parts.length) throw new Error(`not a string: ${t}`);
  return parts.join('');
};
const fn = (t) => (t === 'nullptr' ? null : t);
const num = (t) => evaluate(t);

const rows = [];
for (const entry of entries) {
  const values = split(entry);
  if (!values.length) {
    rows.push(null); // index 0
    continue;
  }
  const row = {};
  values.forEach((v, i) => {
    // the label names the field; one entry's label has a typo ("precache"), so the position decides then
    const field = v.label && FIELDS.includes(v.label) ? v.label : FIELDS[i];
    if (v.label && v.label !== field && FIELDS.indexOf(field) !== i) throw new Error(`unknown field ${v.label}`);
    row[field] = v.text;
  });
  rows.push({
    id: num(row.id),
    idName: row.id,
    classname: str(row.classname),
    pickup: fn(row.pickup),
    use: fn(row.use),
    drop: fn(row.drop),
    weaponthink: fn(row.weaponthink),
    pickup_sound: str(row.pickup_sound),
    world_model: str(row.world_model),
    world_model_flags: num(row.world_model_flags),
    view_model: str(row.view_model),
    icon: str(row.icon),
    use_name: str(row.use_name),
    pickup_name: str(row.pickup_name),
    pickup_name_definite: str(row.pickup_name_definite),
    quantity: row.quantity ? num(row.quantity) : 0,
    ammo: row.ammo ? num(row.ammo) : 0,
    chain: row.chain ? num(row.chain) : 0,
    flags: row.flags ? num(row.flags) : 0,
    vwep_model: row.vwep_model ? str(row.vwep_model) : null,
    armor_info: row.armor_info && row.armor_info !== 'nullptr' ? row.armor_info.replace(/^&/, '') : null,
    tag: row.tag ? num(row.tag) : 0,
    precaches: row.precaches ? str(row.precaches) : null,
    sort_id: row.sort_id ? num(row.sort_id) : 0,
    quantity_warn: row.quantity_warn ? num(row.quantity_warn) : 5,
  });
}
rows.forEach((r, i) => {
  if (r && r.id !== i) throw new Error(`itemlist[${i}] is ${r.idName} (${r.id}): out of order`);
});

const itemIds = [...stripComments(headers.match(/enum item_id_t[^{]*\{([^}]*)\}/)[1]).split(',')]
  .map((s) => s.trim()).filter(Boolean);

const out = [];
out.push("// Generated by packages/game/scripts/gen-itemlist.mjs from the rerelease's g_items.cpp (itemlist[])");
out.push('// and the enums of g_local.h and game.h. Do not edit; run the script.');
out.push('');
out.push('/** item_id_t: an item\'s index in itemlist. */');
out.push('export const enum ItemId {');
itemIds.forEach((name) => out.push(`  ${name} = ${names.get(name)},`));
out.push('}');
out.push('');
out.push('/** gitem_t, as itemlist declares it; functions are named, for the game to bind. */');
out.push('export interface ItemDef {');
out.push('  readonly id: ItemId;');
out.push('  readonly classname: string | null;');
out.push('  readonly pickup: string | null;');
out.push('  readonly use: string | null;');
out.push('  readonly drop: string | null;');
out.push('  readonly weaponthink: string | null;');
out.push('  readonly pickup_sound: string | null;');
out.push('  readonly world_model: string | null;');
out.push('  readonly world_model_flags: number;');
out.push('  readonly view_model: string | null;');
out.push('  readonly icon: string | null;');
out.push('  readonly use_name: string | null;');
out.push('  readonly pickup_name: string | null;');
out.push('  readonly pickup_name_definite: string | null;');
out.push('  readonly quantity: number;');
out.push('  readonly ammo: ItemId;');
out.push('  readonly chain: ItemId;');
out.push('  readonly flags: number;');
out.push('  readonly vwep_model: string | null;');
out.push('  readonly armor_info: string | null;');
out.push('  readonly tag: number;');
out.push('  readonly precaches: string | null;');
out.push('  readonly sort_id: number;');
out.push('  readonly quantity_warn: number;');
out.push('}');
out.push('');
out.push('/** itemlist[], indexed by ItemId; entry 0 is IT_NULL. */');
out.push('export const ITEMLIST: readonly (ItemDef | null)[] = [');
for (const r of rows) {
  if (!r) {
    out.push('  null,');
    continue;
  }
  const { idName, ...fields } = r;
  out.push(`  ${JSON.stringify(fields).replace(/"id":\d+/, `"id":ItemId.${idName}`)},`);
}
out.push('];');
out.push('');
writeFileSync(join(here, '../src/items/itemlist.ts'), out.join('\n'));
console.log(`wrote ${rows.length - 1} items`);
