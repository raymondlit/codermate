import { useState } from "react";
import type { Analysis, Issue } from "@/lib/analyze.types";
import { diffLines } from "@/lib/diff";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Wand2,
  CornerDownRight,
  SplitSquareHorizontal,
  AlignLeft,
} from "lucide-react";

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
  onJumpToLine?: (line: number) => void;
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

function UnifiedDiff({ before, after }: { before: string; after: string }) {
  const rows = diffLines(before, after);
  return (
    <div className="border border-border bg-surface font-mono text-[12px] overflow-x-auto">
      {rows.map((r, i) => {
        const sign = r.type === "add" ? "+" : r.type === "del" ? "-" : " ";
        const cls =
          r.type === "add"
            ? "bg-[color:var(--diff-add)] text-foreground"
            : r.type === "del"
              ? "bg-[color:var(--diff-del)] text-foreground/80 line-through decoration-foreground/30"
              : "text-foreground/60";
        return (
          <div key={i} className={`flex ${cls}`}>
            <span className="select-none w-6 shrink-0 text-center text-muted-foreground/60 border-r border-border">
              {sign}
            </span>
            <pre className="px-3 py-0.5 whitespace-pre-wrap break-all flex-1">{r.text || " "}</pre>
          </div>
        );
      })}
    </div>
  );
}

function SplitDiff({ before, after }: { before: string; after: string }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="border border-border bg-surface">
        <div className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
          修改前
        </div>
        <pre className="px-3 py-2 text-[12px] font-mono text-foreground/80 overflow-x-auto whitespace-pre-wrap break-all">
          {before || " "}
        </pre>
      </div>
      <div className="border border-border bg-[color:var(--diff-add)]">
        <div className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
          修改后
        </div>
        <pre className="px-3 py-2 text-[12px] font-mono text-foreground overflow-x-auto whitespace-pre-wrap break-all">
          {after || " "}
        </pre>
      </div>
    </div>
  );
}

function IssueCard({
  issue,
  index,
  onApplyFix,
  onJumpToLine,
}: {
  issue: Issue;
  index: number;
  onApplyFix?: (c: string) => void;
  onJumpToLine?: (line: number) => void;
}) {
  const meta = SEVERITY_META[issue.severity];
  const Icon = meta.Icon;
  const [diffMode, setDiffMode] = useState<"unified" | "split">("unified");
  const hasDiff = !!issue.fixedCode && !!issue.snippet;

  return (
    <div id={`issue-${index}`} className="border border-border bg-card p-5">
      <div className="flex items-start gap-3 mb-3">
        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${meta.cls}`} strokeWidth={1.5} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
              {CATEGORY_LABEL[issue.category]} · {meta.label}
            </span>
            {issue.line !== undefined && (
              <button
                onClick={() => onJumpToLine?.(issue.line!)}
                disabled={!onJumpToLine}
                className="inline-flex items-center gap-1 text-[11px] text-primary tabular-nums hover:opacity-70 transition-opacity disabled:text-muted-foreground disabled:no-underline"
                title="跳转到对应行"
              >
                <CornerDownRight className="h-3 w-3" strokeWidth={1.5} />
                第 {issue.line} 行
              </button>
            )}
          </div>
          <p className="text-[13px] text-foreground leading-relaxed">{issue.message}</p>
        </div>
      </div>

      <div className="ml-7">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">
          修改建议
        </p>
        <p className="text-[13px] text-foreground leading-relaxed">{issue.suggestion}</p>

        {hasDiff ? (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
                优化前后对比
              </span>
              <div className="inline-flex items-center text-[11px] border border-border">
                <button
                  onClick={() => setDiffMode("unified")}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 transition-colors ${
                    diffMode === "unified"
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <AlignLeft className="h-3 w-3" strokeWidth={1.5} />
                  统一
                </button>
                <button
                  onClick={() => setDiffMode("split")}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 transition-colors ${
                    diffMode === "split"
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <SplitSquareHorizontal className="h-3 w-3" strokeWidth={1.5} />
                  分栏
                </button>
              </div>
            </div>
            {diffMode === "unified" ? (
              <UnifiedDiff before={issue.snippet!} after={issue.fixedCode!} />
            ) : (
              <SplitDiff before={issue.snippet!} after={issue.fixedCode!} />
            )}
          </div>
        ) : issue.snippet ? (
          <pre className="mt-3 px-3 py-2 bg-surface text-[12px] font-mono text-foreground/80 overflow-x-auto border border-border whitespace-pre-wrap break-all">
            {issue.snippet}
          </pre>
        ) : issue.fixedCode ? (
          <pre className="mt-3 px-3 py-2 bg-[color:var(--diff-add)] text-[12px] font-mono text-foreground overflow-x-auto border border-border whitespace-pre-wrap break-all">
            {issue.fixedCode}
          </pre>
        ) : null}

        {issue.fixedCode && onApplyFix && (
          <button
            onClick={() => onApplyFix(issue.fixedCode!)}
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary hover:opacity-70 transition-opacity"
          >
            <Wand2 className="h-3 w-3" strokeWidth={1.5} />
            应用此修复
          </button>
        )}
      </div>
    </div>
  );
}

export function AnalysisResults({ data, onApplyFix, onJumpToLine }: Props) {
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
          <IssueCard
            key={i}
            index={i}
            issue={issue}
            onApplyFix={onApplyFix}
            onJumpToLine={onJumpToLine}
          />
        ))
      )}
    </div>
  );
}
