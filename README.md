# dsh-zh-reasoning

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/zhy201810576/dsh-zh-reasoning?style=social)](https://github.com/zhy201810576/dsh-zh-reasoning)

让 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的**思考（reasoning）与最终回答**默认使用简体中文的中文插件。

> 基于 [imlishiyuan/deepseek-harness-zh-cn](https://github.com/imlishiyuan/deepseek-harness-zh-cn)（Apache-2.0）修改：
> 补上标准插件结构（`cordis.patch.yml` bundle 补丁层 + `dsh.bundle.patch` 清单字段 + `files` 打包），
> 并改名为 `dsh-zh-reasoning`，使插件可用标准方式挂载、发布与更新。

## 功能特性

- 在模型每个会话的第一步（`agent/pre-step`）注入 `<system-reminder>` 指令，要求：
  - 思考（reasoning）与最终回答使用简体中文；
  - 计划、工具调用、总结、代码注释同样使用中文；
  - 仅代码、命令、文件路径、变量名、API 名称等保留英文；
  - 除非用户明确要求其他语言，否则规则优先。
- 同时影响模型的**最终回答**与**思维链（reasoning）**。
- 标准插件结构，支持 `dsh plugin` 挂载、npm 发布与更新。

> 说明：harness 与 DeepSeek API 没有强制推理语言的开关；全中文提示词能最大化概率，但不保证 100%。

## 安装 / 挂载

**方式一：npm 发布后（推荐）**

```sh
dsh plugin --profile <name> add dsh-zh-reasoning
```

**方式二：从 GitHub 直接安装**

```sh
dsh plugin --profile <name> add "dsh-zh-reasoning@git+https://github.com/zhy201810576/dsh-zh-reasoning.git"
```

**方式三：本地开发（`file:` 依赖）** 在 profile 的 `package.json` 中添加依赖并加入 bundles：

```json
{
  "dependencies": { "dsh-zh-reasoning": "file:../dsh-zh-reasoning" },
  "dsh": { "profile": { "bundles": [ "...", "dsh-zh-reasoning" ] } }
}
```

然后在该 profile 目录执行 `pnpm install` 并重启 `dsh web`。

**方式四：直接本地挂载（无需安装）** 在 `~/.dsh/profiles/<name>/cordis.patch.yml` 中：

```yaml
- insert:
    - id: dsh-zh
      name: 'file:///绝对路径/dsh-zh-reasoning/lib/index.js'
```

## 验证

```sh
dsh --profile <name> --dump-config | findstr dsh-zh
```

看到 `dsh-zh` 行即表示已挂载。之后新建会话，模型应以简体中文思考与回答。

## 目录结构

```
dsh-zh-reasoning/
├── lib/
│   └── index.js        # 插件入口：在 agent/pre-step 注入中文 system-reminder
├── cordis.patch.yml    # bundle 补丁层：声明插件挂载行
├── package.json        # npm 包清单（含 dsh.bundle.patch 字段）
├── pnpm-lock.yaml      # 依赖锁定文件
├── LICENSE             # Apache-2.0 许可证
└── README.md
```

## 开发

```sh
pnpm install        # 安装 @deepseek-ai/dsh-llm（仓库自包含）
node -e "import('file:///绝对路径/dsh-zh-reasoning/lib/index.js').then(m=>console.log(m.name))"
```

## 协议

[Apache-2.0](LICENSE)，保留原作者版权声明。
