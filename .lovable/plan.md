## MVP 范围：聚焦「模块二 · AI 代码纠错与优化」

把首期范围收敛到**一个端到端可用的代码纠错工作台**。其他四个模块（案例库、闭环管理、画像报告）作为后续迭代，本期不做。

### MVP 必须具备
1. 顶部语言选择器：C / C++ / Python / Java / JavaScript / HTML
2. 代码输入：粘贴 + 文件上传（拖拽/点击）
3. DeepSeek 一键分析，返回结构化结果
4. 结果可视化：
   - 语法错误卡（行号 + 错误片段 + 建议）
   - 逻辑/性能卡（问题描述 + 重构建议）
   - 整体评分 + 摘要
5. 原研哉风格 UI（米白底、克制配色、大留白、无衬线字体）

### MVP 不做（明确排除）
- ❌ 案例库 / Python 沙箱执行（Judge0）
- ❌ 课前-课中-课后闭环
- ❌ 学生画像、报告、雷达图
- ❌ 历史记录持久化（仅当前会话内有效）
- ❌ 登录、数据库

---

## 技术清单

| 项 | 选型 |
|---|---|
| 框架 | TanStack Start (已有模板) |
| 样式 | Tailwind v4 + 自定义原研哉 token |
| 字体 | Noto Sans SC + Inter (`@fontsource`) |
| 代码编辑器 | `@uiw/react-codemirror` + 各语言扩展 |
| 状态 | 局部 `useState` 即可 |
| 图标 | `lucide-react` |
| AI 调用 | `createServerFn` → DeepSeek `https://api.deepseek.com/v1/chat/completions`，模型 `deepseek-chat`，`response_format: json_object` |
| 密钥 | `DEEPSEEK_API_KEY`（用 add_secret 引导用户填入） |

---

## 文件清单

新增：
- `src/routes/index.tsx`（替换占位首页 → 直接作为工作台入口）
- `src/components/LanguageSelector.tsx`
- `src/components/CodeInput.tsx`（含粘贴 Tab + 拖拽上传 Tab + CodeMirror）
- `src/components/AnalysisResults.tsx`（卡片列表渲染）
- `src/components/ScoreCard.tsx`
- `src/components/IssueCard.tsx`
- `src/lib/analyze.functions.ts`（DeepSeek server function + Zod schema）
- `src/lib/analyze.types.ts`（共享类型）

修改：
- `src/styles.css`：加入原研哉设计 token（#FAF9F6 / #2B2B2B / #8A8784 / 墨蓝强调 #1F3A5F、圆角 4px、淡阴影）
- `src/routes/__root.tsx`：更新 SEO meta，加载字体 `<link>`

依赖安装：
```
@uiw/react-codemirror @codemirror/lang-python @codemirror/lang-javascript @codemirror/lang-cpp @codemirror/lang-java @codemirror/lang-html lucide-react @fontsource/inter @fontsource/noto-sans-sc zod
```

---

## DeepSeek 返回结构（Zod schema）

```ts
{
  overallScore: number,         // 0-100
  summary: string,              // 一句话总评
  language: string,
  issues: [{
    category: "syntax" | "logic" | "performance" | "style",
    severity: "error" | "warning" | "info",
    line?: number,
    snippet?: string,
    message: string,
    suggestion: string,
    fixedCode?: string
  }]
}
```

System prompt 用中文，要求模型严格输出该 JSON。

---

## 里程碑（建议分 4 轮迭代）

**M1 · 视觉与骨架**（本次构建）
- 安装依赖、字体
- 写入原研哉设计 token
- 替换首页 → 工作台壳（语言选择器 + 两栏布局占位 + 顶部标题）
- 完成 `CodeInput`（粘贴 + 上传 + 语法高亮）
- 通过：能上传 / 粘贴代码并切换语言

**M2 · 接入 DeepSeek**
- 引导添加 `DEEPSEEK_API_KEY`
- 实现 `analyzeCode` server function（含 Zod 校验、错误处理）
- 「开始分析」按钮接通
- 通过：粘贴一段错误 Python，能在 5-10 秒内返回结构化 JSON

**M3 · 结果可视化**
- `ScoreCard` + `IssueCard` 组件
- 错误按 severity 分组、行号高亮
- 「应用建议」按钮：把 `fixedCode` 回填到编辑器
- 通过：完整跑通「输入 → 分析 → 看到卡片 → 一键修复」

**M4 · 打磨**
- 加载状态（骨架屏，无旋转 spinner，符合克制风格）
- 错误状态（API 失败、密钥未配置）
- 空状态提示
- 响应式（桌面 + 平板）

---

## 验收标准
- 在 6 种语言下都能提交并收到结果（至少 Python / JS / Java 实测）
- 故意写错的标点能被准确指出行号
- 一段冗余代码能收到「更简洁写法」建议
- UI 在 1440 与 768 宽度下排版正常
- 无登录、无后端数据库，刷新即清空

---

接下来我会从 **M1 视觉与骨架** 开始构建；M2 开始时会让你填入 DeepSeek API Key。确认后开工。
