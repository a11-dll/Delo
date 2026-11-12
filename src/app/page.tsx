"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileText, GitCompare, Search, Upload, X } from "lucide-react";
import {
  askVersion,
  cancelEdit,
  compareVersions,
  confirmEdit,
  createEdit,
  getDocument,
  getVersionAttributes,
  listDocuments,
  listDocumentVersions,
  uploadDocument,
  versionDownloadUrl,
  type CompareResult,
  type DocumentAttributes,
  type DocumentItem,
  type DocumentVersion,
  type EditPreview,
} from "@/lib/api";

type ChatMode = "question" | "edit";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  versionId?: string;
  enoughData?: boolean;
  edit?: EditPreview;
  editResolved?: "confirmed" | "canceled";
};

const primary =
  "inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50";
const outline =
  "inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium disabled:opacity-50";

function statusLabel(status: string) {
  switch (status) {
    case "queued":
      return "В очереди";
    case "processing":
      return "Обработка";
    case "ready":
      return "Готов";
    case "failed":
      return "Ошибка";
    default:
      return status;
  }
}

function attributeStatusLabel(status: string) {
  switch (status) {
    case "found":
      return "найдено";
    case "missing":
      return "не найдено";
    case "ambiguous":
      return "неоднозначно";
    default:
      return status;
  }
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selected, setSelected] = useState<DocumentItem | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [attributes, setAttributes] = useState<DocumentAttributes | null>(null);
  const [query, setQuery] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [loadingAttributes, setLoadingAttributes] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatMode, setChatMode] = useState<ChatMode>("question");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [resolvingEditId, setResolvingEditId] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareFromId, setCompareFromId] = useState<string | null>(null);
  const [compareToId, setCompareToId] = useState<string | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [comparing, setComparing] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const filtered = documents.filter((doc) =>
    doc.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const activeVersion =
    versions.find((version) => version.id === selectedVersionId) ?? versions[0] ?? null;

  async function refreshList(selectId?: number | string) {
    const items = await listDocuments();
    setDocuments(items);
    if (selectId != null) {
      const found = items.find((doc) => String(doc.id) === String(selectId));
      if (found) {
        setSelected(found);
        await loadVersions(found.id);
      }
    }
  }

  async function loadVersions(
    documentId: number | string,
    preferVersionId?: string,
  ) {
    setLoadingVersions(true);
    try {
      const items = await listDocumentVersions(documentId);
      setVersions(items);
      const preferred =
        preferVersionId && items.some((item) => item.id === preferVersionId)
          ? preferVersionId
          : null;
      const latest = items[items.length - 1]?.id ?? null;
      setSelectedVersionId(preferred ?? latest);
      setCompareFromId(items.length >= 2 ? items[items.length - 2].id : items[0]?.id ?? null);
      setCompareToId(latest);
      setCompareResult(null);
    } catch (err) {
      setVersions([]);
      setSelectedVersionId(null);
      setAttributes(null);
      setCompareFromId(null);
      setCompareToId(null);
      setCompareResult(null);
      setError(err instanceof Error ? err.message : "Не удалось загрузить версии");
    } finally {
      setLoadingVersions(false);
    }
  }

  useEffect(() => {
    if (!selectedVersionId) {
      setAttributes(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoadingAttributes(true);
        const data = await getVersionAttributes(selectedVersionId);
        if (!cancelled) setAttributes(data);
      } catch (err) {
        if (!cancelled) {
          setAttributes(null);
          setError(err instanceof Error ? err.message : "Не удалось загрузить атрибуты");
        }
      } finally {
        if (!cancelled) setLoadingAttributes(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedVersionId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingList(true);
        setError(null);
        const items = await listDocuments();
        if (!cancelled) setDocuments(items);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Не удалось загрузить список");
        }
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files;
    if (!chosen?.length) return;

    const files = Array.from(chosen);
    event.target.value = "";
    setUploading(true);
    setError(null);

    try {
      let last: DocumentItem | null = null;
      for (const file of files) {
        last = await uploadDocument(file);
      }
      await refreshList(last?.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  }

  async function handleSelect(doc: DocumentItem) {
    setSelected(doc);
    setError(null);
    try {
      const fresh = await getDocument(doc.id);
      setSelected(fresh);
      setDocuments((prev) =>
        prev.map((item) => (String(item.id) === String(fresh.id) ? fresh : item)),
      );
      await loadVersions(fresh.id);
    } catch (err) {
      setVersions([]);
      setSelectedVersionId(null);
      setAttributes(null);
      setError(err instanceof Error ? err.message : "Не удалось открыть документ");
    }
  }

  function handleDownload() {
    if (!activeVersion) return;
    window.location.href = versionDownloadUrl(activeVersion.id);
  }

  function openCompareModal() {
    if (!selected || versions.length < 2) return;
    setError(null);
    setCompareOpen(true);
  }

  function closeCompareModal() {
    setCompareOpen(false);
  }

  async function handleCompare() {
    if (!selected || !compareFromId || !compareToId) return;
    if (compareFromId === compareToId) {
      setError("Выберите две разные версии для сравнения.");
      setCompareResult(null);
      return;
    }

    setComparing(true);
    setError(null);
    try {
      const result = await compareVersions(selected.id, compareFromId, compareToId);
      setCompareResult(result);
    } catch (err) {
      setCompareResult(null);
      setError(err instanceof Error ? err.message : "Не удалось сравнить версии");
    } finally {
      setComparing(false);
    }
  }

  useEffect(() => {
    if (!compareOpen) return;
    if (!compareFromId || !compareToId || compareFromId === compareToId) {
      setCompareResult(null);
      return;
    }
    void handleCompare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareOpen, compareFromId, compareToId, selected?.id]);

  useEffect(() => {
    if (!compareOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeCompareModal();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [compareOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, sending]);

  async function handleSend() {
    const text = chatInput.trim();
    if (!text || sending) return;

    if (!activeVersion) {
      setError("Сначала выберите документ и версию.");
      return;
    }

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text,
      versionId: activeVersion.id,
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setSending(true);
    setError(null);

    try {
      if (chatMode === "question") {
        const result = await askVersion(activeVersion.id, text);
        setChatMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: result.answer,
            versionId: activeVersion.id,
            enoughData: result.enough_data,
          },
        ]);
        return;
      }

      const preview = await createEdit(activeVersion.id, text);
      const assistantText =
        preview.status === "preview" && preview.diff?.unified
          ? preview.diff.unified
          : preview.message || "Правку подготовить не удалось.";

      setChatMessages((prev) => [
        ...prev,
        {
          id: `e-${preview.id}`,
          role: "assistant",
          text: assistantText,
          versionId: activeVersion.id,
          enoughData: preview.enough_data,
          edit: preview,
        },
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : chatMode === "question"
            ? "Не удалось отправить вопрос"
            : "Не удалось подготовить правку",
      );
    } finally {
      setSending(false);
    }
  }

  async function handleConfirmEdit(editId: string) {
    if (!selected || resolvingEditId) return;
    setResolvingEditId(editId);
    setError(null);
    try {
      const result = await confirmEdit(editId);
      setChatMessages((prev) =>
        prev.map((message) =>
          message.edit?.id === editId
            ? {
                ...message,
                editResolved: "confirmed",
                text: `${message.text}\n\nПрименено → ${result.version_id}`,
              }
            : message,
        ),
      );
      await loadVersions(selected.id, result.version_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось применить правку");
    } finally {
      setResolvingEditId(null);
    }
  }

  async function handleCancelEdit(editId: string) {
    if (resolvingEditId) return;
    setResolvingEditId(editId);
    setError(null);
    try {
      await cancelEdit(editId);
      setChatMessages((prev) =>
        prev.map((message) =>
          message.edit?.id === editId
            ? {
                ...message,
                editResolved: "canceled",
                text: `${message.text}\n\nПравка отменена.`,
              }
            : message,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отменить правку");
    } finally {
      setResolvingEditId(null);
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="border-b border-border px-4 py-3 sm:px-5">
        <p className="font-serif text-xl leading-none">Дело</p>
        <p className="mt-1 text-xs text-muted-foreground">Документы, вопросы и версии</p>
      </header>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(9.5rem,26vh)_minmax(0,1fr)] lg:grid-cols-[320px_minmax(0,1fr)] lg:grid-rows-1">
        <section className="flex h-full min-h-0 flex-col border-b border-border bg-[oklch(0.955_0.012_85)] lg:border-r lg:border-b-0">
          <div className="border-b border-border px-3 py-3">
            <input
              ref={fileInputRef}
              id="file-input"
              type="file"
              multiple
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only"
              onChange={handleFilesSelected}
            />
            <button
              id="upload-button"
              type="button"
              className={primary}
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
              onChange={(e) => setQuery(e.target.value)}
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
                        onClick={() => handleSelect(doc)}
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

        <section id="document-panel" className="flex h-full min-h-0 flex-col bg-background">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
            <div>
              <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">Документ</p>
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
                className={outline}
                disabled={!activeVersion}
                onClick={handleDownload}
              >
                <Download />
                Скачать версию
              </button>
              <button
                id="compare-button"
                type="button"
                className={outline}
                disabled={!selected || versions.length < 2}
                onClick={openCompareModal}
              >
                <GitCompare />
                Сравнить версии
              </button>
            </div>
          </header>
          <div className="flex gap-1 border-b border-border px-4 pt-2 sm:px-5">
            <button id="summary-tab" type="button" className="border-b-2 border-foreground px-3 py-2 text-sm">
              Сводка
            </button>
            <button id="text-tab" type="button" className="border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground">
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
                          onClick={() => setSelectedVersionId(version.id)}
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
            <div id="attribute-list" className="rounded-xl border border-dashed border-border px-3 py-4 text-sm">
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
                            .map((date) =>
                              [date.role, date.value].filter(Boolean).join(": "),
                            )
                            .join("; ")}
                    </dd>
                  </div>
                </dl>
              )}
            </div>
            <div id="document-text" className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
              Текст выбранной версии
            </div>
          </div>
        </section>
      </div>

      <section id="chat" className="flex h-60 shrink-0 flex-col border-t border-border bg-card lg:h-[min(36vh,320px)]">
        <header className="flex items-center gap-2 border-b border-border px-3 py-2 sm:px-4">
          <h2 className="font-serif text-lg">Диалог</h2>
          <div className="flex rounded-lg bg-muted p-0.5 text-sm">
            <button
              id="question-mode"
              type="button"
              className={`rounded-md px-2.5 py-1 ${
                chatMode === "question"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground"
              }`}
              onClick={() => setChatMode("question")}
            >
              Вопрос
            </button>
            <button
              id="edit-mode"
              type="button"
              className={`rounded-md px-2.5 py-1 ${
                chatMode === "edit"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground"
              }`}
              onClick={() => setChatMode("edit")}
            >
              Правка
            </button>
          </div>
          {activeVersion ? (
            <span className="ml-auto text-xs text-muted-foreground">
              по версии {activeVersion.id}
            </span>
          ) : null}
        </header>
        <div id="chat-messages" className="min-h-0 flex-1 overflow-y-auto px-3 py-3 text-sm sm:px-4">
          {chatMessages.length === 0 ? (
            <p className="text-muted-foreground">
              {chatMode === "question"
                ? "Задайте вопрос по выбранной версии документа."
                : "Опишите правку обычным текстом. Появится diff и кнопки подтверждения."}
            </p>
          ) : (
            <ul className="space-y-3">
              {chatMessages.map((message) => (
                <li
                  key={message.id}
                  className={message.role === "user" ? "text-right" : "text-left"}
                >
                  <div
                    className={`inline-block max-w-[90%] rounded-xl px-3 py-2 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <p
                      className={`whitespace-pre-wrap ${
                        message.edit
                          ? "font-mono text-[13px] leading-5"
                          : "text-sm leading-5"
                      }`}
                    >
                      {message.text}
                    </p>
                    {message.role === "assistant" && message.enoughData === false ? (
                      <p className="mt-1 text-xs opacity-70">
                        Недостаточно данных в документе
                      </p>
                    ) : null}
                    {message.edit?.status === "preview" && !message.editResolved ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={primary}
                          disabled={resolvingEditId === message.edit.id}
                          onClick={() => void handleConfirmEdit(message.edit!.id)}
                        >
                          {resolvingEditId === message.edit.id ? "…" : "Применить"}
                        </button>
                        <button
                          type="button"
                          className={outline}
                          disabled={resolvingEditId === message.edit.id}
                          onClick={() => void handleCancelEdit(message.edit!.id)}
                        >
                          Отменить
                        </button>
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
              {sending ? (
                <li className="text-left text-muted-foreground">
                  {chatMode === "question" ? "Ответ формируется…" : "Готовим diff…"}
                </li>
              ) : null}
            </ul>
          )}
          <div ref={chatEndRef} />
        </div>
        <div className="flex items-end gap-2 border-t border-border px-3 py-2 sm:px-4">
          <textarea
            id="chat-input"
            rows={2}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder={
              chatMode === "question" ? "Вопрос по документу" : "Описание правки"
            }
            className="min-h-14 flex-1 rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none"
          />
          <button
            id="send-button"
            type="button"
            className={primary}
            disabled={sending || !chatInput.trim()}
            onClick={() => void handleSend()}
          >
            {sending ? "…" : "Отправить"}
          </button>
        </div>
      </section>

      {compareOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeCompareModal}
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
                  {selected?.name ?? "Документ"}
                </p>
              </div>
              <button
                type="button"
                className={outline}
                aria-label="Закрыть"
                onClick={closeCompareModal}
              >
                <X />
              </button>
            </header>

            <div className="flex flex-wrap items-end gap-3 border-b border-border px-4 py-3 sm:px-5">
              <label className="text-sm">
                <span className="mb-1 block text-xs text-muted-foreground">От</span>
                <select
                  className="h-9 min-w-36 rounded-lg border border-input bg-background px-2.5 text-sm"
                  value={compareFromId ?? ""}
                  onChange={(e) => setCompareFromId(e.target.value)}
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
                  value={compareToId ?? ""}
                  onChange={(e) => setCompareToId(e.target.value)}
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
                className={primary}
                disabled={
                  comparing ||
                  !compareFromId ||
                  !compareToId ||
                  compareFromId === compareToId
                }
                onClick={() => void handleCompare()}
              >
                {comparing ? "Сравнение…" : "Сравнить"}
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-sm sm:px-5">
              {compareFromId && compareToId && compareFromId === compareToId ? (
                <p className="text-muted-foreground">Выберите две разные версии.</p>
              ) : comparing ? (
                <p className="text-muted-foreground">Сравниваем версии…</p>
              ) : !compareResult ? (
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
                      {compareResult.from.version_id} → {compareResult.to.version_id}
                    </p>
                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl border border-border bg-muted/30 px-3 py-3 font-mono text-[13px] leading-5">
                      {compareResult.text_diff.unified || "Нет текстового diff"}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs tracking-[0.12em] text-muted-foreground uppercase">
                      Атрибуты
                    </p>
                    <dl className="mt-2 space-y-3">
                      {(
                        [
                          ["Процесс", compareResult.attributes_diff.process],
                          ["Цель", compareResult.attributes_diff.goal],
                          ["Ответственные", compareResult.attributes_diff.owners],
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
                          {compareResult.attributes_diff.dates.changed ? (
                            <span className="ml-2 text-foreground">изменено</span>
                          ) : null}
                        </dt>
                        <dd className="mt-1 grid gap-1 sm:grid-cols-2">
                          <span>
                            было:{" "}
                            {compareResult.attributes_diff.dates.from.length === 0
                              ? "—"
                              : compareResult.attributes_diff.dates.from
                                  .map((date) =>
                                    [date.role, date.value].filter(Boolean).join(": "),
                                  )
                                  .join("; ")}
                          </span>
                          <span>
                            стало:{" "}
                            {compareResult.attributes_diff.dates.to.length === 0
                              ? "—"
                              : compareResult.attributes_diff.dates.to
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
      ) : null}
    </div>
  );
}
