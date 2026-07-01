import { useMemo, useState } from "react";
import {
  FileSpreadsheet,
  ClipboardPaste,
  Loader2,
  Upload,
  X,
  Download,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

interface StudentInput {
  student_no?: string;
  student_name: string;
}
interface ClassImportItem {
  class_name: string;
  description?: string | null;
  students: StudentInput[];
}

interface RowIssue {
  class_name: string;
  row_index: number; // 1-based within its class
  student_no?: string;
  student_name?: string;
  reason: string;
}

interface ValidationReport {
  validItems: ClassImportItem[];
  issues: RowIssue[];
  totalValid: number;
  totalIssue: number;
}

interface SubmitResult {
  inserted: { class_name: string; inserted_count: number }[];
  issues: RowIssue[];
}

interface Props {
  onDone: () => void;
  onCancel: () => void;
}

type Mode = "paste" | "xlsx";

const HEADER_ALIASES: Record<string, "class_name" | "student_no" | "student_name"> = {
  班级: "class_name",
  班级名称: "class_name",
  班级名: "class_name",
  class: "class_name",
  学号: "student_no",
  编号: "student_no",
  id: "student_no",
  姓名: "student_name",
  学生姓名: "student_name",
  name: "student_name",
};

const MAX_NAME_LEN = 64;
const MAX_NO_LEN = 32;

function normalizeHeader(h: unknown): string {
  return String(h ?? "").trim().toLowerCase();
}

function parseSheetRows(rows: Record<string, unknown>[]): ClassImportItem[] {
  if (!rows.length) return [];
  const keyMap: Record<string, "class_name" | "student_no" | "student_name"> = {};
  for (const key of Object.keys(rows[0])) {
    const hit = HEADER_ALIASES[normalizeHeader(key)] ?? HEADER_ALIASES[String(key).trim()];
    if (hit) keyMap[key] = hit;
  }
  const groups = new Map<string, ClassImportItem>();
  for (const r of rows) {
    let className = "";
    let no = "";
    let name = "";
    for (const k of Object.keys(r)) {
      const m = keyMap[k];
      const v = String(r[k] ?? "").trim();
      if (!v) continue;
      if (m === "class_name") className = v;
      else if (m === "student_no") no = v;
      else if (m === "student_name") name = v;
    }
    if (!className && !name) continue; // empty row
    if (!groups.has(className || "（未命名班级）"))
      groups.set(className || "（未命名班级）", {
        class_name: className || "（未命名班级）",
        students: [],
      });
    groups
      .get(className || "（未命名班级）")!
      .students.push({ student_no: no || undefined, student_name: name });
  }
  return Array.from(groups.values());
}

function parsePasted(className: string, text: string): ClassImportItem | null {
  const name = className.trim();
  if (!name) return null;
  const students: StudentInput[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/[\t,，]+|\s{1,}/).filter(Boolean);
    if (parts.length === 0) continue;
    if (parts.length === 1) {
      students.push({ student_name: parts[0] });
    } else {
      const first = parts[0];
      const looksLikeNo = /^[A-Za-z0-9_-]{3,}$/.test(first);
      if (looksLikeNo) {
        students.push({ student_no: first, student_name: parts.slice(1).join("") });
      } else {
        students.push({ student_name: parts.join("") });
      }
    }
  }
  if (!students.length) return null;
  return { class_name: name, students };
}

