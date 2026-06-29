import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Play, Target, Clock, FileCode2, Terminal, Loader2, AlertCircle } from "lucide-react";
import { getCaseById, CATEGORY_LABEL, type FinanceCase } from "@/lib/cases";
import { generatePracticeScaffold } from "@/lib/cases.functions";

export const Route = createFileRoute("/cases/$caseId")({
  loader: ({ params }) => {
    const c = getCaseById(params.caseId);
    if (!c) throw notFound();
    return c;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.title} · Python 财务案例` },
          { name: "description", content: loaderData.description },
          { property: "og:title", content: `${loaderData.title} · Python 财务案例` },
          { property: "og:description", content: loaderData.description },
        ]
      : [],
  }),
  component: CaseDetailPage,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-4">未找到该案例</p>
        <Link to="/cases" className="text-sm text-foreground underline underline-offset-4">
          返回案例库
        </Link>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
});

function CaseDetailPage() {
  const c = Route.useLoaderData() as FinanceCase;
  const navigate = useNavigate();
  const generate = useServerFn(generatePracticeScaffold);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startPractice = async () => {
    setLoading(true);
    setError(null);
    try {
      const { code, notes } = await generate({ data: { caseId: c.id } });
      sessionStorage.setItem(
        "codementor:practice",
        JSON.stringify({
          caseId: c.id,
          caseTitle: c.title,
          language: "python",
          code,
          notes,
        }),
      );
      await navigate({ to: "/" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败，请稍后重试");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-[1200px] px-8 py-6 flex items-center justify-between">
          <Link to="/" className="text-base font-medium tracking-wide text-foreground hover:opacity-70">
            CodeMentor
          </Link>
          <Link
            to="/cases"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
            返回案例库
          </Link>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-[1200px] w-full px-8 py-12">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4 text-[11px] uppercase tracking-widest text-muted-foreground">
            <span>{CATEGORY_LABEL[c.category]}</span>
            <span className="opacity-30">·</span>
            <span>{c.difficulty}</span>
            <span className="opacity-30">·</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" strokeWidth={1.5} />约 {c.estimatedMinutes} 分钟
            </span>
          </div>
          <h1 className="text-3xl font-medium tracking-tight text-foreground mb-5">{c.title}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
            {c.description}
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => void startPractice()}
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                    生成模拟数据中…
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" strokeWidth={2} />
                    开始练习
                  </>
                )}
              </button>
              <span className="text-xs text-muted-foreground">
                AI 将为你生成专属模拟数据与练习脚手架
              </span>
            </div>
            {error && (
              <div className="inline-flex items-start gap-2 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5" strokeWidth={1.5} />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>



        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-10">
          <section>
            <SectionTitle icon={<Target className="h-3.5 w-3.5" strokeWidth={1.5} />}>
              学习目标
            </SectionTitle>
            <ul className="space-y-2.5">
              {c.objectives.map((o, i) => (
                <li
                  key={i}
                  className="flex gap-3 text-sm text-foreground leading-relaxed"
                >
                  <span className="text-muted-foreground text-xs mt-1.5">0{i + 1}</span>
                  <span>{o}</span>
                </li>
              ))}
            </ul>

            <div className="mt-10">
              <SectionTitle icon={<Terminal className="h-3.5 w-3.5" strokeWidth={1.5} />}>
                预期输出
              </SectionTitle>
              <pre className="bg-muted/40 border border-border p-4 text-xs leading-relaxed overflow-auto whitespace-pre-wrap text-foreground">
                {c.expectedOutput}
              </pre>
            </div>
          </section>

          <section>
            <SectionTitle icon={<FileCode2 className="h-3.5 w-3.5" strokeWidth={1.5} />}>
              参考代码
            </SectionTitle>
            <pre className="bg-muted/40 border border-border p-4 text-xs leading-relaxed overflow-auto text-foreground">
              <code>{c.referenceCode}</code>
            </pre>
          </section>
        </div>
      </main>
    </div>
  );
}

function SectionTitle({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <h2 className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground mb-4">
      {icon}
      {children}
    </h2>
  );
}
