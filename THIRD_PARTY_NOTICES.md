# Third-Party Notices

Wishful Claw contains code and design ideas from the following open-source projects,
used under their respective licenses. This notice is provided to comply with the
Apache License 2.0 redistribution requirements (Section 4) and to give proper
attribution to the original authors.

## OpenCowork — code migrated and refactored

- **Project**: [OpenCowork](https://github.com/AIDotNet/OpenCowork)
- **Copyright**: 2026 AIDotNet
- **License**: Apache License 2.0
- **Relationship**: Substantial portions of Wishful Claw (Agent Loop, tool chain,
  providers, streaming protocol, worker runtime, and parts of the Electron/renderer
  layer) are derived from OpenCowork source code. The code has been migrated,
  adapted, renamed, and refactored to fit the Wishful Claw architecture; it is a
  Derivative Work of OpenCowork under the Apache License 2.0.
- **Original copyright notice retained**: `Copyright 2026 AIDotNet`

Source files derived from OpenCowork carry the following notice in their header:

```
/*
 * Ported from OpenCowork.
 * Original: Copyright 2026 AIDotNet
 * Licensed under the Apache License, Version 2.0 (the "License").
 * Modified by the Wishful 心相 team for Wishful Claw.
 */
```

## shadcn/ui — UI components

- **Project**: [shadcn/ui](https://ui.shadcn.com/)
- **License**: MIT
- **Relationship**: The components under `src/renderer/src/components/ui/` are sourced from
  shadcn/ui (distributed via OpenCowork). They are unmodified third-party UI primitives.

## Projects referenced for design ideas (no code copied)

The following projects were studied for design patterns and architecture ideas.
Their code was **not** copied; Wishful Claw implements these designs from scratch.

| Project | Link | Referenced for |
|---------|------|----------------|
| KodaClaw | [nekonaka/koda-claw](https://github.com/nekonaka/koda-claw) | Memory system, persona system, PromptBuilder |
| OpenClaw.net | [nekonaka/openclaw.net](https://github.com/nekonaka/openclaw.net) | Proactive memory recall, memory tools, context budget |
| DeepSeek-Reasonix | [deepseek-ai/DeepSeek-Reasonix](https://github.com/deepseek-ai/DeepSeek-Reasonix) | Cache hit-rate statistics, tool registration/discovery, tool injection system |
| OpenAI Codex | [openai/codex](https://github.com/openai/codex) | Goal-mode state machine (plan → execute → verify → continue/adjust), self-check evaluation |

---

Wishful Claw itself is licensed under the Apache License 2.0.
Copyright 2026 Wishful 心相团队.