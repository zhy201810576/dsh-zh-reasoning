# dsh-zh-reasoning 适配新版 DSH 迁移经验

## 背景与结论

DSH 从 `0.0.1-rc.x` 升级到 `0.1.2-rc.x`，`@deepseek-ai/dsh-llm` 从 `0.0.1-rc.1`（`publishConfig.access: restricted`）升级到 `0.1.2-rc.1`（`public`）。插件依赖旧版会导致 peer 依赖冲突 / 重复安装，需同步升级依赖并核对事件契约。

## 依赖升级

| 项 | 旧 | 新 |
| --- | --- | --- |
| `@deepseek-ai/dsh-llm`（dependencies） | `0.0.1-rc.1` | `^0.1.2-rc.1` |
| `@deepseek-ai/dsh-llm`（peerDependencies） | `*`（optional） | `^0.1.2-rc.1` |

新版 `dsh-llm` 的 peer 依赖大幅简化（从 cordis / dsh-brand / dsh-attachment / dsh-invariants / dsh-timeout 一堆，变成只有 `@deepseek-ai/cordis@^4.0.2`），licence 也从 BSD-3-Clause 变为 MIT。

## 关键 API 变化点（核对 in-box 插件源码确认）

1. `createUserMessage({ content, source })` 签名不变，输出 `{ role:'user', content, source, id }`。
2. `source: { kind:'plugin', plugin, form:'snapshot', sections:[{name,text}] }` 形状仍有效（新版 `dsh-time-context` 仍这么写）。
3. `agent/pre-step` 事件契约不变（context 含 `messages / turn / step / signal / agent`），但 **decision 可能携带 `startsRequestSeries` 等下游字段**（由 `dsh-goal-round-driver` / `dsh-tool-cordis` 设置，`dsh-agent-loop` 消费）。旧代码硬编码 `return { kind:'enter', messages }` 会丢弃这些字段，必须改为 `return { ...decision, messages:[...decision.messages, ...] }`。
4. `system-prompt/assemble` 仍是 scoped waterfall，`context.agent` 仍存在（`assembleContextFor` 注入）。

**权威参照**：新版 DSH 自带的 `dsh-time-context`、`dsh-agent-instructions` 两个插件就是 pre-step 注入的活样板，适配时直接对着它们的 `ctx.on('agent/pre-step', ...)` 写。

## 排查「插件不生效」的方法论（按序）

1. 查 profile `package.json` 的 `dependencies` **和** `dsh.profile.bundles`（两者都要有插件名）。
2. 查 profile 自己的 `cordis.patch.yml`。
3. 查 `node_modules/<plugin>`（profile 目录 + `profiles/node_modules` 共享 fallback）。
4. 若被移除，用 `dsh-config-manager` 追溯：
   - `~/.dsh/dsh-config-manager/transactions/completed/*.json`：找 `operationType: "import-apply"`，看某插件的 `status`，`skipped` = 没真正装上。
   - `~/.dsh/dsh-config-manager/sync/snapshots/*/plugins/plugins.json`：这是「期望状态」，能确认插件本应装（`enabled:true` + spec）。

## 修复经验（Windows + DSH 沙箱）

1. **`dsh plugin add "file:带空格路径"` 会失败**：`dsh plugin` 在 Windows 用 `spawnSync('pnpm', args, { shell: true })`，Node 把 args 按空格拼接且不转义，空格被 shell 拆开。这与 pnpm 无关——JSON 里写 `file:E:/Web Project/...`（带空格）能正常 `pnpm install`。
2. **解决空格路径**：
   - 首选：手动编辑 profile `package.json`（JSON 里空格没问题）+ `pnpm install`，且与 config-manager 同步快照里的长路径 spec 一致。
   - 备选：8.3 短路径（PowerShell `(New-Object -ComObject Scripting.FileSystemObject).GetFolder($path).ShortPath`）绕过空格，但会记录短路径、与同步快照不一致。
3. **沙箱提权**：修改 `C:\Users\coder\.dsh\profiles\web`（工作区外）需 `danger-full-access`；edit 和 pwsh 各需单独提权。
4. **pnpm frozen-lockfile**：设 `CI=true` 时 pnpm 默认 `frozen-lockfile`，手动改 package.json 后要加 `--no-frozen-lockfile`，否则报 `ERR_PNPM_OUTDATED_LOCKFILE`。
5. **验证清单**：node_modules 里插件版本、`dsh.bundle.patch` 字段、`cordis.patch.yml`、profile 里 `@deepseek-ai/dsh-llm` 版本（应为 `0.1.2-rc.1`）。

## 可复用要点

- 插件「不生效」九成是没挂载（dependencies / bundles 缺失），先查挂载再怀疑代码。
- pre-step 插件一律 `{ ...decision, messages }` 展开，别重建 decision。
- 适配新版 DSH，先读 in-box 插件源码当契约参照，别猜 API。
