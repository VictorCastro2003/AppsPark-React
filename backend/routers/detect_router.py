# backend/app/routers/detect_router.py
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import JSONResponse
from pathlib import Path
import tempfile, uuid, base64, shutil
from ..detection import detect_from_path
from typing import Optional

router = APIRouter(prefix="/detect", tags=["detect"])

def _save_upload_to_temp(upload_file: UploadFile, name_prefix="upload") -> Path:
    suffix = Path(upload_file.filename).suffix or ".jpg"
    tmp = Path(tempfile.gettempdir()) / f"{name_prefix}_{uuid.uuid4().hex}{suffix}"
    with tmp.open("wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)
    return tmp

@router.post("/upload")
async def detect_upload(file: UploadFile = File(...)):
    tmp = _save_upload_to_temp(file, "img")
    try:
        result = detect_from_path(str(tmp))
        annotated_path = result.get("annotated_path")
        if annotated_path and Path(annotated_path).exists():
            with open(annotated_path, "rb") as f:
                result["annotated_image_b64"] = base64.b64encode(f.read()).decode()
        else:
            annotated_bytes = result.get("annotated_bytes")
            result["annotated_image_b64"] = base64.b64encode(annotated_bytes).decode() if annotated_bytes else None
        return JSONResponse(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        tmp.unlink(missing_ok=True)

@router.post("/frame")
async def detect_frame(frame: UploadFile = File(...), resize_width: Optional[int] = None):
    tmp = _save_upload_to_temp(frame, "frame")
    try:
        result = detect_from_path(str(tmp), resize_width=resize_width)
        annotated_path = result.get("annotated_path")
        if annotated_path and Path(annotated_path).exists():
            with open(annotated_path, "rb") as f:
                result["annotated_image_b64"] = base64.b64encode(f.read()).decode()
        else:
            annotated_bytes = result.get("annotated_bytes")
            result["annotated_image_b64"] = base64.b64encode(annotated_bytes).decode() if annotated_bytes else None
        return JSONResponse(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        tmp.unlink(missing_ok=True)
