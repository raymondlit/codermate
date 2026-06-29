import { z } from "zod";

export const LANGUAGES = [
  { id: "python", label: "Python", ext: ["py"] },
  { id: "javascript", label: "JavaScript", ext: ["js", "mjs", "ts", "tsx", "jsx"] },
  { id: "java", label: "Java", ext: ["java"] },
  { id: "cpp", label: "C++", ext: ["cpp", "cc", "cxx", "hpp", "h"] },
  { id: "c", label: "C", ext: ["c", "h"] },
  { id: "html", label: "HTML", ext: ["html", "htm"] },
] as const;

export type LanguageId = (typeof LANGUAGES)[number]["id"];

export const IssueSchema = z.object({
  category: z.enum(["syntax", "logic", "performance", "style"]),
  severity: z.enum(["error", "warning", "info"]),
  line: z.number().int().min(1).optional(),
  snippet: z.string().optional(),
  message: z.string(),
  suggestion: z.string(),
  fixedCode: z.string().optional(),
});

export const AnalysisSchema = z.object({
  overallScore: z.number().min(0).max(100),
  summary: z.string(),
  language: z.string(),
  issues: z.array(IssueSchema),
});

export type Issue = z.infer<typeof IssueSchema>;
export type Analysis = z.infer<typeof AnalysisSchema>;
