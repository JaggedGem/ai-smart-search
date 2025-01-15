const fs = require('fs');
const path = require('path');

const sourceDir = '.';
const distDir = 'dist';

// Create dist directory if it doesn't exist
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
}

// Files to copy
const filesToCopy = [
  'manifest.json',
  'background.js',
  'content.js',
  'popup.html',
  'popup.js',
  'rules.json',
];

// Copy files
filesToCopy.forEach((file) => {
  fs.copyFileSync(path.join(sourceDir, file), path.join(distDir, file));
});

// Copy icons directory
const sourceIconsDir = path.join(sourceDir, 'icons');
const destIconsDir = path.join(distDir, 'icons');

if (fs.existsSync(sourceIconsDir)) {
  if (!fs.existsSync(destIconsDir)) {
    fs.mkdirSync(destIconsDir);
  }

  fs.readdirSync(sourceIconsDir).forEach((file) => {
    fs.copyFileSync(path.join(sourceIconsDir, file), path.join(destIconsDir, file));
  });
}
