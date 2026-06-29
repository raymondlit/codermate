import { createFileRoute, useNavigate, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    invite: typeof s.invite === "string" ? s.invite : undefined,
  }),
  head: () => ({
    meta: [
      { title: "登录 · CodeMentor AI" },
      { name: "description", content: "登录或注册 CodeMentor AI，开始智能编程学习之旅。" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup";
type Role = "student" | "teacher";

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<Mode>(search.invite ? "signup" : "signin");
  const [role, setRole] = useState<Role>("student");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState(search.invite?.toUpperCase() ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // If already signed in, send to home (or join page if invite present)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      if (search.invite) void navigate({ to: "/join", search: { code: search.invite } });
      else void navigate({ to: "/" });
    });
  }, [navigate, search.invite]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              display_name: displayName || email.split("@")[0],
              role,
            },
          },
        });
        if (error) throw error;
        if (role === "teacher") {
          setInfo("教师注册申请已提交，请等待超级管理员审批。审批通过后即可使用教师功能。");
          setLoading(false);
          return;
        }
        // Student: try to join class by code if provided
        if (inviteCode.trim()) {
          const { error: joinErr } = await supabase.rpc("join_class_by_code", {
            _code: inviteCode.trim().toUpperCase(),
          });
          if (joinErr) {
            setInfo(`账号已创建，但加入班级失败：${joinErr.message}。你可以稍后在「加入班级」页面重试。`);
            setLoading(false);
            return;
          }
          void navigate({ to: "/join", search: { code: inviteCode.trim().toUpperCase() } });
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // 登录后若 URL 带邀请码，先去加入
        if (search.invite) {
          void navigate({ to: "/join", search: { code: search.invite } });
          return;
        }
      }
      void navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-[1400px] px-8 py-6 flex items-center justify-between">
          <Link to="/" className="text-base font-medium tracking-wide text-foreground">
            CodeMentor <span className="text-xs text-muted-foreground tracking-widest uppercase ml-1">AI</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" strokeWidth={1.5} />
            返回
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-xl text-foreground mb-2">
              {mode === "signin" ? "登录" : "创建账号"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {mode === "signin"
                ? "欢迎回来，继续你的学习"
                : "开启你的智能编程学习之旅"}
            </p>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-4">
            {mode === "signup" && (
              <>
                <div>
                  <label className="block text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">
                    昵称
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-card border border-border focus:border-foreground focus:outline-none transition-colors"
                    placeholder="如何称呼你"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">
                    身份
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["student", "teacher"] as Role[]).map((r) => (
                      <button
                        type="button"
                        key={r}
                        onClick={() => setRole(r)}
                        className={`px-3 py-2 text-xs border transition-colors ${
                          role === r
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {r === "student" ? "学生" : "教师"}
                      </button>
                    ))}
                  </div>
                </div>
                {role === "student" && (
                  <div>
                    <label className="block text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">
                      班级邀请码 <span className="normal-case tracking-normal">（可选）</span>
                    </label>
                    <input
                      type="text"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      maxLength={16}
                      className="w-full px-3 py-2 text-sm font-mono tracking-widest bg-card border border-border focus:border-foreground focus:outline-none uppercase"
                      placeholder="如有老师提供的邀请码请填写"
                    />
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">
                邮箱
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-card border border-border focus:border-foreground focus:outline-none transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">
                密码
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-card border border-border focus:border-foreground focus:outline-none transition-colors"
                placeholder="至少 6 位"
              />
            </div>

            {error && (
              <p className="text-xs text-destructive leading-relaxed">{error}</p>
            )}
            {info && (
              <p className="text-xs text-foreground leading-relaxed border-l-2 border-foreground pl-3 py-1">{info}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm transition-opacity disabled:opacity-40 hover:opacity-90 mt-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />}
              {mode === "signin" ? "登录" : "注册"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {mode === "signin"
                ? "还没有账号？立即注册"
                : "已有账号？前往登录"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
