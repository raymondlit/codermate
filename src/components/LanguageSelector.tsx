import { LANGUAGES, type LanguageId } from "@/lib/analyze.types";

interface Props {
  value: LanguageId;
  onChange: (lang: LanguageId) => void;
}

export function LanguageSelector({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {LANGUAGES.map((lang) => {
        const active = lang.id === value;
        return (
          <button
            key={lang.id}
            onClick={() => onChange(lang.id)}
            className={`px-4 py-1.5 text-[13px] tracking-wide transition-colors ${
              active
                ? "text-foreground border-b border-foreground"
                : "text-muted-foreground border-b border-transparent hover:text-foreground"
            }`}
          >
            {lang.label}
          </button>
        );
      })}
    </div>
  );
}
