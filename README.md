# tokenyUI

Tokeny-style workspace UI for DeepSeek Harness desktop. The plugin keeps the native DeepSeek logo and window controls, then adds project switching, a workspace file tree, project-scoped sessions, Tokeny themes, and an input companion.

> **Community plugin:** tokenyUI is published by Tokeny AI and is not an official DeepSeek plugin. It does not change the DeepSeek logo or send model requests of its own.

![tokenyUI workspace](packages/client/tokeny-ui/src/desktop/assets/hero.png)

## What it adds

| Area | Behavior |
| --- | --- |
| Project bar | Switch or add projects from the native title bar. |
| Workspace | Browse the active project's files and open native previews. |
| Sessions | The Workspace tab shows only sessions belonging to the selected project. |
| Appearance | Choose Tokeny palettes plus Light, Dark, or System mode. |
| Input companion | Choose one of seven local sprite pets and control sleep, walking, and visibility. |

![Project switcher](packages/client/tokeny-ui/src/desktop/assets/project-switcher.png)

![Themes and appearance](packages/client/tokeny-ui/src/desktop/assets/themes.png)

![Input companion](packages/client/tokeny-ui/src/desktop/assets/pet.png)

## Install the desktop release

Use the matching DeepSeek Harness desktop `0.2.2-rc.1` runtime. The CLI bundled with the desktop app installs the GitHub Release asset:

```powershell
dsh plugin --profile desktop add https://github.com/tokeny-ai/tokenyUI/releases/download/v0.2.2-rc.1-tokeny.7/tokeny-ai-dsh-client-tokeny-ui-0.2.2-rc.1-tokeny.7.tgz
```

Restart Harness after installation. The [v0.2.2-rc.1-tokeny.7 release](https://github.com/tokeny-ai/tokenyUI/releases/tag/v0.2.2-rc.1-tokeny.7) contains the tarball and a SHA-256 checksum asset. To remove the layout bundle, run `dsh plugin --profile desktop remove @tokeny-ai/dsh-client-tokeny-ui` and restart Harness.

## Source and compatibility

The source package is under [`packages/client/tokeny-ui`](packages/client/tokeny-ui). The desktop adapter targets DeepSeek Harness desktop `0.2.2-rc.1`; the legacy Web adapter targets the separate `0.1.0-rc.5` client APIs. Read the [desktop guide](packages/client/tokeny-ui/src/desktop/README.md) for behavior, limitations, and verification details.

The package is MIT licensed. See [`plugin-catalog.json`](plugin-catalog.json) for machine-readable distribution metadata and [`docs/community/announcement.md`](docs/community/announcement.md) for a shareable announcement.
