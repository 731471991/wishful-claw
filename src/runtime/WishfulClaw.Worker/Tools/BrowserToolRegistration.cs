using System.Text.Json;
using WishfulClaw.Core.Tools;

namespace WishfulClaw.Worker.Tools;

/// <summary>
/// Registers browser tool definitions so the LLM can invoke them.
/// Execution is handled by ToolCallProcessor → AgentRuntimeBrowserExecutor → reverse-request.
/// </summary>
internal static class BrowserToolRegistration
{
    private static readonly string BrowserNavigateDesc =
        "Navigate the built-in browser to a URL or control page history.\n\n" +
        "This is the entry point for all browser interactions. The browser panel opens automatically on the right side.\n\n" +
        "Usage:\n" +
        "- Use action \"goto\" (default) with a url to open a new page. Waits for the page to fully load before returning.\n" +
        "- Use action \"back\", \"forward\", or \"refresh\" to control navigation history (no url needed).\n" +
        "- After navigating, use BrowserSnapshot or BrowserScreenshot to observe the page before interacting.\n" +
        "- URLs without a protocol prefix automatically get \"https://\" prepended. For local dev servers, use \"http://localhost:<port>\".";

    private static readonly string BrowserGetContentDesc =
        "Extract the current page content as Markdown text.\n\n" +
        "Usage:\n" +
        "- Returns the full page body converted to Markdown by default (headings, links, lists, tables, code blocks, images preserved).\n" +
        "- Set type to \"html\" to get the raw HTML source instead of Markdown.\n" +
        "- Pass a CSS selector to extract only a specific section (e.g. \"main\", \"#content\", \".article-body\").\n" +
        "- Best for reading articles, documentation, or extracting structured data from a page.\n" +
        "- For discovering interactive elements (buttons, inputs, links) to click or type into, use BrowserSnapshot instead.\n" +
        "- A page must already be loaded via BrowserNavigate before calling this tool.";

    private static readonly string BrowserScreenshotDesc =
        "Capture a visual screenshot of the current browser viewport and return it as an image.\n\n" +
        "Usage:\n" +
        "- Returns a PNG image of the currently visible area of the page.\n" +
        "- Use this to visually verify page state, check layout, or see content that is hard to represent as text.\n" +
        "- For extracting text content, prefer BrowserGetContent. For discovering clickable elements, prefer BrowserSnapshot.\n" +
        "- A page must already be loaded via BrowserNavigate before calling this tool.";

    private static readonly string BrowserSnapshotDesc =
        "Get a structured list of all interactive elements on the current page with their CSS selectors.\n\n" +
        "Usage:\n" +
        "- Returns every visible link, button, input, select, and textarea with a unique CSS selector and description.\n" +
        "- ALWAYS call this before using BrowserClick or BrowserType; it gives you the exact selectors to target.\n" +
        "- Use the returned CSS selectors directly in BrowserClick or BrowserType.\n" +
        "- After a click or navigation that changes the page, call BrowserSnapshot again to get updated selectors.\n" +
        "- A page must already be loaded via BrowserNavigate before calling this tool.";

    private static readonly string BrowserClickDesc =
        "Click an element on the current page.\n\n" +
        "Usage:\n" +
        "- Pass a CSS selector from BrowserSnapshot to click a specific element. This is the most reliable approach.\n" +
        "- Alternatively, use the text= prefix to match by visible text (e.g. \"text=Sign In\", \"text=Submit\").\n" +
        "- The element is scrolled into view before clicking.\n" +
        "- After clicking, the page may change. Call BrowserSnapshot again to see the updated state.\n" +
        "- A page must already be loaded via BrowserNavigate before calling this tool.";

    private static readonly string BrowserTypeDesc =
        "Type text into an input field, textarea, or contenteditable element on the current page.\n\n" +
        "Usage:\n" +
        "- Use a CSS selector from BrowserSnapshot to identify the target input element.\n" +
        "- By default, existing content is cleared before typing. Set clear=false to append.\n" +
        "- Set submit=true to press Enter after typing.\n" +
        "- Triggers standard input/change events so frameworks detect the value change.\n" +
        "- A page must already be loaded via BrowserNavigate before calling this tool.";

    private static readonly string BrowserScrollDesc =
        "Scroll the current page up or down.\n\n" +
        "Usage:\n" +
        "- Scrolls by the specified pixel amount, or by one viewport height if amount is omitted.\n" +
        "- Use this to reveal content below the fold, load lazy-loaded content, or navigate long pages.\n" +
        "- After scrolling, call BrowserSnapshot or BrowserScreenshot to observe the newly visible content.\n" +
        "- A page must already be loaded via BrowserNavigate before calling this tool.";

