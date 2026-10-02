# MCP Hub 前端插件

## 安装与配置

仓库：https://github.com/dividduang/mcphub_ui；必须配合后端 https://github.com/dividduang/mcphub 使用。

将本仓库根目录的内容放入 FBA UI 的 `apps/web-antdv-next/src/plugins/mcphub/`，不要再套仓库目录。需要支持现有插件 route/page 自动发现的 FBA UI、Ant Design Vue 与现有 `requestClient`；本插件无额外 npm 依赖。不覆盖主工程环境文件或 lock，沿用现有后端 API 地址配置。后端运行迁移生成菜单，并按后端 README 配置 `MCPHUB_PUBLIC_BASE_URL`。

## 使用

登录 FBA 后打开 **MCP Hub**（`/plugins/mcphub`）。本插件使用现有 `requestClient` 的 FBA JWT 与响应解包，不需要新增依赖。

1. **服务目录**显示真实注册服务、工具说明、可用状态、参数 Schema 和后端提供的绝对 MCP 端点。展开“客户端配置（Bearer API Key）”可复制含 `<YOUR_MCP_KEY>` 占位符的配置；这是私有 Bearer Key 接入，不是 OAuth 登录。
2. **我的工具申请 → 申请工具**，按服务选择工具。管理员预授权工具可以自动授予，其余保持待处理。记录展示本次实际授予项；“已授权工具”展示当前授权。
3. **我的 MCP Keys → 创建 MCP Key**，填写名称、可选本地到期时间，并从当前可用、已获批工具中选择显式范围。时间提交为带时区 ISO8601。秘密只在本次弹窗出现；关闭、组件卸载或页面停用后清空内存值，不保存在 URL、localStorage 或日志。
4. 每把 Key 可独立停用、启用、修改名称、收缩范围、永久撤销。旧 Key 不可扩大范围，新增范围需创建新 Key。列表区分历史显式绑定与当前有效工具；操作后重取后端数据。过期 Key 即使显示“已启用”也会标记“已过期”。
5. `metadata.can_manage=true` 才出现服务/工具启停、自动授予政策、所有用户申请处理及用户授权管理。管理员直接授予使用 FBA 用户管理中的完整十进制用户 ID，不转换成 JavaScript number。撤权后重新授予不会自动恢复旧 Key 绑定。

网络失败由现有 requestClient 显示后端错误；列表有加载/失败/空态，写操作仅在实际成功后显示成功。服务、工具、政策变更和永久撤销均要求确认。权限始终以后端为准，前端隐藏按钮不是授权边界。

## 菜单与发现

现有 `src/router/routes/index.ts` 自动发现 `plugins/**/routes/*.ts`；`src/router/access.ts` 自动发现插件 Vue 页面，无需更改全局入口。

- route name：`PluginMcpHub`
- route path：`/plugins/mcphub`
- 菜单 component：`/plugins/mcphub/views/index`
- title：`MCP Hub`
- icon：`lucide:network`
- 管理按钮权限：`sys:mcphub:manage`，只分配给授权管理角色；个人页面不依赖该权限。
- REST：`/api/v1/mcphub`；管理必须 FBA 登录 JWT，MCP Key 不用于管理请求。
- MCP URL 由后端 catalog.endpoint 提供，部署须配置正确的 `MCPHUB_PUBLIC_BASE_URL`；不要把前端开发端口当作 MCP 端点。

## 发布与验收

2026-10-02：新增真实目录、申请/处理、授权/撤权、Key 范围隔离管理与安全配置复制。未改既有 api_key 插件、环境文件或依赖锁。

原开发工作区集成后已完成类型检查、构建与 CDP 真实表单验收；这不代表任意 FBA UI 版本均已验证。上传前检查发现主工程已有 API Key 空接口阻断全仓库 Oxlint，且 Oxfmt 与 ESLint Vue 换行规则冲突；未修改全局规则，本插件保留 ESLint 修正结果。全仓库 lint 不宣称通过。

## 卸载与反馈

停止前端开发或部署服务后移除 `src/plugins/mcphub/` 内容，重新构建，按后端卸载说明处理菜单。仅卸载前端不会撤销后端授权或 MCP Key；需要停止调用时应先在后端撤销 Key 或禁用服务。

反馈：https://github.com/dividduang/mcphub_ui/issues。附前后端版本与脱敏错误，不上传 MCP Key、JWT、用户数据或私有环境配置。仓库公开上传不等于插件市场收录，市场 PR 尚未提交。
