const fs = require('fs');
const path = 'D:/claw/wishful-claw/src/main/index.ts';
let content = fs.readFileSync(path, 'utf8');

const anchor = "    async (args) => getNativeWorker().request('db/goal-events-add', args)\r\n  )";
const insertBlock = `  )
  // -- Goal control handlers --
  registerMessagePackHandler<Record<string, unknown>, unknown>(
    'goal:pause:msgpack',
    async (args) => getNativeWorker().request('goal/pause', args)
  )
  registerMessagePackHandler<Record<string, unknown>, unknown>(
    'goal:resume:msgpack',
    async (args) => getNativeWorker().request('goal/resume', args)
  )
  registerMessagePackHandler<Record<string, unknown>, unknown>(
    'goal:abort:msgpack',
    async (args) => getNativeWorker().request('goal/abort', args)
  )
  registerMessagePackHandler<Record<string, unknown>, unknown>(
    'goal:status:msgpack',
    async (args) => getNativeWorker().request('goal/status', args)
  )`;

if (!content.includes(anchor)) {
  // Try LF variant
  const anchorLF = "    async (args) => getNativeWorker().request('db/goal-events-add', args)\n  )";
  if (content.includes(anchorLF)) {
    content = content.replace(anchorLF, insertBlock.replace(/\r\n/g, '\n'));
    fs.writeFileSync(path, content, 'utf8');
    console.log('Done (LF)');
  } else {
    console.error('Anchor not found');
    process.exit(1);
  }
} else {
  content = content.replace(anchor, insertBlock);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Done (CRLF)');
}
