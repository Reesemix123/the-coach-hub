#!/usr/bin/env node
/**
 * This script generates a JSON file containing all guide content
 * that can be imported at runtime in the slide-over panel.
 *
 * Run this during build: node scripts/generate-guide-content.js
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const contentDir = path.join(__dirname, '../src/content/guide');
const outputFile = path.join(__dirname, '../src/lib/generated/guide-content.json');

function getAllMarkdownFiles(dir, basePath = '') {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.join(basePath, entry.name);

    if (entry.isDirectory()) {
      files.push(...getAllMarkdownFiles(fullPath, relativePath));
    } else if (entry.name.endsWith('.md')) {
      files.push({ fullPath, relativePath });
    }
  }

  return files;
}

function generateContent() {
  const files = getAllMarkdownFiles(contentDir);
  const content = {};

  for (const file of files) {
    const fileContent = fs.readFileSync(file.fullPath, 'utf-8');
    const { content: markdown, data: frontmatter } = matter(fileContent);

    // Convert file path to slug
    // e.g., "getting-started/creating-account.md" -> "getting-started/creating-account"
    // e.g., "getting-started/index.md" -> "getting-started"
    let slug = file.relativePath.replace(/\.md$/, '');
    if (slug.endsWith('/index')) {
      slug = slug.replace(/\/index$/, '');
    } else if (slug === 'index') {
      slug = '';
    }

    content[slug] = {
      content: markdown,
      frontmatter,
    };
  }

  // Ensure output directory exists
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputFile, JSON.stringify(content, null, 2));
  console.log(`Generated guide content with ${Object.keys(content).length} entries`);
}

generateContent();
