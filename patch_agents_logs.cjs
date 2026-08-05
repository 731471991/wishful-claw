const fs = require('fs');
const path = 'D:/claw/wishful-claw/AGENTS.md';
let content = fs.readFileSync(path, 'utf8');

// Fix macOS line - replace entire mangled line
content = content.replace(
  /- macOS：.*\n/,
  '- macOS：`~/.wishful-claw/logs/`\n'
);

// Fix Linux line
content = content.replace(
  /- Linux：.*\n/,
  '- Linux：`~/.wishful-claw/logs/`\n'
);

// Also fix Windows line - remove the old AppData reference
content = content.replace(
  /- Windows：.*\n/,
  '- Windows：`C:\\\\Users\\\\<用户名>\\\\.wishful-claw\\\\logs\\\\`\n'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Done');
