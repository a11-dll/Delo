import type { EditPreview } from "@/lib/api";

export type ChatMode = "question" | "edit";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  versionId?: string;
  enoughData?: boolean;
  edit?: EditPreview;
  editResolved?: "confirmed" | "canceled";
};
