from fastapi import APIRouter, UploadFile, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
import json
from pydantic import BaseModel


router = APIRouter()

BASE_DIR = Path(__file__).resolve().parents[3]
DATA_DIR = BASE_DIR / "data"
DOCUMENTS_DIR = DATA_DIR / "documents"
ID_FILE = DATA_DIR / "id.txt"
empty = {"value": None, "status": "missing", "source": None}


def ensure_storage() -> None:
    DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
    (DOCUMENTS_DIR / "edits").mkdir(parents=True, exist_ok=True)
    if not ID_FILE.exists():
        ID_FILE.write_text("", encoding="utf-8")
    edit_id = DOCUMENTS_DIR / "edits" / "edit_id.txt"
    if not edit_id.exists():
        edit_id.write_text("", encoding="utf-8")


def document_files(folder: Path, attributes=False) -> list[Path]:
    if attributes:
        return [
        f
        for f in folder.iterdir()
        if f.is_file() and f.name == "attributes.json"
    ]
    else:
        return [
            f
            for f in folder.iterdir()
            if f.is_file() and f.name != "attributes.json"
        ]

def fields_cheсk(attr, key):
    if not attr or key not in attr:
        return empty
    return attr[key]

def date_cheсk(attr):
    if not attr:
        return []
    return attr.get('dates', [])

@router.get("/documents")
def list_documents():
    ensure_storage()
    documents = []
    for dir in DOCUMENTS_DIR.iterdir():

        if dir.is_dir():
            v1 = dir / "v1"
            if not v1.exists():
                continue

            files = document_files(v1)
            if not files:
                continue
            name = files[0].name

            documents.append(
                {
                    "id": int(dir.name),
                    "name": name,
                    "version": 1,
                    "status": "queued",
                }
            )
    return documents

@router.post("/documents")
async def upload(file: UploadFile):
    ensure_storage()
    name = file.filename
    content = await file.read()

    with open(ID_FILE, "r+", encoding="utf-8") as f:
        lines = f.readlines()
        if lines:
            id = int(lines[-1]) + 1
        else:
            id = 1
        f.write(str(id) + "\n")

    UPLOAD_DIR = DOCUMENTS_DIR / str(id) / "v1"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    file_path = UPLOAD_DIR / Path(name).name

    with open(file_path, "wb") as f:
        f.write(content)

    return {"id": id, "name": name, "version": 1, "status": "queued"}

@router.get("/documents/{id}")
async def get_document(id: int):
    document = DOCUMENTS_DIR / str(id) / "v1"
    if not document.exists():
        raise HTTPException(status_code=404, detail="Document not found")

    files = document_files(document)
    if not files:
        raise HTTPException(status_code=404, detail="Document not found")
    name = files[0].name

    return {"id": id, "name": name, "version": 1, "status": "queued"}

@router.get("/documents/{id}/versions")
async def get_document_versions(id: int):
    VERSIONS_DIR = DOCUMENTS_DIR / str(id)
    if not VERSIONS_DIR.exists():
        raise HTTPException(status_code=404, detail="Versions not found")

    versions = [f for f in VERSIONS_DIR.iterdir() if f.is_dir()]
    if not versions:
        raise HTTPException(status_code=404, detail="Versions not found")

    version_data = []

    for ver in versions:
        files = document_files(ver)
        if not files:
            continue

        version_data.append(
            {
                "id": f"{id}-{ver.name}",
                "document_id": id,
                "version": int(ver.name[1:]),
                "name": files[0].name,
            }
        )

    version_data.sort(key=lambda v: v["version"])
    if not version_data:
        raise HTTPException(status_code=404, detail="Versions not found")

    return version_data

@router.get("/versions/{id_version}/download")
async def download_document_version(id_version: str):
    try:
        doc_id, ver_name = id_version.split("-", 1)
    except ValueError:
        raise HTTPException(status_code=404, detail="File not found")

    FILE_DIR = DOCUMENTS_DIR / doc_id / ver_name

    if not FILE_DIR.exists() or not FILE_DIR.is_dir():
        raise HTTPException(status_code=404, detail="File not found")

    files = document_files(FILE_DIR)
    if not files:
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(files[0], filename=files[0].name)

@router.get("/versions/{id_version}/attributes")
async def get_document_version_attributes(id_version: str):
    try:
        doc_id, ver_name = id_version.split("-", 1)
    except ValueError:
        raise HTTPException(status_code=404, detail="File not found")

    FILE_DIR = DOCUMENTS_DIR / doc_id / ver_name

    if not FILE_DIR.exists() or not FILE_DIR.is_dir():
        raise HTTPException(status_code=404, detail="File not found")

    files = document_files(FILE_DIR)
    if not files:
        raise HTTPException(status_code=404, detail="File not found")

    attributes_path = FILE_DIR / "attributes.json"
    if attributes_path.exists():
        with open(attributes_path, encoding="utf-8") as f:
            return json.load(f)

    attributes = {
        "process": {"value": None, "status": "missing", "source": None},
        "goal": {"value": None, "status": "missing", "source": None},
        "owners": {"value": None, "status": "missing", "source": None},
        "dates": [],
    }

    with open(attributes_path, "w", encoding="utf-8") as f:
        json.dump(attributes, f, ensure_ascii=False, indent=2)

    return attributes