/** Validates and splits raw items into clean payload + issue list. */
function validate(items: ClassImportItem[]): ValidationReport {
  const issues: RowIssue[] = [];
  const validItems: ClassImportItem[] = [];
  for (const it of items) {
    const className = it.class_name.trim();
    const seenNo = new Map<string, number>();
    const seenName = new Map<string, number>();
    const kept: StudentInput[] = [];
    it.students.forEach((s, idx) => {
      const rowIdx = idx + 1;
      const name = (s.student_name ?? "").trim();
      const no = (s.student_no ?? "").trim();
      if (!className || className === "（未命名班级）") {
        issues.push({ class_name: className || "—", row_index: rowIdx, student_no: no, student_name: name, reason: "缺少班级名称" });
        return;
      }
      if (!name) {
        issues.push({ class_name: className, row_index: rowIdx, student_no: no, reason: "缺少姓名" });
        return;
      }
      if (name.length > MAX_NAME_LEN) {
        issues.push({ class_name: className, row_index: rowIdx, student_no: no, student_name: name, reason: `姓名过长（>${MAX_NAME_LEN}）` });
        return;
      }
      if (no && no.length > MAX_NO_LEN) {
        issues.push({ class_name: className, row_index: rowIdx, student_no: no, student_name: name, reason: `学号过长（>${MAX_NO_LEN}）` });
        return;
      }
      if (no) {
        const prev = seenNo.get(no);
        if (prev) {
          issues.push({ class_name: className, row_index: rowIdx, student_no: no, student_name: name, reason: `学号重复（首次出现于第 ${prev} 行）` });
          return;
        }
        seenNo.set(no, rowIdx);
      } else {
        // dedupe nameless-no rows by name
        const prev = seenName.get(name);
        if (prev) {
          issues.push({ class_name: className, row_index: rowIdx, student_name: name, reason: `姓名重复且无学号（首次出现于第 ${prev} 行）` });
          return;
        }
        seenName.set(name, rowIdx);
      }
      kept.push({ student_no: no || undefined, student_name: name });
    });
    if (kept.length) validItems.push({ class_name: className, students: kept });
  }
  const totalValid = validItems.reduce((s, c) => s + c.students.length, 0);
  return { validItems, issues, totalValid, totalIssue: issues.length };
}

