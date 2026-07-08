// Generates a Shields.io "endpoint" badge JSON from Vitest's coverage summary.
// Reads coverage/coverage-summary.json (produced by the json-summary reporter)
// and writes coverage/coverage-badge.json, which is served by GitHub Pages and
// consumed by the README badge via https://img.shields.io/endpoint?url=...
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const summaryPath = resolve('coverage', 'coverage-summary.json');
const outPath = resolve('coverage', 'coverage-badge.json');

const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
const pct = summary.total.lines.pct; // line coverage percentage

function colorFor(p) {
  if (p >= 90) return 'brightgreen';
  if (p >= 80) return 'green';
  if (p >= 70) return 'yellowgreen';
  if (p >= 60) return 'yellow';
  if (p >= 50) return 'orange';
  return 'red';
}

const badge = {
  schemaVersion: 1,
  label: 'coverage',
  message: `${pct}%`,
  color: colorFor(pct)
};

writeFileSync(outPath, JSON.stringify(badge));
console.log(`Wrote ${outPath}: ${badge.message} (${badge.color})`);
