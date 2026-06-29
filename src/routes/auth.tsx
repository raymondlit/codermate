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
  const [mode, setMode] = useState<Mode>("signin");
  const [role, setRole] = useState<Role>("student");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already signed in, send to home
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/" });
    });
  }, [navigate]);

  const [info, setInfo] = useState<string | null>(null);

  // If already signed in, send to home
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/" });
    });
  }, [navigate]);

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
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
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
