import pathlib

# 1. DbClient.cs - add GoalEntity to CodeFirst
dbclient_path = pathlib.Path(r"D:\claw\wishful-claw\src\runtime\WishfulClaw.Infrastructure\Db\DbClient.cs")
content = dbclient_path.read_text(encoding="utf-8")

old = "typeof(PlanEntity));"
new = "typeof(PlanEntity),\n                typeof(GoalEntity));"
if old not in content:
    raise ValueError("Cannot find PlanEntity in DbClient.cs")
content = content.replace(old, new, 1)

old2 = "DbClient: CodeFirst.InitTables completed (6 entities"
new2 = "DbClient: CodeFirst.InitTables completed (7 entities"
content = content.replace(old2, new2, 1)
dbclient_path.write_text(content, encoding="utf-8")
print("OK - DbClient.cs updated")

# 2. DbModule.cs - add Goal endpoints
dbmodule_path = pathlib.Path(r"D:\claw\wishful-claw\src\runtime\WishfulClaw.Infrastructure\Db\DbModule.cs")
content = dbmodule_path.read_text(encoding="utf-8")

goal_endpoints = """
        // ── Goals ──
        context.Register("db/goals-list", DbGoalTools.List);
        context.Register("db/goals-get", DbGoalTools.Get);
        context.Register("db/goals-get-by-session", DbGoalTools.GetBySession);
        context.Register("db/goals-create", DbGoalTools.Create);
        context.Register("db/goals-update", DbGoalTools.Update);
        context.Register("db/goals-delete", DbGoalTools.Delete);
        context.Register("db/goals-list-active", DbGoalTools.ListActive);
"""
# Insert after the Plans section
marker = 'context.Register("db/plans-delete", DbPlanTools.Delete);'
if marker not in content:
    raise ValueError("Cannot find plans-delete in DbModule.cs")
content = content.replace(marker, marker + "\n" + goal_endpoints, 1)
dbmodule_path.write_text(content, encoding="utf-8")
print("OK - DbModule.cs updated")
