"use client";

import { X } from "lucide-react";
import type { CompareResult, DocumentVersion } from "@/lib/api";
import { attributeStatusLabel } from "@/lib/labels";
import { btnOutline, btnPrimary } from "@/lib/ui";

type Props = {
  open: boolean;
  documentName?: string;
  versions: DocumentVersion[];
  fromId: string | null;
  toId: string | null;
  result: CompareResult | null;
  comparing: boolean;
  onFromChange: (id: string) => void;
  onToChange: (id: string) => void;
  onCompare: () => void;
  onClose: () => void;
};

export function CompareDialog({
  open,
  documentName,
  versions,
  fromId,
  toId,
  result,
  comparing,
  onFromChange,
  onToChange,
  onCompare,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-dialog-title"
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div>
            <h2 id="compare-dialog-title" className="font-serif text-xl">
              Сравнение версий
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {documentName ?? "Документ"}
            </p>
          </div>
          <button
            type="button"
            className={btnOutline}
            aria-label="Закрыть"
            onClick={onClose}
          >
            <X />
          </button>
        </header>

        <div className="flex flex-wrap items-end gap-3 border-b border-border px-4 py-3 sm:px-5">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">От</span>
            <select
              className="h-9 min-w-36 rounded-lg border border-input bg-background px-2.5 text-sm"
              value={fromId ?? ""}
              onChange={(e) => onFromChange(e.target.value)}
            >
              {versions.map((version) => (
                <option key={`modal-from-${version.id}`} value={version.id}>
                  v{version.version} · {version.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">До</span>
            <select
              className="h-9 min-w-36 rounded-lg border border-input bg-background px-2.5 text-sm"
              value={toId ?? ""}
              onChange={(e) => onToChange(e.target.value)}
            >
              {versions.map((version) => (
                <option key={`modal-to-${version.id}`} value={version.id}>
                  v{version.version} · {version.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={btnPrimary}
            disabled={comparing || !fromId || !toId || fromId === toId}
            onClick={onCompare}
          >
            {comparing ? "Сравнение…" : "Сравнить"}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-sm sm:px-5">
          {fromId && toId && fromId === toId ? (
            <p className="text-muted-foreground">Выберите две разные версии.</p>
          ) : comparing ? (
            <p className="text-muted-foreground">Сравниваем версии…</p>
          ) : !result ? (
            <p className="text-muted-foreground">
              Выберите версии и нажмите «Сравнить».
            </p>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-xs tracking-[0.12em] text-muted-foreground uppercase">
                  Текст
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {result.from.version_id} → {result.to.version_id}
                </p>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl border border-border bg-muted/30 px-3 py-3 font-mono text-[13px] leading-5">
                  {result.text_diff.unified || "Нет текстового diff"}
                </pre>
              </div>
              <div>
                <p className="text-xs tracking-[0.12em] text-muted-foreground uppercase">
                  Атрибуты
                </p>
                <dl className="mt-2 space-y-3">
                  {(
                    [
                      ["Процесс", result.attributes_diff.process],
                      ["Цель", result.attributes_diff.goal],
                      ["Ответственные", result.attributes_diff.owners],
                    ] as const
                  ).map(([label, field]) => (
                    <div key={label}>
                      <dt className="text-xs text-muted-foreground">
                        {label}
                        {field.changed ? (
                          <span className="ml-2 text-foreground">изменено</span>
                        ) : null}
                      </dt>
                      <dd className="mt-1 grid gap-1 sm:grid-cols-2">
                        <span>
                          было: {field.from?.value ?? "—"}
                          {field.from ? (
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({attributeStatusLabel(field.from.status)})
                            </span>
                          ) : null}
                        </span>
                        <span>
                          стало: {field.to?.value ?? "—"}
                          {field.to ? (
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({attributeStatusLabel(field.to.status)})
                            </span>
                          ) : null}
                        </span>
                      </dd>
                    </div>
                  ))}
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Даты
                      {result.attributes_diff.dates.changed ? (
                        <span className="ml-2 text-foreground">изменено</span>
                      ) : null}
                    </dt>
                    <dd className="mt-1 grid gap-1 sm:grid-cols-2">
                      <span>
                        было:{" "}
                        {result.attributes_diff.dates.from.length === 0
                          ? "—"
                          : result.attributes_diff.dates.from
                              .map((date) =>
                                [date.role, date.value].filter(Boolean).join(": "),
                              )
                              .join("; ")}
                      </span>
                      <span>
                        стало:{" "}
                        {result.attributes_diff.dates.to.length === 0
                          ? "—"
                          : result.attributes_diff.dates.to
                              .map((date) =>
                                [date.role, date.value].filter(Boolean).join(": "),
                              )
                              .join("; ")}
                      </span>
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
