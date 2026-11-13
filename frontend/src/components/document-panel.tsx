"use client";

import { Download, GitCompare } from "lucide-react";
import type {
  DocumentAttributes,
  DocumentItem,
  DocumentVersion,
} from "@/lib/api";
import { attributeStatusLabel, statusLabel } from "@/lib/labels";
import { btnOutline } from "@/lib/ui";

type Props = {
  selected: DocumentItem | null;
  versions: DocumentVersion[];
  activeVersion: DocumentVersion | null;
  attributes: DocumentAttributes | null;
  loadingVersions: boolean;
  loadingAttributes: boolean;
  onSelectVersion: (versionId: string) => void;
  onDownload: () => void;
  onCompare: () => void;
};

export function DocumentPanel({
  selected,
  versions,
  activeVersion,
  attributes,
  loadingVersions,
  loadingAttributes,
  onSelectVersion,
  onDownload,
  onCompare,
}: Props) {
  return (
    <section id="document-panel" className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div>
          <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
            Документ
          </p>
          <h1 className="mt-1 font-serif text-2xl leading-tight">
            {selected?.name ?? "Карточка выбранного файла"}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {selected
              ? `ID ${selected.id} · ${statusLabel(selected.status)}${
                  activeVersion ? ` · выбрана v${activeVersion.version}` : ""
                }`
              : "Статус, версии, атрибуты и текст появятся здесь."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            id="download-button"
            type="button"
            className={btnOutline}
            disabled={!activeVersion}
            onClick={onDownload}
          >
            <Download />
            Скачать версию
          </button>
          <button
            id="compare-button"
            type="button"
            className={btnOutline}
            disabled={!selected || versions.length < 2}
            onClick={onCompare}
          >
            <GitCompare />
            Сравнить версии
          </button>
        </div>
      </header>
      <div className="flex gap-1 border-b border-border px-4 pt-2 sm:px-5">
        <button
          id="summary-tab"
          type="button"
          className="border-b-2 border-foreground px-3 py-2 text-sm"
        >
          Сводка
        </button>
        <button
          id="text-tab"
          type="button"
          className="border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground"
        >
          Текст
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
        <div id="version-list" className="rounded-xl border border-dashed border-border text-sm">
          {!selected ? (
            <p className="px-3 py-4 text-muted-foreground">Версии документа</p>
          ) : loadingVersions ? (
            <p className="px-3 py-4 text-muted-foreground">Загрузка версий…</p>
          ) : versions.length === 0 ? (
            <p className="px-3 py-4 text-muted-foreground">Версий пока нет</p>
          ) : (
            <ul className="divide-y divide-border">
              {versions.map((version) => {
                const active = version.id === activeVersion?.id;
                return (
                  <li key={version.id}>
                    <button
                      type="button"
                      onClick={() => onSelectVersion(version.id)}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors ${
                        active ? "bg-[oklch(0.955_0.012_85)]" : "hover:bg-muted/40"
                      }`}
                    >
                      <span>
                        <span className="block font-medium">v{version.version}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {version.name}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">{version.id}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div
          id="attribute-list"
          className="rounded-xl border border-dashed border-border px-3 py-4 text-sm"
        >
          {!selected ? (
            <p className="text-muted-foreground">Процесс, цель, ответственные и даты</p>
          ) : loadingAttributes ? (
            <p className="text-muted-foreground">Загрузка атрибутов…</p>
          ) : !attributes ? (
            <p className="text-muted-foreground">Атрибуты недоступны</p>
          ) : (
            <dl className="space-y-3">
              {(
                [
                  ["Процесс", attributes.process],
                  ["Цель", attributes.goal],
                  ["Ответственные", attributes.owners],
                ] as const
              ).map(([label, field]) => (
                <div key={label}>
                  <dt className="text-xs tracking-[0.12em] text-muted-foreground uppercase">
                    {label}
                  </dt>
                  <dd className="mt-1">
                    {field.value ?? "—"}
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({attributeStatusLabel(field.status)})
                    </span>
                  </dd>
                </div>
              ))}
              <div>
                <dt className="text-xs tracking-[0.12em] text-muted-foreground uppercase">
                  Даты
                </dt>
                <dd className="mt-1 text-muted-foreground">
                  {attributes.dates.length === 0
                    ? "—"
                    : attributes.dates
                        .map((date) => [date.role, date.value].filter(Boolean).join(": "))
                        .join("; ")}
                </dd>
              </div>
            </dl>
          )}
        </div>
        <div
          id="document-text"
          className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground"
        >
          Текст выбранной версии
        </div>
      </div>
    </section>
  );
}
