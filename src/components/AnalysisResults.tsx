import type { Analysis, Issue } from "@/lib/analyze.types";
import { AlertCircle, AlertTriangle, Info, Wand2 } from "lucide-react";

const CATEGORY_LABEL: Record<Issue["category"], string> = {
  syntax: "语法",
  logic: "逻辑",
  performance: "性能",
  style: "风格",
};

const SEVERITY_META: Record<
  Issue["severity"],
  { label: string; Icon: typeof AlertCircle; cls: string }
> = {
  error: { label: "错误", Icon: AlertCircle, cls: "text-destructive" },
  warning: { label: "警告", Icon: AlertTriangle, cls: "text-[color:var(--warning)]" },
  info: { label: "建议", Icon: Info, cls: "text-muted-foreground" },
};

interface Props {
  data: Analysis;
  onApplyFix?: (fixedCode: string) => void;
}

function ScoreCard({ data }: { data: Analysis }) {
  const counts = data.issues.reduce(
    (acc, i) => {
      acc[i.severity] = (acc[i.severity] || 0) + 1;
      return acc;
    },
    { error: 0, warning: 0, info: 0 } as Record<Issue["severity"], number>,
  );

  return (
    <div className="border border-border bg-card p-6 mb-4">
      <div className="flex items-baseline justify-between mb-3">
        <div className="flex items-baseline gap-3">
          <span className="text-4xl font-light text-foreground tabular-nums">
            {data.overallScore}
          </span>
          <span className="text-xs text-muted-foreground tracking-wider">/ 100</span>
        </div>
        <span className="text-xs text-muted-foreground uppercase tracking-widest">
          整体评分
        </span>
      </div>
      <p className="text-[13px] text-foreground leading-relaxed mb-4">{data.summary}</p>
      <div className="flex items-center gap-5 text-xs text-muted-foreground border-t border-border pt-3">
        <span>错误 <span className="text-foreground tabular-nums ml-1">{counts.error}</span></span>
        <span>警告 <span className="text-foreground tabular-nums ml-1">{counts.warning}</span></span>
        <span>建议 <span className="text-foreground tabular-nums ml-1">{counts.info}</span></span>
      </div>
    </div>
  );
}

function IssueCard({ issue, onApplyFix }: { issue: Issue; onApplyFix?: (c: string) => void }) {
  const meta = SEVERITY_META[issue.severity];
  const Icon = meta.Icon;
  return (
    <div className="border border-border bg-card p-5">
      <div className="flex items-start gap-3 mb-3">
        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${meta.cls}`} strokeWidth={1.5} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
              {CATEGORY_LABEL[issue.category]} · {meta.label}
            </span>
            {issue.line !== undefined && (
              <span className="text-[11px] text-muted-foreground tabular-nums">
                第 {issue.line} 行
              </span>
            )}
          </div>
          <p className="text-[13px] text-foreground leading-relaxed">{issue.message}</p>
        </div>
      </div>

      {issue.snippet && (
        <pre className="ml-7 mb-3 px-3 py-2 bg-surface text-[12px] font-mono text-foreground/80 overflow-x-auto border border-border">
          {issue.snippet}
        </pre>
      )}

      <div className="ml-7">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">
          修改建议
        </p>
        <p className="text-[13px] text-foreground leading-relaxed">{issue.suggestion}</p>

        {issue.fixedCode && (
          <>
            <pre className="mt-3 px-3 py-2 bg-surface text-[12px] font-mono text-foreground/80 overflow-x-auto border border-border">
              {issue.fixedCode}
            </pre>
            {onApplyFix && (
              <button
                onClick={() => onApplyFix(issue.fixedCode!)}
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary hover:opacity-70 transition-opacity"
              >
                <Wand2 className="h-3 w-3" strokeWidth={1.5} />
                应用此修复
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function AnalysisResults({ data, onApplyFix }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <ScoreCard data={data} />
      {data.issues.length === 0 ? (
        <div className="border border-border bg-card p-8 text-center">
          <p className="text-sm text-foreground">未发现明显问题</p>
          <p className="text-xs text-muted-foreground mt-1">代码看起来不错。</p>
        </div>
      ) : (
        data.issues.map((issue, i) => (
          <IssueCard key={i} issue={issue} onApplyFix={onApplyFix} />
        ))
      )}
    </div>
  );
}
