import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { ArrowLeft, Loader2, Check, X, Save, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "管理后台 · CodeMentor AI" },
      { name: "description", content: "超级管理员后台：教师审批、能力配置与 AI 算力管理。" },
    ],
  }),
  component: AdminPage,
});

type TabId = "approvals" | "teachers" | "quotas";

interface Application {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  status: string;
  note: string | null;
  created_at: string;
}

interface TeacherSettings {
  teacher_id: string;
  can_create_class: boolean;
  max_class_size: number;
  can_view_student_answers: boolean;
  ai_quota_tokens: number;
  ai_used_tokens: number;
  notes: string | null;
  display_name?: string | null;
  email?: string | null;
}

function AdminPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>("approvals");

  useEffect(() => {
    if (!auth.loading && auth.role !== "super_admin") {
      void navigate({ to: "/" });
    }
  }, [auth.loading, auth.role, navigate]);

  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
      </div>
    );
  }
  if (auth.role !== "super_admin") return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-[1400px] px-8 py-6 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <Link to="/" className="text-base font-medium tracking-wide text-foreground">
              CodeMentor <span className="text-xs text-muted-foreground tracking-widest uppercase ml-1">AI</span>
            </Link>
            <span className="text-xs text-muted-foreground">/ 管理后台</span>
          </div>
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" strokeWidth={1.5} />
            返回工作台
          </Link>
        </div>
        <div className="mx-auto max-w-[1400px] px-8 flex gap-6 border-t border-border">
          {([
            ["approvals", "教师审批"],
            ["teachers", "教师配置"],
            ["quotas", "AI 算力"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-1 py-3 text-xs tracking-wide border-b-2 transition-colors ${
                tab === id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-[1400px] w-full px-8 py-10">
        {tab === "approvals" && <ApprovalsTab />}
        {tab === "teachers" && <TeacherConfigTab />}
        {tab === "quotas" && <QuotasTab />}
      </main>
    </div>
  );
}

// ============ Approvals ============
function ApprovalsTab() {
  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("teacher_applications")
      .select("id,user_id,email,display_name,status,note,created_at")
      .order("created_at", { ascending: false });
    if (filter === "pending") q = q.eq("status", "pending");
    const { data } = await q;
    setItems((data ?? []) as Application[]);
    setLoading(false);
  }, [filter]);

  useEffect(() => void load(), [load]);

  const decide = async (id: string, approve: boolean) => {
    setBusy(id);
    try {
      const { error } = approve
        ? await supabase.rpc("approve_teacher", { _application_id: id })
        : await supabase.rpc("reject_teacher", { _application_id: id, _note: null });
      if (error) throw error;
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg text-foreground mb-1">教师注册审批</h2>
          <p className="text-xs text-muted-foreground">审批通过后将自动赋予教师角色并创建默认配置。</p>
        </div>
        <div className="flex gap-2">
          {(["pending", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs border transition-colors ${
                filter === f ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "pending" ? "待审批" : "全部"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin inline mr-2" strokeWidth={1.5} />加载中
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center text-xs text-muted-foreground border border-dashed border-border">
          暂无{filter === "pending" ? "待审批" : ""}申请
        </div>
      ) : (
        <div className="border border-border divide-y divide-border">
          {items.map((it) => (
            <div key={it.id} className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm text-foreground truncate">
                  {it.display_name || it.email || it.user_id}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {it.email} · 申请于 {new Date(it.created_at).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] uppercase tracking-widest px-2 py-1 border ${
                    it.status === "pending"
                      ? "border-foreground text-foreground"
                      : it.status === "approved"
                        ? "border-border text-muted-foreground"
                        : "border-destructive text-destructive"
                  }`}
                >
                  {it.status === "pending" ? "待审批" : it.status === "approved" ? "已通过" : "已拒绝"}
                </span>
                {it.status === "pending" && (
                  <>
                    <button
                      disabled={busy === it.id}
                      onClick={() => void decide(it.id, true)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-foreground text-background hover:opacity-90 disabled:opacity-40"
                    >
                      <Check className="h-3 w-3" strokeWidth={1.5} />通过
                    </button>
                    <button
                      disabled={busy === it.id}
                      onClick={() => void decide(it.id, false)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-border text-muted-foreground hover:text-foreground disabled:opacity-40"
                    >
                      <X className="h-3 w-3" strokeWidth={1.5} />拒绝
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ Teacher Config ============
function TeacherConfigTab() {
  const [rows, setRows] = useState<TeacherSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: settings } = await supabase
      .from("teacher_settings")
      .select("*")
      .order("created_at", { ascending: false });
    const ids = (settings ?? []).map((s) => s.teacher_id);
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id,display_name").in("id", ids)
      : { data: [] };
    const { data: apps } = ids.length
      ? await supabase.from("teacher_applications").select("user_id,email").in("user_id", ids)
      : { data: [] };
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
    const emailMap = new Map((apps ?? []).map((a) => [a.user_id, a.email]));
    setRows(
      (settings ?? []).map((s) => ({
        ...s,
        display_name: profileMap.get(s.teacher_id) ?? null,
        email: emailMap.get(s.teacher_id) ?? null,
      })) as TeacherSettings[]
    );
    setLoading(false);
  };

  useEffect(() => void load(), []);

  const update = (id: string, patch: Partial<TeacherSettings>) => {
    setRows((rs) => rs.map((r) => (r.teacher_id === id ? { ...r, ...patch } : r)));
  };

  const save = async (row: TeacherSettings) => {
    setSavingId(row.teacher_id);
    const { error } = await supabase
      .from("teacher_settings")
      .update({
        can_create_class: row.can_create_class,
        max_class_size: row.max_class_size,
        can_view_student_answers: row.can_view_student_answers,
        ai_quota_tokens: row.ai_quota_tokens,
        notes: row.notes,
      })
      .eq("teacher_id", row.teacher_id);
    setSavingId(null);
    if (error) alert(error.message);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg text-foreground mb-1">教师能力配置</h2>
        <p className="text-xs text-muted-foreground">配置每位教师是否可建立班级、班级规模上限、是否可查看学生答题情况。</p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin inline mr-2" strokeWidth={1.5} />加载中
        </div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-xs text-muted-foreground border border-dashed border-border">
          暂无已审批的教师
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.teacher_id} className="border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm text-foreground">{row.display_name ?? row.email ?? row.teacher_id}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{row.email}</div>
                </div>
                <button
                  onClick={() => void save(row)}
                  disabled={savingId === row.teacher_id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-foreground text-background hover:opacity-90 disabled:opacity-40"
                >
                  {savingId === row.teacher_id ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} /> : <Save className="h-3 w-3" strokeWidth={1.5} />}
                  保存
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">可建立班级</span>
                  <select
                    value={row.can_create_class ? "1" : "0"}
                    onChange={(e) => update(row.teacher_id, { can_create_class: e.target.value === "1" })}
                    className="px-2 py-1.5 text-sm bg-card border border-border focus:border-foreground focus:outline-none"
                  >
                    <option value="1">是</option>
                    <option value="0">否</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">班级规模上限</span>
                  <input
                    type="number"
                    min={1}
                    value={row.max_class_size}
                    onChange={(e) => update(row.teacher_id, { max_class_size: Number(e.target.value) || 0 })}
                    className="px-2 py-1.5 text-sm bg-card border border-border focus:border-foreground focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">可查看学生答题</span>
                  <select
                    value={row.can_view_student_answers ? "1" : "0"}
                    onChange={(e) => update(row.teacher_id, { can_view_student_answers: e.target.value === "1" })}
                    className="px-2 py-1.5 text-sm bg-card border border-border focus:border-foreground focus:outline-none"
                  >
                    <option value="1">是</option>
                    <option value="0">否</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">AI 算力额度 (tokens)</span>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={row.ai_quota_tokens}
                    onChange={(e) => update(row.teacher_id, { ai_quota_tokens: Number(e.target.value) || 0 })}
                    className="px-2 py-1.5 text-sm bg-card border border-border focus:border-foreground focus:outline-none"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ Quotas ============
function QuotasTab() {
  const [rows, setRows] = useState<TeacherSettings[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("teacher_settings")
        .select("teacher_id,ai_quota_tokens,ai_used_tokens,max_class_size,can_create_class,can_view_student_answers,notes,created_at,updated_at")
        .order("ai_used_tokens", { ascending: false });
      const ids = (data ?? []).map((s) => s.teacher_id);
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("id,display_name").in("id", ids)
        : { data: [] };
      const map = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
      setRows(
        (data ?? []).map((s) => ({
          ...s,
          display_name: map.get(s.teacher_id) ?? null,
        })) as TeacherSettings[]
      );
      setLoading(false);
    })();
  }, []);

  const reset = async (teacherId: string) => {
    if (!confirm("确认将该教师已用算力清零？")) return;
    const { error } = await supabase
      .from("teacher_settings")
      .update({ ai_used_tokens: 0 })
      .eq("teacher_id", teacherId);
    if (error) return alert(error.message);
    setRows((rs) => rs.map((r) => (r.teacher_id === teacherId ? { ...r, ai_used_tokens: 0 } : r)));
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg text-foreground mb-1">AI 算力概览</h2>
        <p className="text-xs text-muted-foreground">按教师维度查看 AI tokens 使用情况，可重置已用额度。</p>
      </div>
      {loading ? (
        <div className="py-12 text-center text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin inline mr-2" strokeWidth={1.5} />加载中
        </div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-xs text-muted-foreground border border-dashed border-border">暂无数据</div>
      ) : (
        <div className="border border-border">
          <div className="grid grid-cols-12 px-5 py-3 border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
            <div className="col-span-4">教师</div>
            <div className="col-span-2 text-right">已用</div>
            <div className="col-span-2 text-right">额度</div>
            <div className="col-span-3">用量</div>
            <div className="col-span-1 text-right">操作</div>
          </div>
          {rows.map((r) => {
            const pct = r.ai_quota_tokens > 0 ? Math.min(100, (r.ai_used_tokens / r.ai_quota_tokens) * 100) : 0;
            return (
              <div key={r.teacher_id} className="grid grid-cols-12 items-center px-5 py-4 border-b border-border last:border-b-0">
                <div className="col-span-4 text-sm text-foreground truncate">
                  {r.display_name ?? r.teacher_id}
                </div>
                <div className="col-span-2 text-right text-sm tabular-nums text-foreground">{r.ai_used_tokens.toLocaleString()}</div>
                <div className="col-span-2 text-right text-sm tabular-nums text-muted-foreground">{r.ai_quota_tokens.toLocaleString()}</div>
                <div className="col-span-3">
                  <div className="h-1.5 bg-border">
                    <div
                      className={`h-full ${pct >= 90 ? "bg-destructive" : "bg-foreground"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">{pct.toFixed(1)}%</div>
                </div>
                <div className="col-span-1 text-right">
                  <button
                    onClick={() => void reset(r.teacher_id)}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                    title="清零已用"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 inline" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
