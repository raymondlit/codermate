import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getCaseById } from "./cases";

const InputSchema = z.object({
  caseId: z.string().min(1),
});

export interface GeneratedPractice {
  code: string;
  notes: string;
}

const SYSTEM_PROMPT = `你是一位 Python 财务教学助理。学生即将开始一个财务案例练习。
请根据案例信息，为学生生成一份「练习脚手架」，要求：

1. 在脚本顶部以 Python 字面量（如 dict / list / pandas.DataFrame）的形式嵌入一份贴近真实业务、规模适中的模拟数据；数据要符合该案例场景。
2. 数据之后给出清晰的 TODO 注释与函数签名，引导学生自己完成核心计算逻辑（不要直接给出完整答案）。
3. 末尾以 print 输出占位结果，方便学生填完后运行。
4. 代码风格规范，使用中文注释，导入语句完整可直接运行。
5. notes 字段用 1-2 句中文向学生说明这份模拟数据的结构与字段含义。

严格输出 JSON，无任何额外文字或 Markdown：
{
  "code": "<完整可运行的 Python 脚手架，包含模拟数据 + TODO 引导>",
  "notes": "<对模拟数据的简短说明>"
}`;

export const generatePracticeScaffold = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<GeneratedPractice> => {
    const c = getCaseById(data.caseId);
    if (!c) throw new Error("案例不存在");

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("DEEPSEEK_API_KEY 未配置");

    const userMessage = `案例标题：${c.title}
分类：${c.category}
难度：${c.difficulty}
案例描述：${c.description}
学习目标：
${c.objectives.map((o, i) => `${i + 1}. ${o}`).join("\n")}
参考代码（仅供你理解任务，不要直接复制给学生）：
\`\`\`python
${c.referenceCode}
\`\`\`

请为这位学生生成模拟数据 + 练习脚手架。`;

    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`生成失败 (${res.status})：${text.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI 返回为空");

    const Out = z.object({ code: z.string().min(1), notes: z.string().default("") });
    const parsed = Out.safeParse(JSON.parse(content));
    if (!parsed.success) throw new Error("AI 返回结构无法识别");
    return parsed.data;
  });
