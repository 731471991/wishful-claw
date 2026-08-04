#!/usr/bin/env python3
"""Patch content-renderer.tsx to split rendering into process (collapsible) + final output."""
import re

FILE = r'D:\claw\wishful-claw\src\renderer\src\components\chat\AssistantMessage\content-renderer.tsx'

with open(FILE, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add import for ExecutionProcessBlock (already done via edit, verify)
if "ExecutionProcessBlock" not in content:
    content = content.replace(
        "import type { ToolBlockRendererProps } from './tool-block-renderer'",
        "import type { ToolBlockRendererProps } from './tool-block-renderer'\nimport { ExecutionProcessBlock } from './execution-process-block'"
    )

# 2. Find the marker: end of renderToolRun function + start of return
# The pattern is:
#     )
#   }
#
#   return (
#     <div className="space-y-2">
#       {orchestrationRun?.kind === 'team' && orchestrationAnchorIndex < 0 ? (
#         <OrchestrationBlock run={orchestrationRun} />
#       ) : null}
#       {renderItemsWithInlineSummaries.map((item) => {
#         if (item.kind === 'compact-summary') {

# Find the exact position of the return statement after renderToolRun
return_marker = '\n  return (\n    <div className="space-y-2">\n      {orchestrationRun?.kind === \'team\' && orchestrationAnchorIndex < 0 ? (\n        <OrchestrationBlock run={orchestrationRun} />\n      ) : null}\n      {renderItemsWithInlineSummaries.map((item) => {\n        if (item.kind === \'compact-summary\') {'

if return_marker not in content:
    print("ERROR: Could not find return marker")
    exit(1)

# The end of the map callback and the rest after it
end_marker = '      })}\n      {isStreaming && <span className={getLiveOutputCursorClass(liveOutputAnimationStyle)} />'

if end_marker not in content:
    print("ERROR: Could not find end marker")
    exit(1)

# Extract the map callback content (between start of map and end)
map_start = content.index(return_marker)
# Find the closing })} of the map
map_end = content.index(end_marker) + len(end_marker)

# The part before the return (everything up to renderToolRun's closing brace)
before = content[:map_start]
# The part after the map (cursor + image loader + closing div)
after = content[map_end:]

# Build the new middle section: process/final split + renderItem + new return
new_middle = '''
  // ─── Process / Final-output split ───
  // Find the boundary: the last item whose block is text/image/image_error/agent_error.
  // Items before it = process (thinking + tool_use + intermediate text + compact-summary).
  // Items at or after it = final output (last text reply, generated images, errors).
  const finalOutputStartIndex = (() => {
    for (let i = renderItemsWithInlineSummaries.length - 1; i >= 0; i--) {
      const item = renderItemsWithInlineSummaries[i]
      if (item.kind === 'block') {
        const block = normalizedContent?.[item.index]
        if (block && (block.type === 'text' || block.type === 'image' || block.type === 'image_error' || block.type === 'agent_error')) {
          return i
        }
      }
    }
    return renderItemsWithInlineSummaries.length
  })()

  const hasProcessContent = finalOutputStartIndex > 0

  const renderItem = (item: AssistantRenderItemWithInlineSummary): React.JSX.Element | null => {
    if (item.kind === 'compact-summary') {
      return (
        <ContextCompressionMessage
          key={`compact-summary-${item.message.id}`}
          message={item.message}
        />
      )
    }

    if (item.kind === 'block') {
      const block = normalizedContent![item.index]
      switch (block.type) {
        case 'thinking':
          return (
            <ThinkingBlock
              key={`${item.index}-${block.completedAt ? 'settled' : 'active'}`}
              thinking={block.thinking}
              isStreaming={isStreaming}
              startedAt={block.startedAt}
              completedAt={block.completedAt}
            />
          )
        case 'text': {
          if (hasStructuredThinkingBlocks) {
            const visibleText = stripThinkTags(block.text)
            if (!visibleText.trim()) return null
            return (
              <div key={item.index} className={MD_CLASS}>
                <StreamingMarkdownContent
                  text={visibleText}
                  isStreaming={!!isStreaming && item.index === lastStructuredTextIdx}
                />
              </div>
            )
          }

          const textSegments = parseThinkTags(block.text)
          const hasThinkInBlock = textSegments.some((s) => s.type === 'think')
          if (!hasThinkInBlock) {
            return (
              <div key={item.index} className={MD_CLASS}>
                <StreamingMarkdownContent
                  text={block.text}
                  isStreaming={!!isStreaming && item.index === lastStructuredTextIdx}
                />
              </div>
            )
          }
          const isBlockStreaming = !!(isStreaming && item.index === lastStructuredTextIdx)
          const lastTxtSeg = textSegments.reduce(
            (acc: number, s, j) => (s.type === 'text' ? j : acc),
            -1
          )
          return (
            <div key={item.index}>
              {textSegments.map((seg, j) => {
                if (seg.type === 'think') {
                  return (
                    <ThinkingBlock
                      key={`${item.index}-${j}-${seg.closed ? 'settled' : 'active'}`}
                      thinking={seg.content}
                      isStreaming={isBlockStreaming && !seg.closed}
                    />
                  )
                }
                return (
                  <div key={j} className={MD_CLASS}>
                    <StreamingMarkdownContent
                      text={seg.content}
                      isStreaming={isBlockStreaming && j === lastTxtSeg}
                    />
                  </div>
                )
              })}
            </div>
          )
        }
        case 'image': {
          const imgBlock = block as Extract<ContentBlock, { type: 'image' }>
          const imgSrc =
            imgBlock.source.type === 'base64' && imgBlock.source.data
              ? `data:${imgBlock.source.mediaType || 'image/png'};base64,${imgBlock.source.data}`
              : (imgBlock.source.url ?? '')
          if (!imgSrc && !imgBlock.source.filePath) return null
          const editableImage = imageBlockToAttachment(imgBlock)
          const actions =
            canEditGeneratedImages && sessionId && editableImage
              ? [
                  {
                    key: 'edit',
                    label: t('assistantMessage.editImage', { defaultValue: 'Edit image' }),
                    icon: <Pencil className="size-4" />,
                    onClick: () => openImageEditor({ sessionId, image: editableImage, mode: 'edit' })
                  },
                  {
                    key: 'mask',
                    label: t('assistantMessage.maskEditImage', { defaultValue: 'Mask edit' }),
                    icon: <Eraser className="size-4" />,
                    onClick: () => openImageEditor({ sessionId, image: editableImage, mode: 'mask' })
                  }
                ]
              : undefined
          return (
            <ScaleIn key={item.index} className={liveScaleInClassName}>
              <ImagePreview
                src={imgSrc}
                alt="Generated image"
                filePath={imgBlock.source.filePath}
                actions={actions}
              />
            </ScaleIn>
          )
        }
        case 'image_error': {
          const imageError = block as Extract<ContentBlock, { type: 'image_error' }>
          return (
            <ScaleIn key={item.index} className={liveScaleInClassName}>
              <ImageGenerationErrorCard code={imageError.code} message={imageError.message} />
            </ScaleIn>
          )
        }
        case 'agent_error': {
          const agentError = block as Extract<ContentBlock, { type: 'agent_error' }>
          return (
            <ScaleIn key={item.index} className={liveScaleInClassName}>
              <AgentErrorCard
                code={agentError.code}
                message={agentError.message}
                errorType={agentError.errorType}
                details={agentError.details}
                stackTrace={agentError.stackTrace}
              />
            </ScaleIn>
          )
        }
        case 'tool_use':
          return <ToolBlockRenderer key={block.id} block={block} blockIndex={item.index} {...toolBlockProps} />
        case 'web_search': {
          const webSearch = block as Extract<ContentBlock, { type: 'web_search' }>
          return (
            <ScaleIn key={item.index} className={liveScaleInClassName}>
              <WebSearchBlock block={webSearch} />
            </ScaleIn>
          )
        }
        default:
          return null
      }
    }

    return renderToolRun(item.runId)
  }

  const processItems = renderItemsWithInlineSummaries.slice(0, finalOutputStartIndex)
  const finalItems = renderItemsWithInlineSummaries.slice(finalOutputStartIndex)

  return (
    <div className="space-y-2">
      {orchestrationRun?.kind === 'team' && orchestrationAnchorIndex < 0 ? (
        <OrchestrationBlock run={orchestrationRun} />
      ) : null}
      <ExecutionProcessBlock
        collapsible={hasProcessContent}
        isStreaming={!!isStreaming}
        summary={undefined}
        activeDetail={toolExecutionOutline.activeSummary}
      >
        {processItems.map((item) => renderItem(item))}
      </ExecutionProcessBlock>
      {finalItems.map((item) => renderItem(item))}
'''

# The after part starts with the cursor span
# after starts with: {isStreaming && <span ...
# but we already consumed that in end_marker, so after starts after it
# Actually end_marker includes the cursor line, so after starts after the cursor line
# Let's check: end_marker = '      })}\n      {isStreaming && <span ...'
# So after starts right after that line

new_content = before + new_middle + '\n' + after

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f"Done. File size: {len(new_content)} chars")
