import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Loader2, Sparkles, ExternalLink, Video, FileText, LogIn } from "lucide-react";
import { analyzeMyGaps, type GapReport } from "@/lib/practice.functions";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "学习报告 · CodeMentor AI" },
      {
        name: "description",
        content: "基于你的练习表现，AI 自动识别知识盲点并推荐文章与 B 站视频学习资源。",
      },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const auth = useAuth();
  const analyze = useServerFn(analyzeMyGaps);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<GapReport | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await analyze({ data: undefined } as never);
      setReport(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "分析失败");
    } finally {
      setLoading(false);
    }
  };

  // 登录后自动跑一次
  useEffect(() => {
    if (auth.user && !report && !loading && !error) {
      void run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.user]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-[1100px] px-8 py-6 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <Link to="/" className="text-base font-medium tracking-wide text-foreground hover:opacity-70">
              CodeMentor
            </Link>
            <span className="text-xs text-muted-foreground tracking-widest uppercase">学习报告</span>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
            返回工作台
          </Link>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-[1100px] w-full px-8 py-12">
        <div className="mb-10 max-w-2xl">
          <h1 className="text-2xl font-medium tracking-tight text-foreground">你的学习报告</h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            AI 会基于你的练习记录识别薄弱点，并推荐文章与 B 站视频学习资源。
          </p>
        </div>

        {!auth.user ? (
          <div className="border border-border bg-card p-10 text-center">
            <p className="text-sm text-foreground mb-4">请先登录以查看个人学习报告。</p>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm hover:opacity-90"
            >
              <LogIn className="h-3.5 w-3.5" strokeWidth={1.5} />
              登录 / 注册
            </Link>
          </div>
        ) : loading ? (
          <div className="border border-border bg-card p-10 flex flex-col items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
            <p className="text-xs text-muted-foreground">AI 正在分析你的练习记录...</p>
          </div>
        ) : error ? (
          <div className="border border-destructive/30 bg-card p-6">
            <p className="text-sm text-foreground">分析未完成</p>
            <p className="text-xs text-muted-foreground mt-1.5">{error}</p>
            <button
              onClick={() => void run()}
              className="mt-4 text-xs text-foreground underline underline-offset-4 hover:opacity-70"
            >
              重新分析
            </button>
          </div>
        ) : report ? (
          <div className="space-y-8">
            {/* 概览 */}
            <section className="grid grid-cols-3 gap-4">
              <Stat label="练习次数" value={report.totalAttempts.toString()} />
              <Stat label="平均得分" value={report.averageScore.toString()} />
              <Stat label="薄弱点" value={report.weakTopics.length.toString()} />
            </section>

            {report.totalAttempts === 0 ? (
              <div className="border border-dashed border-border p-10 text-center">
                <p className="text-sm text-foreground mb-2">尚无练习记录</p>
                <p className="text-xs text-muted-foreground mb-5">{report.recommendations}</p>
                <Link
                  to="/cases"
                  className="inline-flex items-center gap-2 px-4 py-2 border border-foreground text-foreground text-sm hover:bg-foreground hover:text-background transition-colors"
                >
                  去案例库选题练习
                </Link>
              </div>
            ) : (
              <>
                <section>
                  <h2 className="text-[15px] text-foreground mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" strokeWidth={1.5} />
                    AI 总体建议
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-border pl-4">
                    {report.recommendations}
                  </p>
                </section>

                {report.weakTopics.length > 0 && (
                  <section>
                    <h2 className="text-[15px] text-foreground mb-3">薄弱知识点</h2>
                    <div className="space-y-3">
                      {report.weakTopics.map((t, i) => (
                        <div key={i} className="border border-border bg-card p-5">
                          <div className="text-sm text-foreground font-medium mb-1.5">{t.topic}</div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{t.reason}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {report.resources.length > 0 && (
                  <section>
                    <h2 className="text-[15px] text-foreground mb-3">推荐学习资源</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {report.resources.map((r, i) => (
                        <a
                          key={i}
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group border border-border bg-card p-5 hover:border-foreground/40 transition-colors flex flex-col"
                        >
                          <div className="flex items-center gap-2 mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                            {r.type === "video" ? (
                              <>
                                <Video className="h-3 w-3" strokeWidth={1.5} />
                                B 站视频
                              </>
                            ) : (
                              <>
                                <FileText className="h-3 w-3" strokeWidth={1.5} />
                                文章
                              </>
                            )}
                          </div>
                          <div className="text-sm text-foreground font-medium mb-1.5">{r.title}</div>
                          <p className="text-xs text-muted-foreground leading-relaxed flex-1">{r.description}</p>
                          <div className="mt-3 inline-flex items-center gap-1 text-xs text-foreground opacity-60 group-hover:opacity-100">
                            前往
                            <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
                          </div>
                        </a>
                      ))}
                    </div>
                  </section>
                )}

                <div className="pt-4">
                  <button
                    onClick={() => void run()}
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
                  >
                    重新生成报告
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-card p-5">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{label}</div>
      <div className="text-2xl font-medium text-foreground">{value}</div>
    </div>
  );
}
