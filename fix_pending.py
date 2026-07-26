import sys

path = 'src/renderer/src/components/chat/AskUserQuestionCard.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = """  const isError = status === 'error' || !!outputErrorMessage
  const isCanceled = status === 'canceled'
  const isAnswered = status === 'completed' && answeredPairs.length > 0
  const isPending = !isAnswered && !isError && !isCanceled && (status === 'running' || isLive)
  const isCompletedWithoutAnswers =
    status === 'completed' && !isAnswered && !isError && !isCanceled && !!answeredText"""

new = """  const isError = status === 'error' || !!outputErrorMessage
  const isCanceled = status === 'canceled'
  const isAnswered = status === 'completed' && answeredPairs.length > 0
  // AskUserQuestion is special: the agent stream ends while waiting for user input,
  // so status may be 'canceled' or 'completed' even though the question is still pending.
  // The true signal for "answered" is having parsed answer pairs in the output.
  // If there are no answers, no error, and no output text, the question is still pending.
  const isPending = !isAnswered && !isError && !isCanceled && !answeredText && (status === 'running' || isLive || status === 'completed' || status === 'canceled')
  const isCompletedWithoutAnswers =
    status === 'completed' && !isAnswered && !isError && !isCanceled && !!answeredText"""

if old in content:
    content = content.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('OK')
else:
    print('NOT FOUND')
