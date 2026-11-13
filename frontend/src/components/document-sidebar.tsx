"use client";

import { useRef } from "react";
import { FileText, Search, Upload } from "lucide-react";
import type { DocumentItem } from "@/lib/api";
import { statusLabel } from "@/lib/labels";
import { btnPrimary } from "@/lib/ui";

type Props = {
  documents: DocumentItem[];
  filtered: DocumentItem[];
  selected: DocumentItem | null;
  query: string;
  loadingList: boolean;
  uploading: boolean;
  error: string | null;
  onQueryChange: (value: string) => void;
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSelect: (doc: DocumentItem) => void;
};

export function DocumentSidebar({
  documents,
  filtered,
  selected,
  query,
  loadingList,
  uploading,
  error,
  onQueryChange,
  onUpload,
  onSelect,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="flex h-full min-h-0 flex-col border-b border-border bg-[oklch(0.955_0.012_85)] lg:border-r lg:border-b-0">
      <div className="border-b border-border px-3 py-3">
        <input
          ref={fileInputRef}
          id="file-input"
          type="file"
          multiple
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          onChange={onUpload}
        />
        <button
          id="upload-button"
          type="button"
          className={btnPrimary}
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload />
          {uploading ? "Загрузка…" : "Выбрать файл"}
        </button>
        {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
      </div>
      <label className="relative mx-3 mt-3 block">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          id="file-search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Найти в списке"
          className="h-8 w-full rounded-lg border border-input bg-card pr-2 pl-7 text-sm outline-none"
        />
      </label>
      <div
        id="file-list"
        className="mx-3 mt-3 mb-3 min-h-0 flex-1 overflow-y-auto rounded-xl border border-dashed border-border text-sm"
      >
        {loadingList ? (
          <p className="px-3 py-6 text-muted-foreground">Загрузка списка…</p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-6 text-muted-foreground">
            {documents.length === 0
              ? "Здесь будет список загруженных документов."
              : "Ничего не найдено."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((doc) => {
              const active = selected != null && String(doc.id) === String(selected.id);
              return (
                <li key={String(doc.id)}>
                  <button
                    type="button"
                    onClick={() => onSelect(doc)}
                    className={`flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors ${
                      active ? "bg-background" : "hover:bg-background/70"
                    }`}
                  >
                    <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{doc.name}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        v{doc.version} · {statusLabel(doc.status)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
