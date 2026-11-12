---
description: "Install the Tokeny project switcher, activity sidebar, workspace file tree, and session navigation in Harness."
kind: "package-bundle"
---

# tokenyUI

English | [中文](README.zh.md)

## Summary

`tokenyUI` gives Harness a Tokeny-style workspace: a centered project switcher, a slim activity sidebar, and a resizable left panel for files and sessions. Search projects by name or path, preview text files, and find, rename, or archive the current project's sessions. Existing Harness conversations, tool details, settings, and plugin panels remain available through their slots. The optional package is installed into the `web` profile and takes effect after a restart.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Use the supplied tarball with the matching Harness `0.1.0-rc.5` installation. From the folder containing the tarball, install it into the profile:

```sh
dsh plugin --profile web add ./tokeny-ai-dsh-client-tokeny-ui-0.2.2-rc.1-tokeny.6.tgz
```

Restart Harness Web after installation. The package's profile layer replaces the default layout and sidebar; it does not require edits to the core conversation plugins. The first installation can download npm dependencies. Select **Add project**, enter an absolute folder path on the Harness host, and open the project. The file tree lists real directories; select a UTF-8 text file to open its read-only preview.

The left panel starts at 360 px and resizes between 340 and 720 px. Its selected tab, collapsed state, width, and expanded directories persist in this browser. Project selection and session actions use Harness's workspace and session services. **Manage all projects and sessions** opens the original Harness workspace controls. Appearance and language follow Harness settings.

To restore the default shell, remove the package and restart Harness Web:

```sh
dsh plugin --profile web remove @tokeny-ai/dsh-client-tokeny-ui
```

Disabling only the runtime plugin leaves the profile's default shell rows disabled; remove the bundle to restore those rows.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The [profile patch](cordis.patch.yml) disables `ui-layout` and `ui-sidebar` and inserts `tokenyUI`. The [browser assembly](src/client/index.ts) owns the root and sidebar slots while composing their existing conversation, details, settings, and overlay contributions. A shared slot store carries viewing preferences; business state stays in the Harness runtime. All shell code, palette overrides, Chinese and English copy, and filesystem RPC are shipped in this package.

The [host entry](src/index.ts) registers a trusted-host Connection channel for registered workspace IDs and relative paths. It rejects traversal and symbolic links, bounds directory responses, and renders preview content as text. `maxEntries` defaults to 2,000 entries per directory, with a configurable range of 1–20,000. `maxPreviewBytes` defaults to 262,144 bytes, with a range of 1,024–4,194,304. Configure these fields on the `tokenyUI` row. Mounted views cancel superseded requests. Plugin effects retract registrations and theme projection on disposal.

See the [shell decision](../../../.agents/notes/implemented/feature/2026-11-07-tokeny-ui-shell.md) for composition and ownership constraints.

</details>

-----

<a id="model-experience"></a>
## Model Experience

None, as the shell and file previews do not add prompts, tools, or model request content.

#### KV Cache effect

None; this package neither assembles nor sends provider requests.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- File browsing targets the Harness host's local filesystem. Native folder selection depends on the host's directory-picker provider; the absolute-path form also works when a native dialog is unavailable.
- Previews are read-only UTF-8 text. Editing, binary previews, and browsing remote sandbox filesystems are outside this package's scope. Directory listings are capped, and changes require **Refresh files**.
- The shell retains Harness's conversation renderer and welcome content. Tokeny's native window controls, embedded applications, and editor features are not ported.
- Panel preferences belong to the browser origin. A different browser or server port starts with fresh panel preferences.

<a id="dev-note"></a>
### Dev Note

None.
