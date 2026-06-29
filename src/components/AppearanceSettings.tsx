import { useState } from "react";
import { Settings2, RotateCcw, Type, Palette, SunMoon, Ruler } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  APPEARANCE_OPTIONS,
  resetAppearance,
  setAppearance,
  useAppearance,
  type AccentKey,
  type DensityKey,
  type FontKey,
  type ThemeMode,
} from "@/lib/useAppearance";

export function AppearanceSettings() {
  const a = useAppearance();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="外观设置"
          className="fixed bottom-4 right-4 z-50 grid h-11 w-11 place-items-center rounded-full border border-border bg-card text-foreground shadow-sm transition hover:bg-accent sm:bottom-6 sm:right-6"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base font-medium">
            <Settings2 className="h-4 w-4" /> 外观与排版
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            实时预览，所有偏好保存在本地浏览器。
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-7 px-1">
          {/* Theme */}
          <Section icon={<SunMoon className="h-3.5 w-3.5" />} title="主题">
            <div className="grid grid-cols-2 gap-2">
              {APPEARANCE_OPTIONS.themes.map((t) => (
                <Chip
                  key={t.key}
                  active={a.theme === t.key}
                  onClick={() => setAppearance({ theme: t.key as ThemeMode })}
                >
                  {t.label}
                </Chip>
              ))}
            </div>
          </Section>

          {/* Accent */}
          <Section icon={<Palette className="h-3.5 w-3.5" />} title="强调色">
            <div className="flex flex-wrap gap-2">
              {APPEARANCE_OPTIONS.accents.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setAppearance({ accent: c.key as AccentKey })}
                  className={`group flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
                    a.accent === c.key
                      ? "border-foreground/40 bg-accent"
                      : "border-border hover:border-border-strong"
                  }`}
                  aria-label={c.label}
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full ring-1 ring-border"
                    style={{ background: c.swatch }}
                  />
                  {c.label}
                </button>
              ))}
            </div>
          </Section>

          {/* Font */}
          <Section icon={<Type className="h-3.5 w-3.5" />} title="字体">
            <div className="grid grid-cols-2 gap-2">
              {APPEARANCE_OPTIONS.fonts.map((f) => (
                <Chip
                  key={f.key}
                  active={a.font === f.key}
                  onClick={() => setAppearance({ font: f.key as FontKey })}
                >
                  <span style={{ fontFamily: f.stack }} className="text-sm">
                    {f.label}
                  </span>
                </Chip>
              ))}
            </div>
          </Section>

          {/* Font Size */}
          <Section
            icon={<Ruler className="h-3.5 w-3.5" />}
            title={`字号 · ${a.fontSize}px`}
          >
            <Slider
              min={13}
              max={19}
              step={1}
              value={[a.fontSize]}
              onValueChange={(v) => setAppearance({ fontSize: v[0] })}
            />
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>小</span>
              <span>标准</span>
              <span>大</span>
            </div>
          </Section>

          {/* Radius */}
          <Section title={`圆角 · ${a.radius.toFixed(2)}rem`}>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[a.radius]}
              onValueChange={(v) => setAppearance({ radius: v[0] })}
            />
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>方正</span>
              <span>柔和</span>
            </div>
          </Section>

          {/* Density */}
          <Section title="信息密度">
            <div className="grid grid-cols-3 gap-2">
              {APPEARANCE_OPTIONS.densities.map((d) => (
                <Chip
                  key={d.key}
                  active={a.density === d.key}
                  onClick={() => setAppearance({ density: d.key as DensityKey })}
                >
                  {d.label}
                </Chip>
              ))}
            </div>
          </Section>

          <Separator />

          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              已自动适配桌面 / 平板 / 手机
            </p>
            <Button variant="ghost" size="sm" onClick={() => resetAppearance()}>
              <RotateCcw className="mr-1.5 h-3 w-3" />
              重置
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Chip({
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
      className={`rounded-md border px-3 py-2 text-xs transition ${
        active
          ? "border-foreground/30 bg-accent text-foreground"
          : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
