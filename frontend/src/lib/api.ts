export type DocumentStatus = "queued" | "processing" | "ready" | "failed" | string;

export type DocumentItem = {
  id: number | string;
  name: string;
  version: number;
  status: DocumentStatus;
};

export type DocumentVersion = {
  id: string;
  document_id: number | string;
  version: number;
  name: string;
};

export type AttributeField = {
  value: string | null;
  status: "found" | "missing" | "ambiguous" | string;
  source: unknown;
};

export type AttributeDate = {
  value?: string | null;
  role?: string | null;
  status?: string;
  source?: unknown;
};

export type DocumentAttributes = {
  process: AttributeField;
  goal: AttributeField;
  owners: AttributeField;
  dates: AttributeDate[];
};

async function readError(response: Response) {
  try {
    const data = await response.json();
    if (typeof data?.detail === "string") return data.detail;
    return JSON.stringify(data);
  } catch {
    return response.statusText || "Ошибка запроса";
  }
}

export async function listDocuments(): Promise<DocumentItem[]> {
  const response = await fetch("/api/documents", { cache: "no-store" });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function getDocument(id: number | string): Promise<DocumentItem> {
  const response = await fetch(`/api/documents/${id}`, { cache: "no-store" });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function uploadDocument(file: File): Promise<DocumentItem> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch("/api/documents", { method: "POST", body });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function listDocumentVersions(
  documentId: number | string,
): Promise<DocumentVersion[]> {
  const response = await fetch(`/api/documents/${documentId}/versions`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export function versionDownloadUrl(versionId: string) {
  return `/api/versions/${encodeURIComponent(versionId)}/download`;
}

export async function getVersionAttributes(
  versionId: string,
): Promise<DocumentAttributes> {
  const response = await fetch(
    `/api/versions/${encodeURIComponent(versionId)}/attributes`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export type AskCitation = {
  text?: string;
  page?: number | null;
  section?: string | null;
  [key: string]: unknown;
};

export type AskResponse = {
  answer: string;
  citations: AskCitation[];
  enough_data: boolean;
};

export async function askVersion(
  versionId: string,
  question: string,
): Promise<AskResponse> {
  const response = await fetch(
    `/api/versions/${encodeURIComponent(versionId)}/ask`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    },
  );
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export type EditPreview = {
  id: string;
  version_id?: string;
  instruction?: string;
  status: "preview" | "rejected" | "confirmed" | "canceled" | string;
  diff: { unified?: string } | null;
  enough_data: boolean;
  message?: string;
};

export type EditConfirmResult = {
  id: number | string;
  name: string;
  version: number;
  version_id: string;
  status: string;
};

export async function createEdit(
  versionId: string,
  instruction: string,
): Promise<EditPreview> {
  const response = await fetch(
    `/api/versions/${encodeURIComponent(versionId)}/edits`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction }),
    },
  );
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function confirmEdit(editId: string): Promise<EditConfirmResult> {
  const response = await fetch(`/api/edits/${encodeURIComponent(editId)}/confirm`, {
    method: "POST",
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function cancelEdit(editId: string): Promise<EditPreview> {
  const response = await fetch(`/api/edits/${encodeURIComponent(editId)}/cancel`, {
    method: "POST",
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export type CompareSide = {
  version_id: string;
  version: number;
  name: string;
};

export type CompareFieldDiff = {
  from: AttributeField | null;
  to: AttributeField | null;
  changed: boolean;
};

export type CompareDatesDiff = {
  from: AttributeDate[];
  to: AttributeDate[];
  changed: boolean;
};

export type CompareResult = {
  document_id: number | string;
  from: CompareSide;
  to: CompareSide;
  text_diff: { unified?: string };
  attributes_diff: {
    process: CompareFieldDiff;
    goal: CompareFieldDiff;
    owners: CompareFieldDiff;
    dates: CompareDatesDiff;
  };
};

export async function compareVersions(
  documentId: number | string,
  firstVer: string,
  secondVer: string,
): Promise<CompareResult> {
  const params = new URLSearchParams({
    first_ver: firstVer,
    second_ver: secondVer,
  });
  const response = await fetch(`/api/documents/${documentId}/compare?${params}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}
