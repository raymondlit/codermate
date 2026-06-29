import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Clock, ChevronLeft, RotateCcw } from "lucide-react";
import { CATEGORIES, FINANCE_CASES, type CaseCategory, type CaseDifficulty } from "@/lib/cases";
import { listMyAttemptStats, type AttemptStat } from "@/lib/practice.functions";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/cases/")({
  head: () => ({
    meta: [
      { title: "Python 财务案例库 · CodeMentor AI" },
      {
        name: "description",
        content: "覆盖财务报表分析、量化投资、风险管理、税务计算与财务预测的 Python 实践案例库。",
      },
      { property: "og:title", content: "Python 财务案例库 · CodeMentor AI" },
      {
        property: "og:description",
        content: "按分类筛选 Python 财务案例，查看目标、参考代码并一键开始练习。",
      },
    ],
  }),
  component: CasesPage,
});

const DIFFICULTIES: CaseDifficulty[] = ["基础", "进阶", "挑战"];

function CasesPage() {
  const [category, setCategory] = useState<CaseCategory | "all">("all");
  const [difficulty, setDifficulty] = useState<CaseDifficulty | "all">("all");
  const auth = useAuth();
  const fetchStats = useServerFn(listMyAttemptStats);
  const [stats, setStats] = useState<Map<string, AttemptStat>>(new Map());

  useEffect(() => {
    if (!auth.user) {
      setStats(new Map());
      return;
    }
    let active = true;
    fetchStats({ data: undefined } as never)
      .then((rows) => {
        if (!active) return;
        const m = new Map<string, AttemptStat>();
        for (const r of rows) m.set(r.case_id, r);
        setStats(m);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [auth.user, fetchStats]);

  const filtered = useMemo(
    () =>
      FINANCE_CASES.filter(
        (c) =>
          (category === "all" || c.category === category) &&
          (difficulty === "all" || c.difficulty === difficulty),
      ),
    [category, difficulty],
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-[1400px] px-8 py-6 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <Link to="/" className="text-base font-medium tracking-wide text-foreground hover:opacity-70">
              CodeMentor
            </Link>
            <span className="text-xs text-muted-foreground tracking-widest uppercase">案例库</span>
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

      <main className="flex-1 mx-auto max-w-[1400px] w-full px-8 py-12">
        <div className="mb-10 max-w-2xl">
          <h1 className="text-2xl font-medium tracking-tight text-foreground">Python 财务案例库</h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            精选 {FINANCE_CASES.length} 个覆盖财务核心场景的 Python
            实践案例。选择一个分类，挑选合适难度，开始你的练习。
          </p>
        </div>

        {/* 分类筛选 */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground mr-2">
            分类
          </span>
          <FilterChip active={category === "all"} onClick={() => setCategory("all")}>
            全部
          </FilterChip>
          {CATEGORIES.map((c) => (
            <FilterChip
              key={c.value}
              active={category === c.value}
              onClick={() => setCategory(c.value)}
            >
              {c.label}
            </FilterChip>
          ))}
        </div>

        <div className="mb-10 flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground mr-2">
            难度
          </span>
          <FilterChip active={difficulty === "all"} onClick={() => setDifficulty("all")}>
            全部
          </FilterChip>
          {DIFFICULTIES.map((d) => (
            <FilterChip key={d} active={difficulty === d} onClick={() => setDifficulty(d)}>
              {d}
            </FilterChip>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="border border-dashed border-border py-20 text-center text-sm text-muted-foreground">
            当前筛选条件下暂无案例
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((c) => (
              <Link
                key={c.id}
                to="/cases/$caseId"
                params={{ caseId: c.id }}
                className="group border border-border bg-card p-6 hover:border-foreground/30 transition-colors flex flex-col"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {labelOf(c.category)}
                  </span>
                  <DifficultyBadge level={c.difficulty} />
                </div>
                <h3 className="text-base text-foreground font-medium mb-2">{c.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 flex-1">
                  {c.description}
                </p>
                <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3 w-3" strokeWidth={1.5} />
                    约 {c.estimatedMinutes} 分钟
                  </span>
                  <span className="inline-flex items-center gap-1 text-foreground opacity-60 group-hover:opacity-100 transition-opacity">
                    查看
                    <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "px-3 py-1.5 text-xs border transition-colors " +
        (active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40")
      }
    >
      {children}
    </button>
  );
}

function DifficultyBadge({ level }: { level: CaseDifficulty }) {
  return (
    <span className="text-[10px] tracking-widest uppercase px-1.5 py-0.5 border border-border text-muted-foreground">
      {level}
    </span>
  );
}

function labelOf(value: CaseCategory): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}