    private static readonly string BrowserEvaluateDesc =
        "Execute arbitrary JavaScript in the context of the current page and return the result.\n\n" +
        "Usage:\n" +
        "- Provide a JavaScript snippet in \"code\". Use a `return` statement to return a value (e.g. `return document.title`).\n" +
        "- The code runs inside an async function, so you may use `await` directly.\n" +
        "- The return value is JSON-serialized. Non-serializable values (DOM nodes, functions, circular objects) come back as their string form.\n" +
        "- Runs in the page origin, so it can read/modify the DOM, call page APIs, and access page globals.\n" +
        "- Prefer BrowserSnapshot, BrowserClick, BrowserType, or BrowserGetContent for common actions.\n" +
        "- A page must already be loaded via BrowserNavigate before calling this tool.";

    public static void RegisterAll(ToolRegistry registry)
    {
        // BrowserNavigate
        var navigateSchema = BrowserToolSchema.CreateObjectSchema(
            new Dictionary<string, JsonElement>
            {
                ["url"] = BrowserToolSchema.CreateStringProperty(
                    "The URL to navigate to. Required when action is \"goto\". Example: \"https://example.com\" or \"http://localhost:3000\"."),
                ["action"] = BrowserToolSchema.CreateStringProperty(
                    "Navigation action: \"goto\" (default) opens a URL, \"back\"/\"forward\" navigate history, \"refresh\" reloads the current page.")
            });
        registry.Register(new BrowserToolPlaceholder("BrowserNavigate", BrowserNavigateDesc, navigateSchema));

        // BrowserGetContent
        var getContentSchema = BrowserToolSchema.CreateObjectSchema(
            new Dictionary<string, JsonElement>
            {
                ["selector"] = BrowserToolSchema.CreateStringProperty(
                    "CSS selector to scope extraction to a specific element. Omit to extract the entire page body."),
                ["type"] = BrowserToolSchema.CreateStringProperty(
                    "Output format: \"markdown\" (default) converts HTML to readable Markdown, \"html\" returns raw HTML source.")
            });
        registry.Register(new BrowserToolPlaceholder("BrowserGetContent", BrowserGetContentDesc, getContentSchema));

        // BrowserScreenshot
        var screenshotSchema = BrowserToolSchema.CreateObjectSchema(new Dictionary<string, JsonElement>());
        registry.Register(new BrowserToolPlaceholder("BrowserScreenshot", BrowserScreenshotDesc, screenshotSchema));

        // BrowserSnapshot
        var snapshotSchema = BrowserToolSchema.CreateObjectSchema(new Dictionary<string, JsonElement>());
        registry.Register(new BrowserToolPlaceholder("BrowserSnapshot", BrowserSnapshotDesc, snapshotSchema));

        // BrowserClick
        var clickSchema = BrowserToolSchema.CreateObjectSchema(
            new Dictionary<string, JsonElement>
            {
                ["selector"] = BrowserToolSchema.CreateStringProperty(
                    "CSS selector from BrowserSnapshot, or text=<visible text> to match by content.")
            },
            new[] { "selector" });
        registry.Register(new BrowserToolPlaceholder("BrowserClick", BrowserClickDesc, clickSchema));

        // BrowserType
        var typeSchema = BrowserToolSchema.CreateObjectSchema(
            new Dictionary<string, JsonElement>
            {
                ["selector"] = BrowserToolSchema.CreateStringProperty(
                    "CSS selector of the input element from BrowserSnapshot."),
                ["text"] = BrowserToolSchema.CreateStringProperty("The text to type into the element."),
                ["clear"] = BrowserToolSchema.CreateBooleanProperty(
                    "Clear existing content before typing. Default: true.", true),
                ["submit"] = BrowserToolSchema.CreateBooleanProperty(
                    "Press Enter after typing to submit the form. Default: false.", false)
            },
            new[] { "selector", "text" });
        registry.Register(new BrowserToolPlaceholder("BrowserType", BrowserTypeDesc, typeSchema));

        // BrowserScroll
        var scrollSchema = BrowserToolSchema.CreateObjectSchema(
            new Dictionary<string, JsonElement>
            {
                ["direction"] = BrowserToolSchema.CreateStringProperty(
                    "Scroll direction: \"down\" (default) or \"up\"."),
                ["amount"] = BrowserToolSchema.CreateNumberProperty(
                    "Pixels to scroll. Omit to scroll by one full viewport height.")
            });
        registry.Register(new BrowserToolPlaceholder("BrowserScroll", BrowserScrollDesc, scrollSchema));

        // BrowserEvaluate
        var evaluateSchema = BrowserToolSchema.CreateObjectSchema(
            new Dictionary<string, JsonElement>
            {
                ["code"] = BrowserToolSchema.CreateStringProperty(
                    "JavaScript to execute in the page. Use `return <expr>` to return a value; `await` is supported.")
            },
            new[] { "code" });
        registry.Register(new BrowserToolPlaceholder("BrowserEvaluate", BrowserEvaluateDesc, evaluateSchema));
    }
}
