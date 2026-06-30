import { useState } from "react";
import { FileSpreadsheet, ClipboardPaste, Loader2, Upload, X } from "lucide-react";
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

function normalizeHeader(h: unknown): string {
  return String(h ?? "").trim().toLowerCase();
}

function parseSheetRows(rows: Record<string, unknown>[]): ClassImportItem[] {
  if (!rows.length) return [];
  // Build column mapping from the first row's keys
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
    if (!className || !name) continue;
    if (!groups.has(className)) groups.set(className, { class_name: className, students: [] });
    groups.get(className)!.students.push({ student_no: no || undefined, student_name: name });
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
    // split by tab / multiple spaces / comma
    const parts = line.split(/[\t,，]+|\s{1,}/).filter(Boolean);
    if (parts.length === 0) continue;
    if (parts.length === 1) {
      students.push({ student_name: parts[0] });
    } else {
      // Heuristic: if first looks like a student number (letters/digits, length>=4), treat as no
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

export function ClassRosterImporter({ onDone, onCancel }: Props) {
  const [mode, setMode] = useState<Mode>("paste");
  const [className, setClassName] = useState("");
  const [pasted, setPasted] = useState("");
  const [preview, setPreview] = useState<ClassImportItem[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setErr(null);
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
      // merge by class_name across sheets
      const merged = new Map<string, ClassImportItem>();
      for (const c of all) {
        if (!merged.has(c.class_name)) merged.set(c.class_name, { class_name: c.class_name, students: [] });
        merged.get(c.class_name)!.students.push(...c.students);
      }
      setPreview(Array.from(merged.values()));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "解析 Excel 失败");
      setPreview([]);
    }
  };

  const buildPayload = (): ClassImportItem[] => {
    if (mode === "xlsx") return preview;
    const item = parsePasted(className, pasted);
    return item ? [item] : [];
  };

  const submit = async () => {
    setErr(null);
    setResult(null);
    const payload = buildPayload();
    if (!payload.length) {
      setErr("请先填写班级名称并粘贴/上传学生名单");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc("bulk_upsert_classes_with_roster", {
      _payload: payload as unknown as never,
    });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    const rows = (data ?? []) as { class_name: string; inserted_count: number }[];
    const summary = rows.map((r) => `${r.class_name}（${r.inserted_count} 人）`).join("、");
    setResult(`已导入：${summary || "无新增"}`);
    setTimeout(() => onDone(), 800);
  };

  const totalStudents = preview.reduce((s, c) => s + c.students.length, 0);

  return (
    <div className="border border-border p-5 mb-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMode("paste")}
            className={`text-xs px-3 py-1.5 border ${mode === "paste" ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted"}`}
          >
            <ClipboardPaste className="inline h-3.5 w-3.5 mr-1" strokeWidth={1.5} />
            粘贴名单
          </button>
          <button
            onClick={() => setMode("xlsx")}
            className={`text-xs px-3 py-1.5 border ${mode === "xlsx" ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted"}`}
          >
            <FileSpreadsheet className="inline h-3.5 w-3.5 mr-1" strokeWidth={1.5} />
            Excel 导入
          </button>
        </div>
        <button
          onClick={onCancel}
          className="p-1.5 text-muted-foreground hover:text-foreground"
          title="关闭"
        >
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
            placeholder={
              "每行一名学生，支持以下格式：\nB25020101 杨妮妮\nB25020102\t刘净\n或直接粘贴姓名：\n张三\n李四"
            }
            rows={10}
            className="w-full text-sm font-mono bg-background border border-border px-3 py-2 focus:outline-none focus:border-foreground"
          />
          <p className="text-xs text-muted-foreground">
            提示：可直接从 Excel 选中两列复制粘贴，系统会自动识别「学号 姓名」。
          </p>
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
            <div className="text-sm text-foreground">
              {fileName ? fileName : "点击或拖拽上传 .xlsx 文件"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              表头需包含：班级名称、学号、姓名（支持中文表头）
            </div>
          </label>
          {preview.length > 0 && (
            <div className="border border-border max-h-60 overflow-auto">
              <div className="text-xs px-3 py-2 bg-muted/40 border-b border-border">
                共识别 {preview.length} 个班级 / {totalStudents} 名学生
              </div>
              <ul className="text-xs divide-y divide-border">
                {preview.map((c) => (
                  <li key={c.class_name} className="px-3 py-2 flex justify-between">
                    <span className="text-foreground">{c.class_name}</span>
                    <span className="text-muted-foreground">{c.students.length} 人</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {err && <div className="text-xs text-destructive">{err}</div>}
      {result && <div className="text-xs text-foreground">{result}</div>}

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="text-xs px-3 py-1.5 border border-border hover:bg-muted"
        >
          取消
        </button>
        <button
          onClick={() => void submit()}
          disabled={loading}
          className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-foreground text-background hover:opacity-90 disabled:opacity-40"
        >
          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          导入建班
        </button>
      </div>
    </div>
  );
}
