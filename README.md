# tokenyUI

Tokeny-style workspace UI plugin for DeepSeek Harness desktop 0.2.2-rc.1.

The installable desktop bundle is published in GitHub Releases:

```powershell
dsh plugin --profile desktop add https://github.com/tokeny-ai/tokenyUI/releases/download/v0.2.2-rc.1-tokeny.6/tokeny-ai-dsh-client-tokeny-ui-0.2.2-rc.1-tokeny.6.tgz
```

The package keeps the native DeepSeek logo and adds project switching, a workspace file tree, Tokeny themes, and input companions. It scopes the session list to the selected workspace.

For a direct GitHub Release install, download the `.tgz` asset from the Releases page and run:

```powershell
dsh plugin --profile desktop add .\tokeny-ai-dsh-client-tokeny-ui-<version>.tgz
```

The source package lives under `packages/client/tokeny-ui`. Release artifacts are built with the DeepSeek Harness desktop build script and target desktop `0.2.2-rc.1`.
