import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2, AlertCircle, LogIn, LogOut, User, BookOpen, LineChart, CheckCircle2 } from "lucide-react";
import { LanguageSelector } from "@/components/LanguageSelector";
import { CodeInput, type CodeInputHandle } from "@/components/CodeInput";
import { AnalysisResults } from "@/components/AnalysisResults";
import { analyzeCode } from "@/lib/analyze.functions";
import type { Analysis, LanguageId } from "@/lib/analyze.types";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { saveAttempt } from "@/lib/practice.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CodeMentor AI · 智能代码纠错与优化" },
      {
        name: "description",
        content:
          "面向编程学习者的 AI 代码诊断助手 —— 即时发现语法错误，给出更简洁、更高效的优化建议。",
      },
      { property: "og:title", content: "CodeMentor AI · 智能代码纠错与优化" },
      {
        property: "og:description",
        content: "面向编程学习者的 AI 代码诊断助手。",
      },
    ],
  }),
  component: Workbench,
});

function Workbench() {
  const [language, setLanguage] = useState<LanguageId>("python");
  const [code, setCode] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeInputRef = useRef<CodeInputHandle>(null);
  const [practice, setPractice] = useState<{
    caseId?: string;
    caseTitle?: string;
    caseCategory?: string;
    notes?: string;
  } | null>(null);
  const startedAtRef = useRef<number>(Date.now());
  const [saved, setSaved] = useState(false);

  // 从案例库带过来的练习初始化
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("codementor:practice");
      if (!raw) return;
      sessionStorage.removeItem("codementor:practice");
      const payload = JSON.parse(raw) as {
        language?: LanguageId;
        code?: string;
        caseId?: string;
        caseTitle?: string;
        caseCategory?: string;
        notes?: string;
      };
      if (payload.language) setLanguage(payload.language);
      if (payload.code) setCode(payload.code);
      if (payload.caseTitle || payload.notes) {
        setPractice({
          caseId: payload.caseId,
          caseTitle: payload.caseTitle,
          caseCategory: payload.caseCategory,
          notes: payload.notes,
        });
      }
      startedAtRef.current = Date.now();
    } catch {
      /* ignore */
    }
  }, []);

  const analyze = useServerFn(analyzeCode);
  const saveAttemptFn = useServerFn(saveAttempt);
  const canAnalyze = code.trim().length > 0 && !loading;
  const auth = useAuth();

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setSaved(false);
    try {
      const result = await analyze({ data: { language, code } });
      setAnalysis(result);
      // 自动记录练习结果
      if (auth.user && practice?.caseId && practice.caseTitle && practice.caseCategory) {
        const duration = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        try {
          await saveAttemptFn({
            data: {
              caseId: practice.caseId,
              caseTitle: practice.caseTitle,
              caseCategory: practice.caseCategory,
              language,
              code,
              score: Math.round(result.overallScore),
              durationSeconds: duration,
              issues: result.issues.map((i) => ({
                category: i.category,
                severity: i.severity,
                message: i.message,
              })),
              aiSummary: result.summary,
            },
          });
          setSaved(true);
        } catch {
          /* silent — non-blocking */
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "分析失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };
  const roleLabel =
    auth.role === "super_admin"
      ? "超级管理员"
      : auth.role === "teacher"
        ? "教师"
        : auth.role === "admin"
          ? "管理员"
          : "学生";


  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-[1400px] px-8 py-6 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <h1 className="text-base font-medium tracking-wide text-foreground">
              CodeMentor
            </h1>
            <span className="text-xs text-muted-foreground tracking-widest uppercase">
              AI
            </span>
            <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">
              智能代码纠错与优化
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/cases"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <BookOpen className="h-3.5 w-3.5" strokeWidth={1.5} />
              财务案例库
            </Link>
            <Link
              to="/reports"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <LineChart className="h-3.5 w-3.5" strokeWidth={1.5} />
              学习报告
            </Link>
            {auth.role === "super_admin" && (
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <User className="h-3.5 w-3.5" strokeWidth={1.5} />
                管理后台
              </Link>
            )}
            {auth.loading ? null : auth.user ? (
              <>
                <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                  <User className="h-3.5 w-3.5" strokeWidth={1.5} />
                  <span className="text-foreground">{auth.displayName}</span>
                  <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 border border-border">
                    {roleLabel}
                  </span>
                </div>
                <button
                  onClick={() => void supabase.auth.signOut()}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
                  退出
                </button>
              </>
            ) : (
              <Link
                to="/auth"
                className="inline-flex items-center gap-1.5 text-xs text-foreground hover:opacity-70 transition-opacity"
              >
                <LogIn className="h-3.5 w-3.5" strokeWidth={1.5} />
                登录 / 注册
              </Link>
            )}
          </div>
        </div>
        <div className="mx-auto max-w-[1400px] px-8">
          <LanguageSelector value={language} onChange={setLanguage} />
        </div>
      </header>


      <main className="flex-1 mx-auto max-w-[1400px] w-full px-8 py-10">
        {practice && (
          <div className="mb-8 border-l-2 border-foreground pl-4 py-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                  正在练习
                </div>
                <div className="text-sm text-foreground font-medium">{practice.caseTitle}</div>
              </div>
              {saved && (
                <span className="inline-flex items-center gap-1 text-[11px] text-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                  本次成绩已记录
                </span>
              )}
            </div>
            {practice.notes && (
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                {practice.notes}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10">
          <section>
            <div className="mb-5">
              <h2 className="text-[15px] text-foreground">提交代码</h2>
              <p className="text-xs text-muted-foreground mt-1">
                选择语言，粘贴或上传你的代码片段。
              </p>
            </div>
            <CodeInput ref={codeInputRef} language={language} value={code} onChange={setCode} />
            <div className="mt-5 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {code ? `${code.split("\n").length} 行 · ${code.length} 字符` : "尚未输入"}
              </p>
              <button
                disabled={!canAnalyze}
                onClick={handleAnalyze}
                className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground text-sm transition-opacity disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                    分析中
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" strokeWidth={1.5} />
                    开始分析
                  </>
                )}
              </button>
            </div>
          </section>

          <section>
            <div className="mb-5">
              <h2 className="text-[15px] text-foreground">分析结果</h2>
              <p className="text-xs text-muted-foreground mt-1">
                AI 将给出语法、逻辑与性能维度的建议。
              </p>
            </div>

            {loading ? (
              <div className="flex flex-col gap-3">
                <div className="border border-border bg-card p-6 animate-pulse">
                  <div className="h-10 w-24 bg-surface mb-3" />
                  <div className="h-3 w-full bg-surface mb-2" />
                  <div className="h-3 w-2/3 bg-surface" />
                </div>
                <div className="border border-border bg-card p-5 animate-pulse">
                  <div className="h-3 w-1/3 bg-surface mb-3" />
                  <div className="h-3 w-full bg-surface mb-2" />
                  <div className="h-3 w-4/5 bg-surface" />
                </div>
              </div>
            ) : error ? (
              <div className="border border-destructive/30 bg-card p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 mt-0.5 text-destructive" strokeWidth={1.5} />
                  <div>
                    <p className="text-sm text-foreground">分析未完成</p>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      {error}
                    </p>
                  </div>
                </div>
              </div>
            ) : analysis ? (
              <AnalysisResults
                data={analysis}
                onApplyFix={(c) => setCode(c)}
                onJumpToLine={(line) => codeInputRef.current?.jumpToLine(line)}
              />
            ) : (
              <div className="border border-border bg-card min-h-[420px] flex flex-col items-center justify-center text-center px-8">
                <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center mb-4">
                  <Sparkles className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <p className="text-sm text-foreground">等待你的代码</p>
                <p className="text-xs text-muted-foreground mt-1.5 max-w-xs">
                  提交后，分析结果会出现在这里。
                </p>
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-[1400px] px-8 py-6">
          <p className="text-xs text-muted-foreground">
            CodeMentor AI · 由 DeepSeek 提供模型能力
          </p>
        </div>
      </footer>
    </div>
  );
}
