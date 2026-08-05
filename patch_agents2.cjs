const fs = require('fs');
const path = 'D:/claw/wishful-claw/AGENTS.md';
let lines = fs.readFileSync(path, 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('- Windows')) {
    lines[i] = '- Windows：`C:\\\\Users\\\\<用户名>\\\\.wishful-claw\\\\logs\\\\`';
  } else if (lines[i].startsWith('- macOS')) {
    lines[i] = '- macOS：`~/.wishful-claw/logs/`';
  } else if (lines[i].startsWith('- Linux')) {
    lines[i] = '- Linux：`~/.wishful-claw/logs/`';
  }
}

fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Done');
