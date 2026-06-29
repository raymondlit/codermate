import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AnalysisSchema, type Analysis } from "./analyze.types";

const InputSchema = z.object({
  language: z.string().min(1),
  code: z.string().min(1).max(20000),
});

const SYSTEM_PROMPT = `你是一位严谨的资深代码审查专家。用户会提交一段代码与编程语言，你需要从以下维度进行分析：

1. 语法错误（syntax）：标点、关键字拼写、括号匹配、缩进、缺少分号/冒号等
2. 逻辑错误（logic）：算法错误、边界条件、空值处理、死循环等
3. 性能问题（performance）：算法复杂度、不必要的循环、重复计算、内存浪费等
4. 风格建议（style）：命名规范、代码简洁性、可读性

严格输出符合以下 JSON Schema 的对象，不要输出任何额外文字、Markdown 或解释：

{
  "overallScore": <0-100 的整数，代码整体质量评分>,
  "summary": "<一句中文总评，不超过 60 字>",
  "language": "<语言名>",
  "issues": [
    {
      "category": "syntax" | "logic" | "performance" | "style",
      "severity": "error" | "warning" | "info",
      "line": <可选，问题所在行号，从 1 开始>,
      "snippet": "<可选，问题代码片段>",
      "message": "<问题描述，中文>",
      "suggestion": "<修改建议，中文>",
      "fixedCode": "<可选，修复后的完整可替换代码片段>"
    }
  ]
}

如代码完美无误，issues 返回空数组并给予高分。最多返回 8 条问题，按 severity 从高到低排序。`;

export const analyzeCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<Analysis> => {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error("DEEPSEEK_API_KEY 未配置，请在 Lovable 项目密钥中添加。");
    }

    const userMessage = `编程语言：${data.language}\n\n代码：\n\`\`\`${data.language}\n${data.code}\n\`\`\``;

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
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`DeepSeek 调用失败 (${res.status})：${text.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("DeepSeek 返回为空");

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("DeepSeek 返回的不是合法 JSON");
    }

    const result = AnalysisSchema.safeParse(parsed);
    if (!result.success) {
      // Fallback: try to coerce partial responses
      const loose = z
        .object({
          overallScore: z.coerce.number().default(0),
          summary: z.string().default(""),
          language: z.string().default(data.language),
          issues: z.array(z.any()).default([]),
        })
        .safeParse(parsed);
      if (!loose.success) throw new Error("AI 返回结构无法识别");
      return AnalysisSchema.parse({
        overallScore: Math.max(0, Math.min(100, Math.round(loose.data.overallScore))),
        summary: loose.data.summary || "分析完成",
        language: loose.data.language,
        issues: [],
      });
    }
    return result.data;
  });
