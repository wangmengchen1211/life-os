const { spawn } = require('child_process');
const path = require('path');

const npxPath = process.env.npm_execpath ? path.dirname(process.env.npm_execpath) : '';
const child = spawn('npx', ['zeabur', 'deploy'], {
  cwd: __dirname,
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true
});

let output = '';
let answered = {};

child.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  process.stdout.write(text);
  
  // Auto answer prompts
  if (text.includes('Would you like to create one now') && !answered.create) {
    answered.create = true;
    setTimeout(() => child.stdin.write('Y\n'), 500);
  }
  if (text.includes('Enter project name') && !answered.name) {
    answered.name = true;
    setTimeout(() => child.stdin.write('mindos\n'), 500);
  }
  if (text.includes('Select region') && !answered.region) {
    answered.region = true;
    // Try to select Asia/HK region - send down arrow then enter
    setTimeout(() => child.stdin.write('\n'), 500);
  }
});

child.stderr.on('data', (data) => {
  const text = data.toString();
  output += text;
  process.stderr.write(text);
  
  if (text.includes('Would you like to create one now') && !answered.create) {
    answered.create = true;
    setTimeout(() => child.stdin.write('Y\n'), 500);
  }
  if (text.includes('project name') && !answered.name) {
    answered.name = true;
    setTimeout(() => child.stdin.write('mindos\n'), 500);
  }
});

child.on('close', (code) => {
  console.log(`\nProcess exited with code ${code}`);
});

// Timeout after 10 minutes
setTimeout(() => {
  console.log('\nTimeout - killing process');
  child.kill();
}, 600000);
