# tokenyUI 社区公告

## 短文案

tokenyUI 为 DeepSeek Harness 桌面版带来 Tokeny 风格的工作区：在标题栏切换项目，浏览当前工作区文件，让每个项目只显示自己的会话列表，选择配色，并在输入框旁添加小宠物。它保留原生 DeepSeek logo 和窗口控件。

使用 Harness 自带 CLI 安装预发布版本：

```powershell
dsh plugin --profile desktop add https://github.com/tokeny-ai/tokenyUI/releases/download/v0.2.2-rc.1-tokeny.7/tokeny-ai-dsh-client-tokeny-ui-0.2.2-rc.1-tokeny.7.tgz
```

截图和源码：<https://github.com/tokeny-ai/tokenyUI>

兼容版本：DeepSeek Harness 桌面版 `0.2.2-rc.1`。tokenyUI 是 Tokeny AI 发布的社区插件，不是 DeepSeek 官方插件。

## 推荐发布结构

1. 先说清问题：项目、文件和会话放在同一个工作区外壳里，更容易浏览和切换。
2. 依次展示主截图、项目切换器和主题面板。
3. 在同一条内容中写出兼容版本和安装命令。
4. 链接到 Release；用户报告问题时，请附 Harness 版本、操作系统和复现步骤。

请使用仓库里的公开截图，不要上传含有本地项目名、账号名、文件系统路径或凭据错误的原始截图。
