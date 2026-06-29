import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Save,
  Trash2,
  Users,
  Copy,
  Check,
  X,
  Pencil,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/classes")({
  head: () => ({
    meta: [
      { title: "我的班级 · CodeMentor AI" },
      { name: "description", content: "教师端：创建班级、编辑信息、邀请学生加入。" },
    ],
  }),
  component: ClassesPage,
});

interface ClassRow {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  created_at: string;
  member_count?: number;
}

interface MemberRow {
  student_id: string;
  joined_at: string;
  display_name: string | null;
}

interface TeacherSettings {
  can_create_class: boolean;
  max_class_size: number;
}

function ClassesPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [settings, setSettings] = useState<TeacherSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.loading && auth.user && auth.role !== "teacher" && auth.role !== "super_admin") {
      void navigate({ to: "/" });
    }
  }, [auth.loading, auth.role, auth.user, navigate]);

  const reload = useCallback(async () => {
    if (!auth.user) return;
    setLoading(true);
    setErr(null);
    try {
      const [{ data: rows, error: e1 }, { data: ts }] = await Promise.all([
        supabase
          .from("classes")
          .select("id,name,description,invite_code,created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("teacher_settings")
          .select("can_create_class,max_class_size")
          .eq("teacher_id", auth.user.id)
          .maybeSingle(),
      ]);
      if (e1) throw e1;
      const list = (rows ?? []) as ClassRow[];
      // member counts
      if (list.length) {
        const { data: counts } = await supabase
          .from("class_members")
          .select("class_id")
          .in(
            "class_id",
            list.map((c) => c.id),
          );
        const map = new Map<string, number>();
        (counts ?? []).forEach((r: { class_id: string }) => {
          map.set(r.class_id, (map.get(r.class_id) ?? 0) + 1);
        });
        list.forEach((c) => (c.member_count = map.get(c.id) ?? 0));
      }
      setClasses(list);
      setSettings(ts ?? { can_create_class: true, max_class_size: 50 });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [auth.user]);

  useEffect(() => {
    if (auth.user) void reload();
  }, [auth.user, reload]);

  const loadMembers = useCallback(async (classId: string) => {
    setSelected(classId);
    const { data } = await supabase
      .from("class_members")
      .select("student_id,joined_at")
      .eq("class_id", classId)
      .order("joined_at", { ascending: false });
    const list = (data ?? []) as { student_id: string; joined_at: string }[];
    if (!list.length) {
      setMembers([]);
      return;
    }
    const { data: profs } = await supabase
      .from("profiles")
      .select("id,display_name")
      .in(
        "id",
        list.map((m) => m.student_id),
      );
    const map = new Map<string, string | null>();
    (profs ?? []).forEach((p: { id: string; display_name: string | null }) => {
      map.set(p.id, p.display_name);
    });
    setMembers(
      list.map((m) => ({
        student_id: m.student_id,
        joined_at: m.joined_at,
        display_name: map.get(m.student_id) ?? null,
      })),
    );
  }, []);

  const handleCreate = async () => {
    if (!auth.user || !newName.trim()) return;
    setErr(null);
    const { error } = await supabase.from("classes").insert({
      teacher_id: auth.user.id,
      name: newName.trim(),
      description: newDesc.trim() || null,
    });
    if (error) {
      setErr(error.message);
      return;
    }
    setNewName("");
    setNewDesc("");
    setCreating(false);
    await reload();
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) return;
    const { error } = await supabase
      .from("classes")
      .update({ name: editName.trim(), description: editDesc.trim() || null })
      .eq("id", id);
    if (error) {
      setErr(error.message);
      return;
    }
    setEditing(null);
    await reload();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确认删除该班级？学生关联将一并清除。")) return;
    const { error } = await supabase.from("classes").delete().eq("id", id);
    if (error) {
      setErr(error.message);
      return;
    }
    if (selected === id) {
      setSelected(null);
      setMembers([]);
    }
    await reload();
  };

  const handleRemoveMember = async (classId: string, studentId: string) => {
    if (!confirm("将该学生移出班级？")) return;
    await supabase
      .from("class_members")
      .delete()
      .eq("class_id", classId)
      .eq("student_id", studentId);
    await loadMembers(classId);
    await reload();
  };

  const copyInvite = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500);
    } catch {
      /* ignore */
    }
  };

  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!auth.user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        请先 <Link to="/auth" className="underline ml-1">登录</Link>
      </div>
    );
  }

  const canCreate = settings?.can_create_class !== false;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-[1400px] px-8 py-6 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> 返回
            </Link>
            <h1 className="text-base font-medium tracking-wide text-foreground ml-4">我的班级</h1>
            <span className="text-xs text-muted-foreground tracking-widest uppercase">CLASSES</span>
          </div>
          <div className="text-xs text-muted-foreground">
            班级规模上限：<span className="text-foreground">{settings?.max_class_size ?? "—"}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-[1400px] px-8 py-10 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-10">
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-medium text-foreground">班级列表</h2>
            {canCreate && !creating && (
              <button
                onClick={() => setCreating(true)}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border hover:bg-muted transition-colors"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> 新建班级
              </button>
            )}
          </div>

          {!canCreate && (
            <div className="mb-6 text-xs text-muted-foreground border border-border p-3 bg-muted/30">
              当前账号未被授予建班权限，请联系超级管理员开启。
            </div>
          )}

          {err && (
            <div className="mb-6 text-xs text-destructive border border-destructive/40 p-3">{err}</div>
          )}

          {creating && (
            <div className="border border-border p-5 mb-6 space-y-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="班级名称，如：财务智能 2026 春季 A 班"
                className="w-full text-sm bg-background border border-border px-3 py-2 focus:outline-none focus:border-foreground"
              />
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="班级简介（可选）"
                rows={2}
                className="w-full text-sm bg-background border border-border px-3 py-2 focus:outline-none focus:border-foreground"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setCreating(false);
                    setNewName("");
                    setNewDesc("");
                  }}
                  className="text-xs px-3 py-1.5 border border-border hover:bg-muted"
                >
                  取消
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                  className="text-xs px-3 py-1.5 bg-foreground text-background hover:opacity-90 disabled:opacity-40"
                >
                  创建
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : classes.length === 0 ? (
            <div className="text-xs text-muted-foreground border border-dashed border-border p-10 text-center">
              暂无班级。{canCreate ? "点击右上角「新建班级」开始。" : ""}
            </div>
          ) : (
            <div className="space-y-3">
              {classes.map((c) => {
                const isEdit = editing === c.id;
                return (
                  <div
                    key={c.id}
                    className={`border p-5 transition-colors ${
                      selected === c.id ? "border-foreground" : "border-border"
                    }`}
                  >
                    {isEdit ? (
                      <div className="space-y-3">
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full text-sm bg-background border border-border px-3 py-2 focus:outline-none focus:border-foreground"
                        />
                        <textarea
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          rows={2}
                          className="w-full text-sm bg-background border border-border px-3 py-2 focus:outline-none focus:border-foreground"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditing(null)}
                            className="text-xs px-3 py-1.5 border border-border hover:bg-muted"
                          >
                            取消
                          </button>
                          <button
                            onClick={() => void handleSaveEdit(c.id)}
                            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-foreground text-background"
                          >
                            <Save className="h-3 w-3" strokeWidth={1.5} /> 保存
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-sm font-medium text-foreground">{c.name}</h3>
                            {c.description && (
                              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{c.description}</p>
                            )}
                            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <Users className="h-3 w-3" strokeWidth={1.5} />
                                {c.member_count ?? 0}
                                {settings?.max_class_size ? ` / ${settings.max_class_size}` : ""} 人
                              </span>
                              <span>创建于 {new Date(c.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => void loadMembers(c.id)}
                              className="text-xs px-2 py-1 border border-border hover:bg-muted"
                            >
                              成员
                            </button>
                            <button
                              onClick={() => {
                                setEditing(c.id);
                                setEditName(c.name);
                                setEditDesc(c.description ?? "");
                              }}
                              className="p-1.5 text-muted-foreground hover:text-foreground"
                              title="编辑"
                            >
                              <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                            </button>
                            <button
                              onClick={() => void handleDelete(c.id)}
                              className="p-1.5 text-muted-foreground hover:text-destructive"
                              title="删除"
                            >
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 border-t border-border pt-3 flex items-center justify-between">
                          <div className="text-xs text-muted-foreground">
                            邀请码 · 学生在「加入班级」处输入即可加入
                          </div>
                          <button
                            onClick={() => void copyInvite(c.invite_code)}
                            className="inline-flex items-center gap-2 text-xs font-mono tracking-widest border border-border px-3 py-1.5 hover:bg-muted"
                          >
                            {c.invite_code}
                            {copied === c.invite_code ? (
                              <Check className="h-3.5 w-3.5 text-foreground" strokeWidth={1.5} />
                            ) : (
                              <Copy className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <aside className="lg:border-l lg:border-border lg:pl-10">
          <h2 className="text-sm font-medium text-foreground mb-6">班级成员</h2>
          {!selected ? (
            <p className="text-xs text-muted-foreground">点击班级卡片的「成员」查看名单。</p>
          ) : members.length === 0 ? (
            <p className="text-xs text-muted-foreground">暂无学生加入。把邀请码分享给学生即可。</p>
          ) : (
            <ul className="space-y-2">
              {members.map((m) => (
                <li
                  key={m.student_id}
                  className="flex items-center justify-between border border-border px-3 py-2"
                >
                  <div className="text-xs">
                    <div className="text-foreground">{m.display_name ?? m.student_id.slice(0, 8)}</div>
                    <div className="text-muted-foreground mt-0.5">
                      加入于 {new Date(m.joined_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => void handleRemoveMember(selected, m.student_id)}
                    className="p-1.5 text-muted-foreground hover:text-destructive"
                    title="移出班级"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </main>
    </div>
  );
}
