#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const readmePath = join(__dirname, '..', 'README.md');

const readmeContent = readFileSync(readmePath, 'utf-8');

// Get content starting from "## Usage"
const usageSectionMatch = readmeContent.match(/## Usage([\s\S]*)/);
if (!usageSectionMatch) {
  console.error('Could not find "## Usage" section in README.md');
  process.exit(1);
}
const usageSection = usageSectionMatch[1];

// Find all ```ts ... ``` blocks in the Usage section
const codeBlockRegex = /```ts\n([\s\S]*?)```/g;
const codeBlocks = [];
let match;
while ((match = codeBlockRegex.exec(usageSection)) !== null) {
  codeBlocks.push(match[1]);
}

if (codeBlocks.length === 0) {
  console.error('Could not find any TypeScript code blocks in the "## Usage" section of README.md');
  process.exit(1);
}

// Ensure test directory exists
const testDir = join(__dirname, '..', 'test');
mkdirSync(testDir, { recursive: true });

// Write each code block to its own file: readme-example-1.ts, readme-example-2.ts, ...
codeBlocks.forEach((code, index) => {
  const fileIndex = index + 1;
  const filePath = join(testDir, `readme-example-${fileIndex}.ts`);
  writeFileSync(filePath, code, 'utf-8');
  console.log(`✓ Extracted README example #${fileIndex} to ${filePath}`);
});
