# NotionPub CLI

## Notion 文档

- **PRD 文档** — 产品需求文档，定义用户画像、功能优先级、核心假设与验证计划、产品路线图
  https://www.notion.so/qhhdf/notion-publish-cli-PRD-3425097bfa3a80ff9d65ef0a5ca934fa

- **架构设计文档** — 技术架构，定义系统分层、AST 数据结构、Adapter 接口、模块职责、目录结构、CLI 命令设计、测试策略
  https://www.notion.so/qhhdf/notion-publish-cli-3425097bfa3a804eb51bcaee6eb1cae9

- **飞书 Adapter 技术方案** — 飞书发布的具体实现方案，基于 publish-dev-doc 脚本逆向分析和飞书 MCP 工具能力，核心结论：走 MCP 而非 REST API 直连，AST → 飞书扩展 Markdown → MCP create/update
  https://www.notion.so/qhhdf/3425097bfa3a80aea665e8d2581c9e1b
