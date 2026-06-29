import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type DragEvent,
} from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { python } from "@codemirror/lang-python";
import { javascript } from "@codemirror/lang-javascript";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { html } from "@codemirror/lang-html";
import { FileUp, ClipboardPaste } from "lucide-react";
import type { LanguageId } from "@/lib/analyze.types";
import { LANGUAGES } from "@/lib/analyze.types";

interface Props {
  language: LanguageId;
  value: string;
  onChange: (code: string) => void;
}

export interface CodeInputHandle {
  jumpToLine: (line: number) => void;
}

function getExtension(lang: LanguageId) {
  switch (lang) {
    case "python":
      return [python()];
    case "javascript":
      return [javascript({ jsx: true, typescript: true })];
    case "java":
      return [java()];
    case "cpp":
    case "c":
      return [cpp()];
    case "html":
      return [html()];
    default:
      return [];
  }
}

export const CodeInput = forwardRef<CodeInputHandle, Props>(function CodeInput(
  { language, value, onChange },
  ref,
) {
  const [tab, setTab] = useState<"paste" | "upload">("paste");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cmRef = useRef<ReactCodeMirrorRef>(null);

  useImperativeHandle(ref, () => ({
    jumpToLine: (line: number) => {
      setTab("paste");
      // wait one frame for editor to be mounted/visible
      requestAnimationFrame(() => {
        const view = cmRef.current?.view;
        if (!view) return;
        const total = view.state.doc.lines;
        const target = Math.max(1, Math.min(total, Math.floor(line)));
        const lineObj = view.state.doc.line(target);
        view.dispatch({
          selection: { anchor: lineObj.from, head: lineObj.to },
          effects: EditorView.scrollIntoView(lineObj.from, { y: "center" }),
        });
        view.focus();
      });
    },
  }));

  const handleFile = async (file: File) => {
    const text = await file.text();
    onChange(text);
    setTab("paste");
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const accept = LANGUAGES.find((l) => l.id === language)?.ext.map((e) => "." + e).join(",");

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 mb-3">
        <button
          onClick={() => setTab("paste")}
          className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs transition-colors ${
            tab === "paste" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ClipboardPaste className="h-3.5 w-3.5" />
          粘贴代码
        </button>
        <span className="text-muted-foreground/40">·</span>
        <button
          onClick={() => setTab("upload")}
          className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs transition-colors ${
            tab === "upload" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileUp className="h-3.5 w-3.5" />
          上传文件
        </button>
        {value && (
          <button
            onClick={() => onChange("")}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            清空
          </button>
        )}
      </div>

      {tab === "paste" ? (
        <div className="flex-1 min-h-[420px] border border-border bg-card overflow-hidden">
          <CodeMirror
            ref={cmRef}
            value={value}
            height="100%"
            minHeight="420px"
            extensions={getExtension(language)}
            onChange={onChange}
            theme="light"
            basicSetup={{
              lineNumbers: true,
              foldGutter: false,
              highlightActiveLine: false,
              highlightActiveLineGutter: false,
            }}
            placeholder="在此粘贴你的代码…"
          />
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`flex-1 min-h-[420px] border border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${
            dragging ? "border-foreground bg-surface" : "border-border bg-card hover:bg-surface"
          }`}
        >
          <FileUp className="h-6 w-6 text-muted-foreground mb-3" strokeWidth={1.5} />
          <p className="text-sm text-foreground">拖拽文件到此处，或点击选择</p>
          <p className="text-xs text-muted-foreground mt-1.5">支持 {accept}</p>
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
        </div>
      )}
    </div>
  );
});
