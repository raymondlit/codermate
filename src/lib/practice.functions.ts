import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const IssueSummarySchema = z.object({
  category: z.enum(["syntax", "logic", "performance", "style"]),
  severity: z.enum(["error", "warning", "info"]),
  message: z.string(),
});

const SaveInput = z.object({
  caseId: z.string().min(1),
  caseTitle: z.string().min(1),
  caseCategory: z.string().min(1),
  language: z.string().min(1),
  code: z.string().min(1),
  score: z.number().int().min(0).max(100),
  durationSeconds: z.number().int().min(0),
  issues: z.array(IssueSummarySchema),
  aiSummary: z.string().optional(),
});

export interface AttemptStat {
  case_id: string;
  attempt_count: number;
  last_score: number;
  best_score: number;
  last_at: string;
}

export const saveAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SaveInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("practice_attempts").insert({
      user_id: userId,
      case_id: data.caseId,
      case_title: data.caseTitle,
      case_category: data.caseCategory,
      language: data.language,
      code: data.code,
      score: data.score,
      duration_seconds: data.durationSeconds,
      issue_count: data.issues.length,
      issues_summary: data.issues,
      ai_summary: data.aiSummary ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyAttemptStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AttemptStat[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("practice_attempts")
      .select("case_id, score, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const map = new Map<string, AttemptStat>();
    for (const r of data ?? []) {
      const prev = map.get(r.case_id);
      if (!prev) {
        map.set(r.case_id, {
          case_id: r.case_id,
          attempt_count: 1,
          last_score: r.score,
          best_score: r.score,
          last_at: r.created_at,
        });
      } else {
        prev.attempt_count += 1;
        prev.best_score = Math.max(prev.best_score, r.score);
      }
    }
    return Array.from(map.values());
  });

export interface GapResource {
  type: "article" | "video";
  title: string;
  description: string;
  url: string;
}

export interface GapReport {
  totalAttempts: number;
  averageScore: number;
  weakTopics: Array<{ topic: string; reason: string }>;
  recommendations: string;
  resources: GapResource[];
}

const GAP_SYSTEM_PROMPT = `你是一位 Python 编程教学顾问。给你一组学生的练习记录（含分数与 AI 检出的问题摘要），请：
1. 提炼出 2-4 个该学生最薄弱的知识点 / 易错点（中文）。
2. 给出 2-3 句总体学习建议。
3. 推荐 3-5 个学习资源，每个资源包含 type（"article" 或 "video"）和 query：
   - article：可读性强的中文技术教程关键词（用于站内/搜索引擎查找）
   - video：用于 Bilibili 搜索的中文关键词（要紧扣薄弱点，例如 "Python pandas 数据透视表 教程"）

严格输出 JSON：
{
  "weakTopics": [{"topic": "...", "reason": "..."}],
  "recommendations": "...",
  "resources": [
    {"type": "video", "title": "推荐的视频主题", "description": "为什么看这个", "query": "B 站搜索关键词"},
    {"type": "article", "title": "推荐文章主题", "description": "...", "query": "文章搜索关键词"}
  ]
}`;

const ResourceOut = z.object({
  type: z.enum(["article", "video"]),
  title: z.string(),
  description: z.string(),
  query: z.string(),
});
const GapOut = z.object({
  weakTopics: z.array(z.object({ topic: z.string(), reason: z.string() })).default([]),
  recommendations: z.string().default(""),
  resources: z.array(ResourceOut).default([]),
});

export const analyzeMyGaps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GapReport> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("practice_attempts")
      .select("case_title, case_category, score, issues_summary, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);

    const attempts = data ?? [];
    if (attempts.length === 0) {
      return {
        totalAttempts: 0,
        averageScore: 0,
        weakTopics: [],
        recommendations: "尚无练习记录。请先到「财务案例库」选择一个案例完成练习，然后再来查看个性化学习建议。",
        resources: [],
      };
    }

    const avg = Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length);

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("DEEPSEEK_API_KEY 未配置");

    const userMessage = `学生最近 ${attempts.length} 次练习：\n` +
      attempts
        .map((a, i) => {
          const issues = (a.issues_summary as Array<{ category: string; message: string }> | null) ?? [];
          const issueText = issues.slice(0, 5).map((x) => `[${x.category}] ${x.message}`).join("； ") || "无明显问题";
          return `${i + 1}. 《${a.case_title}》(${a.case_category}) 得分 ${a.score} → 问题：${issueText}`;
        })
        .join("\n");

    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: GAP_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
        temperature: 0.5,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`AI 分析失败 (${res.status})：${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI 返回为空");

    const parsed = GapOut.safeParse(JSON.parse(content));
    if (!parsed.success) throw new Error("AI 返回结构无法识别");

    const resources: GapResource[] = parsed.data.resources.map((r) => ({
      type: r.type,
      title: r.title,
      description: r.description,
      url:
        r.type === "video"
          ? `https://search.bilibili.com/all?keyword=${encodeURIComponent(r.query)}`
          : `https://www.bing.com/search?q=${encodeURIComponent(r.query)}`,
    }));

    return {
      totalAttempts: attempts.length,
      averageScore: avg,
      weakTopics: parsed.data.weakTopics,
      recommendations: parsed.data.recommendations,
      resources,
    };
  });