class AskRequest(BaseModel):
    question: str

@router.post("/versions/{id_version}/ask")
async def chat_ask(id_version: str, body: AskRequest):
    try:
        doc_id, ver_name = id_version.split("-", 1)
    except ValueError:
        raise HTTPException(status_code=404, detail="File not found")

    FILE_DIR = DOCUMENTS_DIR / doc_id / ver_name

    if not FILE_DIR.exists() or not FILE_DIR.is_dir():
        raise HTTPException(status_code=404, detail="File not found")

    files = document_files(FILE_DIR)
    if not files:
        raise HTTPException(status_code=404, detail="File not found")

    question = body.question

    return {
        "answer": "В документе недостаточно данных для ответа.",
        "citations": [],
        "enough_data": False
    }
    
class EditRequest(BaseModel):
    instruction: str

@router.post('/versions/{id_version}/edits')
async def chat_edit(id_version:str, body: EditRequest):
    try:
        doc_id, ver_name = id_version.split("-", 1)
    except ValueError:
        raise HTTPException(status_code=404, detail="File not found")

    FILE_DIR = DOCUMENTS_DIR / doc_id / ver_name

    if not FILE_DIR.exists() or not FILE_DIR.is_dir():
        raise HTTPException(status_code=404, detail="File not found")

    files = document_files(FILE_DIR)
    if not files:
        raise HTTPException(status_code=404, detail="File not found")

    instruction = body.instruction

    enough_data = True # Временно

    DOC_DIR = DOCUMENTS_DIR / 'edits' / 'edit_id.txt'
    DOC_DIR.parent.mkdir(parents=True, exist_ok=True)
    if not DOC_DIR.exists():
        DOC_DIR.write_text("0\n", encoding="utf-8")

    with open(DOC_DIR, "r+", encoding="utf-8") as f:
        lines = f.readlines()
        if lines:
            edit_id = int(lines[-1]) + 1
        else:
            edit_id = 1
        f.write(str(edit_id) + "\n")

    if enough_data:
        data = {
            "id": f"edit-{edit_id}",
            "version_id": id_version,
            "instruction": instruction,
            "status": "preview",
            "diff": {
                "unified": "--- v1\n+++ proposed\n@@\n-срок 14 дней\n+срок 30 дней\n"
            },
            "enough_data": True
        }
    else:
        data = {
            "id": f"edit-{edit_id}",
            "status": "rejected",
            "diff": None,
            "enough_data": False,
            "message": "В документе недостаточно данных для правки."
        }

    with open(DOCUMENTS_DIR/ 'edits' / f"edit-{edit_id}.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    return data

@router.post("/edits/{edit_id}/confirm")
async def edit_confirm(edit_id: str):
    EDIT_DIR = DOCUMENTS_DIR / 'edits' / f'{edit_id}.json'
    if not EDIT_DIR.exists():
        raise HTTPException(status_code=404, detail="Edit not found")

    with open(EDIT_DIR, encoding="utf-8") as f:
        edit = json.load(f)

    if (edit.get('diff') == None) or (edit.get('status') != "preview"):
        raise HTTPException(status_code=400, detail="Эту правку нельзя подтвердить")

    try:
        doc_id, ver_name = edit.get('version_id').split("-", 1)
    except ValueError:
        raise HTTPException(status_code=404, detail="Ошибка в правке")
    
    VER_DIR = DOCUMENTS_DIR / doc_id / ver_name

    files = document_files(VER_DIR)
    if not files:
        raise HTTPException(status_code=404, detail="File not found")

    content = files[0].read_bytes()
    # Изменяем документ здесь...
    
    edit["status"] = "confirmed"
    new_ver = sum(1 for item in (DOCUMENTS_DIR / doc_id).iterdir() if item.is_dir()) + 1

    with open(EDIT_DIR, "w", encoding="utf-8") as f:
        json.dump(edit, f, ensure_ascii=False, indent=2)

    NEW_DIR = DOCUMENTS_DIR / doc_id / f'v{new_ver}'
    NEW_DIR.mkdir(parents=True, exist_ok=True)

    with open(NEW_DIR / files[0].name, "wb") as f:
        f.write(content)
    
    return {
        "id": int(doc_id),
        "name": files[0].name,
        "version": new_ver,
        "version_id": f"{doc_id}-v{new_ver}",
        "status": "queued",
    }

@router.post("/edits/{edit_id}/cancel")
async def edit_cancel(edit_id: str):
    EDIT_DIR = DOCUMENTS_DIR / 'edits' / f'{edit_id}.json'
    if not EDIT_DIR.exists():
        raise HTTPException(status_code=404, detail="Edit not found")

    with open(EDIT_DIR, encoding="utf-8") as f:
        edit = json.load(f)

    if (edit.get('diff') == None) or (edit.get('status') != "preview"):
        raise HTTPException(status_code=400, detail="Эту правку нельзя отменить")

    edit['status'] = 'canceled'

    with open(EDIT_DIR, "w", encoding="utf-8") as f:
        json.dump(edit, f, ensure_ascii=False, indent=2)

    return edit

@router.get("/documents/{id}/compare")
async def compare_doc(id: int, first_ver: str, second_ver: str):
    try:
        doc_id, first_ver_name = first_ver.split("-", 1)
        doc1_id, second_ver_name = second_ver.split("-", 1)
    except ValueError:
        raise HTTPException(status_code=404, detail="Ошибка при сравнении")

    if doc_id != doc1_id or str(id) != doc_id:
        raise HTTPException(status_code=404, detail="Ошибка при сравнении")

    FILE_DIR = DOCUMENTS_DIR / doc_id
    if not FILE_DIR.is_dir():
        raise HTTPException(status_code=404, detail="File not found")
    VER1_DIR, VER2_DIR = FILE_DIR / first_ver_name, FILE_DIR / second_ver_name
    if not VER1_DIR.is_dir() or not VER2_DIR.is_dir():
        raise HTTPException(status_code=404, detail="Version not found")

    first_file, second_file = document_files(VER1_DIR), document_files(VER2_DIR)
    if not first_file or not second_file:
        raise HTTPException(status_code=404, detail="File not found")

    attr1_path = VER1_DIR / "attributes.json"
    attr2_path = VER2_DIR / "attributes.json"

    first_attributes = (
        json.loads(attr1_path.read_text(encoding="utf-8"))
        if attr1_path.exists()
        else None
    )
    second_attributes = (
        json.loads(attr2_path.read_text(encoding="utf-8"))
        if attr2_path.exists()
        else None
    )

    name1 = first_file[0].name
    name2 = second_file[0].name
    content1, content2 = first_file[0].read_bytes(), second_file[0].read_bytes()
            
    if content1 == content2: # Заглушка
        return {
            "document_id": int(doc_id),
            "from": { "version_id": first_ver, "version": int(first_ver_name[1:]), "name": name1 },
            "to": { "version_id": second_ver, "version": int(second_ver_name[1:]), "name": name2 },
            "text_diff": {
                "unified": "--- v1\n+++ v3\n@@\n-старый абзац\n+новый абзац\n"
            },
            "attributes_diff": {
                "process": {
                    "from": fields_cheсk(first_attributes, 'process'),
                    "to": fields_cheсk(second_attributes, 'process'),
                    "changed": fields_cheсk(first_attributes, 'process') != fields_cheсk(second_attributes, 'process')
                },
                "goal": {
                    "from": fields_cheсk(first_attributes, 'goal'),
                    "to": fields_cheсk(second_attributes, 'goal'),
                    "changed": fields_cheсk(first_attributes, 'goal') != fields_cheсk(second_attributes, 'goal')
                },
                "owners": {
                    "from": fields_cheсk(first_attributes, 'owners'),
                    "to": fields_cheсk(second_attributes, 'owners'),
                    "changed": fields_cheсk(first_attributes, 'owners') != fields_cheсk(second_attributes, 'owners')
                },
                "dates": {
                "from": date_cheсk(first_attributes),
                "to": date_cheсk(second_attributes),
                "changed": date_cheсk(first_attributes) != date_cheсk(second_attributes)
                }
            }
        }

    return {
        "document_id": int(doc_id),
        "from": { "version_id": first_ver, "version": int(first_ver_name[1:]), "name": name1 },
        "to": { "version_id": second_ver, "version": int(second_ver_name[1:]), "name": name2 },
        "text_diff": {
            "unified": "--- v1\n+++ v3\n@@\n-старый абзац\n+новый абзац\n"
        },
        "attributes_diff": {
            "process": {
                "from": fields_cheсk(first_attributes, 'process'),
                "to": fields_cheсk(second_attributes, 'process'),
                "changed": fields_cheсk(first_attributes, 'process') != fields_cheсk(second_attributes, 'process')
            },
            "goal": {
                "from": fields_cheсk(first_attributes, 'goal'),
                "to": fields_cheсk(second_attributes, 'goal'),
                "changed": fields_cheсk(first_attributes, 'goal') != fields_cheсk(second_attributes, 'goal')
            },
            "owners": {
                "from": fields_cheсk(first_attributes, 'owners'),
                "to": fields_cheсk(second_attributes, 'owners'),
                "changed": fields_cheсk(first_attributes, 'owners') != fields_cheсk(second_attributes, 'owners')
            },
            "dates": {
            "from": date_cheсk(first_attributes),
            "to": date_cheсk(second_attributes),
            "changed": date_cheсk(first_attributes) != date_cheсk(second_attributes)
            }
        }
    }