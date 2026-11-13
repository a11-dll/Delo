"use client";

import type { RefObject } from "react";
import type { DocumentVersion } from "@/lib/api";
import type { ChatMessage, ChatMode } from "@/lib/types";
import { btnOutline, btnPrimary } from "@/lib/ui";

type Props = {
  chatMode: ChatMode;
  chatInput: string;
  chatMessages: ChatMessage[];
  sending: boolean;
  resolvingEditId: string | null;
  activeVersion: DocumentVersion | null;
  chatEndRef: RefObject<HTMLDivElement | null>;
  onModeChange: (mode: ChatMode) => void;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onConfirmEdit: (editId: string) => void;
  onCancelEdit: (editId: string) => void;
};

export function ChatPanel({
  chatMode,
  chatInput,
  chatMessages,
  sending,
  resolvingEditId,
  activeVersion,
  chatEndRef,
  onModeChange,
  onInputChange,
  onSend,
  onConfirmEdit,
  onCancelEdit,
}: Props) {
  return (
    <section
      id="chat"
      className="flex h-60 shrink-0 flex-col border-t border-border bg-card lg:h-[min(36vh,320px)]"
    >
      <header className="flex items-center gap-2 border-b border-border px-3 py-2 sm:px-4">
        <h2 className="font-serif text-lg">Диалог</h2>
        <div className="flex rounded-lg bg-muted p-0.5 text-sm">
          <button
            id="question-mode"
            type="button"
            className={`rounded-md px-2.5 py-1 ${
              chatMode === "question" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
            onClick={() => onModeChange("question")}
          >
            Вопрос
          </button>
          <button
            id="edit-mode"
            type="button"
            className={`rounded-md px-2.5 py-1 ${
              chatMode === "edit" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
            onClick={() => onModeChange("edit")}
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
      <div
        id="chat-messages"
        className="min-h-0 flex-1 overflow-y-auto px-3 py-3 text-sm sm:px-4"
      >
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
                      message.edit ? "font-mono text-[13px] leading-5" : "text-sm leading-5"
                    }`}
                  >
                    {message.text}
                  </p>
                  {message.role === "assistant" && message.enoughData === false ? (
                    <p className="mt-1 text-xs opacity-70">Недостаточно данных в документе</p>
                  ) : null}
                  {message.edit?.status === "preview" && !message.editResolved ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={btnPrimary}
                        disabled={resolvingEditId === message.edit.id}
                        onClick={() => onConfirmEdit(message.edit!.id)}
                      >
                        {resolvingEditId === message.edit.id ? "…" : "Применить"}
                      </button>
                      <button
                        type="button"
                        className={btnOutline}
                        disabled={resolvingEditId === message.edit.id}
                        onClick={() => onCancelEdit(message.edit!.id)}
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
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
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
          className={btnPrimary}
          disabled={sending || !chatInput.trim()}
          onClick={onSend}
        >
          {sending ? "…" : "Отправить"}
        </button>
      </div>
    </section>
  );
}
