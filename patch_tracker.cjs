const fs = require('fs');
const path = 'D:/claw/wishful-claw/src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorLoop.cs';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/\r\n/g, '\n');

// 1. StartPlan: insert before "var prompt = BuildPlanExecutionPrompt" in ExecutePlanAsync
// This creates the plan file before sub-agent execution
const startPlanAnchor = 'var prompt = BuildPlanExecutionPrompt(plan.Title, plan.Description);';
if (content.includes(startPlanAnchor)) {
  content = content.replace(
    startPlanAnchor,
    'GoalPlanTracker.StartPlan(goal.WorkingFolder, goal.GoalId, plan);\n        var prompt = BuildPlanExecutionPrompt(plan.Title, plan.Description);'
  );
  console.log('StartPlan added');
} else {
  console.error('StartPlan anchor not found');
  process.exit(1);
}

// 2. FinishPlan for PlanCompleted: after "WriteGoalState(goal);" in the satisfied block
// Find the completed block: plan.Status = "completed" ... WriteGoalState(goal);
const completedAnchor = 'plan.ResultSummary = evaluation.Reasoning ?? result.Summary;';
if (content.includes(completedAnchor)) {
  content = content.replace(
    completedAnchor,
    'plan.ResultSummary = evaluation.Reasoning ?? result.Summary;\n                GoalPlanTracker.FinishPlan(goal.WorkingFolder, goal.GoalId, plan);'
  );
  console.log('FinishPlan (completed) added');
} else {
  console.error('Completed anchor not found');
  process.exit(1);
}

// 3. FinishPlan for PlanFailed (max retries): after "plan.ResultSummary = $\"Failed after"
const failedAnchor = 'plan.ResultSummary = $"Failed after {maxRetries} retries: {evaluation.Reasoning}";';
if (content.includes(failedAnchor)) {
  content = content.replace(
    failedAnchor,
    'plan.ResultSummary = $"Failed after {maxRetries} retries: {evaluation.Reasoning}";\n                GoalPlanTracker.FinishPlan(goal.WorkingFolder, goal.GoalId, plan);'
  );
  console.log('FinishPlan (failed) added');
} else {
  console.error('Failed anchor not found');
  process.exit(1);
}

// 4. AppendLog for PlanRetried/PlanAdjusted
const retriedAnchor = '$"Plan {planIndex + 1} retry {plan.RetryCount}: {evaluation.Reasoning}", context);';
if (content.includes(retriedAnchor)) {
  content = content.replace(
    retriedAnchor,
    '$"Plan {planIndex + 1} retry {plan.RetryCount}: {evaluation.Reasoning}", context);\n            GoalPlanTracker.AppendLog(goal.WorkingFolder, goal.GoalId, plan.PlanId, $"Retry {plan.RetryCount}: {evaluation.Reasoning}");'
  );
  console.log('AppendLog (retry) added');
} else {
  console.error('Retried anchor not found');
  process.exit(1);
}

// 5. AppendLog for PlanAdjusted
const adjustedAnchor = '$"Plan {planIndex + 1} adjusted (retry {plan.RetryCount}): {evaluation.Reasoning}", context);';
if (content.includes(adjustedAnchor)) {
  content = content.replace(
    adjustedAnchor,
    '$"Plan {planIndex + 1} adjusted (retry {plan.RetryCount}): {evaluation.Reasoning}", context);\n                GoalPlanTracker.AppendLog(goal.WorkingFolder, goal.GoalId, plan.PlanId, $"Adjusted (retry {plan.RetryCount}): {evaluation.Reasoning}");'
  );
  console.log('AppendLog (adjust) added');
} else {
  console.error('Adjusted anchor not found');
  process.exit(1);
}

// 6. AppendLog for 429 backoff - after BackoffStarted emit in Handle429BackoffAsync
// Find the first BackoffStarted emit and add log
const backoffAnchor = 'GoalBackoffStrategy.GetStatusMessage(attempt, phase, totalWaitedSeconds), context);';
const backoffIdx = content.indexOf(backoffAnchor);
if (backoffIdx >= 0) {
  // Only replace the first occurrence (in the while loop, not the timeout one)
  content = content.substring(0, backoffIdx + backoffAnchor.length) +
    '\n            GoalPlanTracker.AppendLog(goal.WorkingFolder, goal.GoalId, plan.PlanId, $"429 backoff: {GoalBackoffStrategy.GetStatusMessage(attempt, phase, totalWaitedSeconds)}");' +
    content.substring(backoffIdx + backoffAnchor.length);
  console.log('AppendLog (backoff) added');
} else {
  console.log('Backoff anchor not found (skipping)');
}

fs.writeFileSync(path, content, 'utf8');
console.log('Done - all GoalPlanTracker integrations applied');
