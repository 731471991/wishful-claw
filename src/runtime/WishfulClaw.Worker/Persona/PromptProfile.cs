namespace WishfulClaw.Worker.Persona;

/// <summary>
/// Defines which system prompt profile to use.
/// Mirrors KodaClaw's PromptProfile.
/// </summary>
public enum PromptProfile
{
    /// <summary>
    /// Normal conversation — includes persona, environment, tools, project context.
    /// </summary>
    Main,

    /// <summary>
    /// AI persona generation — minimal prompt, no persona injection.
    /// Used by PersonaGenerator (iteration 6, plan 6-7).
    /// </summary>
    Bootstrap
}
