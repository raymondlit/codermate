import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, CheckCircle2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/join")({
  validateSearch: (s: Record<string, unknown>) => ({
    code: typeof s.code === "string" ? s.code : undefined,
  }),
  head: () => ({
    meta: [
      { title: "加入班级 · CodeMentor AI" },
      { name: "description", content: "输入老师提供的邀请码，加入你的班级。" },
    ],
  }),
  component: JoinPage,
});

interface JoinedClass {
  id: string;
  name: string;
  description: string | null;
}

function JoinPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/join" });
  const [code, setCode] = useState(search.code?.toUpperCase() ?? "");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [joined, setJoined] = useState<JoinedClass | null>(null);

  // 自动尝试加入（若 URL 带 code 且已登录）
  useEffect(() => {
    if (!auth.loading && auth.user && search.code && !joined && !loading) {
      void handleJoin(search.code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.loading, auth.user, search.code]);

  const handleJoin = async (raw: string) => {
    const trimmed = raw.trim().toUpperCase();
    if (!trimmed) {
      setErr("请输入邀请码");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase.rpc("join_class_by_code", { _code: trimmed });
      if (error) throw error;
      const classId = data as string;
      const { data: cls } = await supabase
        .from("classes")
        .select("id,name,description")
        .eq("id", classId)
        .maybeSingle();
      setJoined(cls as JoinedClass);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加入失败";
      // 友好化常见错误
      if (msg.includes("Invalid invite code")) setErr("邀请码无效，请检查后重试。");
      else if (msg.includes("Class is full")) setErr("该班级已满员，请联系老师。");
      else if (msg.includes("signed in")) setErr("请先登录后再加入。");
      else setErr(msg);
    } finally {
      setLoading(false);
    }
  };

  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
            <ArrowLeft className="h-3 w-3" strokeWidth={1.5} /> 返回
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          {!auth.user ? (
            <div className="text-center">
              <h1 className="text-xl text-foreground mb-2">加入班级</h1>
              <p className="text-xs text-muted-foreground mb-6">
                请先登录或注册学生账号，然后输入老师提供的邀请码。
              </p>
              <Link
                to="/auth"
                search={search.code ? { invite: search.code } as never : undefined}
                className="inline-flex items-center justify-center px-5 py-2.5 bg-primary text-primary-foreground text-sm hover:opacity-90"
              >
                前往登录 / 注册
              </Link>
            </div>
          ) : joined ? (
            <div className="text-center border border-border p-8">
              <CheckCircle2 className="h-8 w-8 mx-auto text-foreground mb-3" strokeWidth={1.5} />
              <h1 className="text-base text-foreground mb-1">成功加入班级</h1>
              <p className="text-sm font-medium text-foreground mt-3">{joined.name}</p>
              {joined.description && (
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{joined.description}</p>
              )}
              <div className="mt-6 flex gap-2 justify-center">
                <Link to="/cases" className="text-xs px-4 py-2 border border-border hover:bg-muted">
                  浏览案例库
                </Link>
                <Link
                  to="/"
                  className="text-xs px-4 py-2 bg-foreground text-background hover:opacity-90"
                >
                  开始练习
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <Users className="h-7 w-7 mx-auto text-muted-foreground mb-3" strokeWidth={1.5} />
                <h1 className="text-xl text-foreground mb-2">加入班级</h1>
                <p className="text-xs text-muted-foreground">
                  输入老师分享的 8 位邀请码即可加入。
                </p>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleJoin(code);
                }}
                className="flex flex-col gap-4"
              >
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="如：A1B2C3D4"
                  maxLength={16}
                  className="w-full px-3 py-3 text-center text-base font-mono tracking-[0.3em] bg-card border border-border focus:border-foreground focus:outline-none uppercase"
                />
                {err && <p className="text-xs text-destructive leading-relaxed text-center">{err}</p>}
                <button
                  type="submit"
                  disabled={loading || !code.trim()}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm transition-opacity disabled:opacity-40 hover:opacity-90"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />}
                  确认加入
                </button>
                <button
                  type="button"
                  onClick={() => navigate({ to: "/" })}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  稍后再说
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
