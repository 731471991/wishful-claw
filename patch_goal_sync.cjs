const fs = require('fs');
const path = 'D:/claw/wishful-claw/src/renderer/src/stores/chat-store/index.ts';
let content = fs.readFileSync(path, 'utf8');

// Add import for installGoalSyncListener
const importAnchor = "import type { AgentStreamEnvelope } from '@shared/agent-stream-protocol'";
const importInsert = `import type { AgentStreamEnvelope } from '@shared/agent-stream-protocol'
import { installGoalSyncListener } from '@renderer/stores/goal-store'`;

if (content.includes(importAnchor)) {
  content = content.replace(importAnchor, importInsert.replace(/\r\n/g, '\n'));
  console.log('Import added');
} else {
  console.error('Import anchor not found');
  process.exit(1);
}

// Add installGoalSyncListener() call after stream receiver start
const streamAnchor = "getAgentStreamReceiver().start((envelope) => {";
const streamInsert = `installGoalSyncListener()

getAgentStreamReceiver().start((envelope) => {`;

if (content.includes(streamAnchor)) {
  content = content.replace(streamAnchor, streamInsert);
  console.log('installGoalSyncListener call added');
} else {
  console.error('Stream anchor not found');
  process.exit(1);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Done');
