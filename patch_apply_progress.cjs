const fs = require('fs');
const path = 'D:/claw/wishful-claw/src/renderer/src/stores/goal-store.ts';
let content = fs.readFileSync(path, 'utf8');

const oldBlock = "  applySyncedGoalEvent: (event) => {\r\n    upsertGoalEvent(set, event)\r\n  }\r\n}))";
const newBlock = "  applySyncedGoalEvent: (event) => {\r\n    upsertGoalEvent(set, event)\r\n  },\r\n\r\n  applyGoalProgress: (progress) => {\r\n    set((state) => ({\r\n      goalProgressBySession: {\r\n        ...state.goalProgressBySession,\r\n        [progress.sessionId]: progress\r\n      }\r\n    }))\r\n  }\r\n}))";

if (content.includes(oldBlock)) {
  content = content.replace(oldBlock, newBlock);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Done');
} else {
  // Try LF
  const oldBlockLF = oldBlock.replace(/\r\n/g, '\n');
  if (content.includes(oldBlockLF)) {
    content = content.replace(oldBlockLF, newBlock.replace(/\r\n/g, '\n'));
    fs.writeFileSync(path, content, 'utf8');
    console.log('Done (LF)');
  } else {
    console.error('Block not found');
    // Debug
    const idx = content.indexOf('applySyncedGoalEvent: (event)');
    console.log('Found at index:', idx);
    if (idx >= 0) {
      console.log('Context:', JSON.stringify(content.substring(idx, idx + 100)));
    }
    process.exit(1);
  }
}
