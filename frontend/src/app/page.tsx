"use client";

import { useEffect, useRef, useState } from "react";
import { ChatPanel } from "@/components/chat-panel";
import { CompareDialog } from "@/components/compare-dialog";
import { DocumentPanel } from "@/components/document-panel";
import { DocumentSidebar } from "@/components/document-sidebar";
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
} from "@/lib/api";
import type { ChatMessage, ChatMode } from "@/lib/types";

export default function Home() {
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
      if (event.key === "Escape") setCompareOpen(false);
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

    setChatMessages((prev) => [
      ...prev,
      {
        id: `u-${Date.now()}`,
        role: "user",
        text,
        versionId: activeVersion.id,
      },
    ]);
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
      setChatMessages((prev) => [
        ...prev,
        {
          id: `e-${preview.id}`,
          role: "assistant",
          text:
            preview.status === "preview" && preview.diff?.unified
              ? preview.diff.unified
              : preview.message || "Правку подготовить не удалось.",
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
        <DocumentSidebar
          documents={documents}
          filtered={filtered}
          selected={selected}
          query={query}
          loadingList={loadingList}
          uploading={uploading}
          error={error}
          onQueryChange={setQuery}
          onUpload={handleFilesSelected}
          onSelect={handleSelect}
        />
        <DocumentPanel
          selected={selected}
          versions={versions}
          activeVersion={activeVersion}
          attributes={attributes}
          loadingVersions={loadingVersions}
          loadingAttributes={loadingAttributes}
          onSelectVersion={setSelectedVersionId}
          onDownload={handleDownload}
          onCompare={() => {
            if (!selected || versions.length < 2) return;
            setError(null);
            setCompareOpen(true);
          }}
        />
      </div>

      <ChatPanel
        chatMode={chatMode}
        chatInput={chatInput}
        chatMessages={chatMessages}
        sending={sending}
        resolvingEditId={resolvingEditId}
        activeVersion={activeVersion}
        chatEndRef={chatEndRef}
        onModeChange={setChatMode}
        onInputChange={setChatInput}
        onSend={() => void handleSend()}
        onConfirmEdit={(id) => void handleConfirmEdit(id)}
        onCancelEdit={(id) => void handleCancelEdit(id)}
      />

      <CompareDialog
        open={compareOpen}
        documentName={selected?.name}
        versions={versions}
        fromId={compareFromId}
        toId={compareToId}
        result={compareResult}
        comparing={comparing}
        onFromChange={setCompareFromId}
        onToChange={setCompareToId}
        onCompare={() => void handleCompare()}
        onClose={() => setCompareOpen(false)}
      />
    </div>
  );
}