function downloadCSV(filename: string, rows: RowIssue[]) {
  const head = ["班级", "行号", "学号", "姓名", "原因"];
  const lines = [head.join(",")];
  for (const r of rows) {
    const cells = [r.class_name, String(r.row_index), r.student_no ?? "", r.student_name ?? "", r.reason].map(
      (v) => `"${String(v).replace(/"/g, '""')}"`,
    );
    lines.push(cells.join(","));
  }
  // BOM for Excel Chinese
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ClassRosterImporter({ onDone, onCancel }: Props) {
  const [mode, setMode] = useState<Mode>("paste");
  const [className, setClassName] = useState("");
  const [pasted, setPasted] = useState("");
  const [rawPreview, setRawPreview] = useState<ClassImportItem[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const liveRaw = useMemo<ClassImportItem[]>(() => {
    if (mode === "xlsx") return rawPreview;
    const item = parsePasted(className, pasted);
    return item ? [item] : [];
  }, [mode, rawPreview, className, pasted]);

  const report = useMemo(() => validate(liveRaw), [liveRaw]);

  const handleFile = async (file: File) => {
    setErr(null);
    setResult(null);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const all: ClassImportItem[] = [];
      for (const sheetName of wb.SheetNames) {
        const sheet = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        all.push(...parseSheetRows(rows));
      }
      const merged = new Map<string, ClassImportItem>();
      for (const c of all) {
        if (!merged.has(c.class_name)) merged.set(c.class_name, { class_name: c.class_name, students: [] });
        merged.get(c.class_name)!.students.push(...c.students);
      }
      setRawPreview(Array.from(merged.values()));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "解析 Excel 失败");
      setRawPreview([]);
    }
  };

  const submit = async () => {
    setErr(null);
    setResult(null);
    if (!report.validItems.length) {
      setErr("无可导入的有效记录，请检查校验提示。");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc("bulk_upsert_classes_with_roster", {
      _payload: report.validItems as unknown as never,
    });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    const inserted = ((data ?? []) as { out_class_name: string; out_inserted_count: number }[]).map((r) => ({
      class_name: r.out_class_name,
      inserted_count: r.out_inserted_count,
    }));
    setResult({ inserted, issues: report.issues });
  };

  const insertedTotal = result?.inserted.reduce((s, r) => s + r.inserted_count, 0) ?? 0;

  return (
    <div className="border border-border p-5 mb-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setMode("paste");
              setResult(null);
            }}
            className={`text-xs px-3 py-1.5 border ${mode === "paste" ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted"}`}
          >
            <ClipboardPaste className="inline h-3.5 w-3.5 mr-1" strokeWidth={1.5} />
            粘贴名单
          </button>
          <button
            onClick={() => {
              setMode("xlsx");
              setResult(null);
            }}
            className={`text-xs px-3 py-1.5 border ${mode === "xlsx" ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted"}`}
          >
            <FileSpreadsheet className="inline h-3.5 w-3.5 mr-1" strokeWidth={1.5} />
            Excel 导入
          </button>
        </div>
        <button onClick={onCancel} className="p-1.5 text-muted-foreground hover:text-foreground" title="关闭">
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      {mode === "paste" ? (
        <>
          <input
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            placeholder="班级名称，如：机制B250201"
            className="w-full text-sm bg-background border border-border px-3 py-2 focus:outline-none focus:border-foreground"
          />
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={"每行一名学生，支持格式：\nB25020101 杨妮妮\nB25020102\t刘净\n或仅姓名：张三"}
            rows={10}
            className="w-full text-sm font-mono bg-background border border-border px-3 py-2 focus:outline-none focus:border-foreground"
          />
        </>
      ) : (
        <>
          <label className="block border border-dashed border-border p-6 text-center cursor-pointer hover:border-foreground transition-colors">
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            <Upload className="h-5 w-5 text-muted-foreground mx-auto mb-2" strokeWidth={1.5} />
            <div className="text-sm text-foreground">{fileName ? fileName : "点击或拖拽上传 .xlsx 文件"}</div>
            <div className="text-xs text-muted-foreground mt-1">
              表头需包含：班级名称、学号、姓名（支持中文表头）
            </div>
          </label>
        </>
      )}

      {/* ===== 校验面板 ===== */}
      {liveRaw.length > 0 && (
        <div className="border border-border">
          <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border text-xs">
            <span className="text-foreground">
              共识别 {liveRaw.length} 个班级 · 有效 <span className="text-foreground font-medium">{report.totalValid}</span> 人 · 异常{" "}
              <span className={report.totalIssue ? "text-destructive font-medium" : "text-muted-foreground"}>
                {report.totalIssue}
              </span>{" "}
              行
            </span>
            {report.issues.length > 0 && (
              <button
                onClick={() => downloadCSV(`import-issues-${Date.now()}.csv`, report.issues)}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-border hover:bg-background"
              >
                <Download className="h-3 w-3" strokeWidth={1.5} /> 导出错误清单
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
            <ul className="text-xs divide-y divide-border max-h-56 overflow-auto">
              {report.validItems.length === 0 && (
                <li className="px-3 py-3 text-muted-foreground">无有效班级</li>
              )}
              {report.validItems.map((c) => (
                <li key={c.class_name} className="px-3 py-2 flex justify-between">
                  <span className="text-foreground inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} />
                    {c.class_name}
                  </span>
                  <span className="text-muted-foreground">{c.students.length} 人</span>
                </li>
              ))}
            </ul>
            <ul className="text-xs divide-y divide-border max-h-56 overflow-auto">
              {report.issues.length === 0 && (
                <li className="px-3 py-3 text-muted-foreground">无异常</li>
              )}
              {report.issues.slice(0, 200).map((it, i) => (
                <li key={i} className="px-3 py-2 flex items-start gap-2">
                  <AlertTriangle className="h-3 w-3 mt-0.5 text-destructive flex-shrink-0" strokeWidth={1.5} />
                  <div className="flex-1">
                    <div className="text-foreground">
                      {it.class_name} · 第 {it.row_index} 行
                      {it.student_no ? ` · ${it.student_no}` : ""}
                      {it.student_name ? ` · ${it.student_name}` : ""}
                    </div>
                    <div className="text-destructive">{it.reason}</div>
                  </div>
                </li>
              ))}
              {report.issues.length > 200 && (
                <li className="px-3 py-2 text-muted-foreground">仅显示前 200 条，更多请导出 CSV</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {err && <div className="text-xs text-destructive">{err}</div>}

      {/* ===== 提交结果 ===== */}
      {result && (
        <div className="border border-border">
          <div className="px-3 py-2 bg-muted/40 border-b border-border text-xs flex items-center justify-between">
            <span className="text-foreground inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.5} />
              已写入 {result.inserted.length} 个班级，共 {insertedTotal} 条名册
            </span>
            <button onClick={onDone} className="text-xs px-2 py-1 border border-border hover:bg-background">
              完成并刷新
            </button>
          </div>
          <ul className="text-xs divide-y divide-border max-h-44 overflow-auto">
            {result.inserted.map((r) => (
              <li key={r.class_name} className="px-3 py-2 flex justify-between">
                <span className="text-foreground">{r.class_name}</span>
                <span className="text-muted-foreground">+{r.inserted_count} 人</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="text-xs px-3 py-1.5 border border-border hover:bg-muted">
          关闭
        </button>
        <button
          onClick={() => void submit()}
          disabled={loading || report.totalValid === 0}
          className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-foreground text-background hover:opacity-90 disabled:opacity-40"
        >
          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          导入 {report.totalValid > 0 ? `${report.totalValid} 条` : ""}
        </button>
      </div>
    </div>
  );
}
