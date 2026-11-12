# tokenyUI community announcement

## Short post

tokenyUI brings a Tokeny-style workspace to DeepSeek Harness desktop: switch projects from the title bar, browse the active workspace files, keep each project's sessions together, choose a palette, and add a small input companion. It keeps the native DeepSeek logo and window controls.

Install the prerelease with the bundled Harness CLI:

```powershell
dsh plugin --profile desktop add https://github.com/tokeny-ai/tokenyUI/releases/download/v0.2.2-rc.1-tokeny.7/tokeny-ai-dsh-client-tokeny-ui-0.2.2-rc.1-tokeny.7.tgz
```

Screenshots and source: <https://github.com/tokeny-ai/tokenyUI>

Compatibility: DeepSeek Harness desktop `0.2.2-rc.1`. tokenyUI is a Tokeny AI community plugin, not an official DeepSeek plugin.

Use the Release `.tgz` URL in the command. Do not pass the repository URL as the package source; pnpm can resolve that form through Git SSH.

## Suggested post structure

1. Lead with the problem: projects, files, and sessions are easier to scan when they share one workspace shell.
2. Show the hero screenshot, then the project switcher and theme panel.
3. State the compatibility version and install command in the same post.
4. Link to the release and ask users to report their Harness version, operating system, and reproduction steps with bug reports.

Use the screenshots in the repository instead of screenshots containing local project names, account names, filesystem paths, or credential errors.
