import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { LanguageSelector } from "@/components/LanguageSelector";
import { CodeInput } from "@/components/CodeInput";
import type { LanguageId } from "@/lib/analyze.types";

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

  const canAnalyze = code.trim().length > 0;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header — restrained, single horizontal rule */}
      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-[1400px] px-8 py-6 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <h1 className="text-base font-medium tracking-wide text-foreground">
              CodeMentor
            </h1>
            <span className="text-xs text-muted-foreground tracking-widest uppercase">
              AI
            </span>
          </div>
          <p className="text-xs text-muted-foreground">智能代码纠错与优化</p>
        </div>
        <div className="mx-auto max-w-[1400px] px-8">
          <LanguageSelector value={language} onChange={setLanguage} />
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 mx-auto max-w-[1400px] w-full px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10">
          {/* Left — input */}
          <section>
            <div className="mb-5">
              <h2 className="text-[15px] text-foreground">提交代码</h2>
              <p className="text-xs text-muted-foreground mt-1">
                选择语言，粘贴或上传你的代码片段。
              </p>
            </div>
            <CodeInput language={language} value={code} onChange={setCode} />
            <div className="mt-5 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {code ? `${code.split("\n").length} 行 · ${code.length} 字符` : "尚未输入"}
              </p>
              <button
                disabled={!canAnalyze}
                className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground text-sm transition-opacity disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90"
              >
                <Sparkles className="h-4 w-4" strokeWidth={1.5} />
                开始分析
              </button>
            </div>
          </section>

          {/* Right — results placeholder */}
          <section>
            <div className="mb-5">
              <h2 className="text-[15px] text-foreground">分析结果</h2>
              <p className="text-xs text-muted-foreground mt-1">
                AI 将给出语法、逻辑与性能维度的建议。
              </p>
            </div>
            <div className="border border-border bg-card min-h-[420px] flex flex-col items-center justify-center text-center px-8">
              <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center mb-4">
                <Sparkles className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <p className="text-sm text-foreground">等待你的代码</p>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-xs">
                提交后，分析结果会出现在这里。
              </p>
            </div>
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
