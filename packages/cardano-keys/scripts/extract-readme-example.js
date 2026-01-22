#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const readmePath = join(__dirname, '..', 'README.md');
const outputPath = join(__dirname, '..', 'test', 'readme-example.ts');

const readmeContent = readFileSync(readmePath, 'utf-8');

// Extract code block between ```ts and ``` after "## Usage"
const match = readmeContent.match(/## Usage[\s\S]*?```ts\n([\s\S]*?)```/);

if (!match) {
  console.error('Could not find TypeScript code block in README.md');
  process.exit(1);
}

const codeBlock = match[1];

writeFileSync(outputPath, codeBlock, 'utf-8');
console.log('✓ Extracted README example to test/readme-example.ts');
