"""
File upload routes
"""
import os
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
import aiofiles

from auth import get_current_user, TokenData

router = APIRouter()

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/app/uploads")


@router.post("/expense")
async def upload_expense_document(
    file: UploadFile = File(...),
    current_user: TokenData = Depends(get_current_user)
):
    """Upload an expense document"""
    allowed_types = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Allowed types: {', '.join(allowed_types)}"
        )
    
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, "expenses", filename)
    
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    async with aiofiles.open(filepath, "wb") as f:
        content = await file.read()
        await f.write(content)
    
    return {
        "url": f"/uploads/expenses/{filename}",
        "filename": filename,
        "content_type": file.content_type
    }


@router.post("/repair")
async def upload_repair_photo(
    file: UploadFile = File(...),
    current_user: TokenData = Depends(get_current_user)
):
    """Upload a repair photo"""
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Allowed types: {', '.join(allowed_types)}"
        )
    
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, "repairs", filename)
    
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    async with aiofiles.open(filepath, "wb") as f:
        content = await file.read()
        await f.write(content)
    
    return {
        "url": f"/uploads/repairs/{filename}",
        "filename": filename,
        "content_type": file.content_type
    }


@router.post("/logo")
async def upload_logo(
    file: UploadFile = File(...),
    current_user: TokenData = Depends(get_current_user)
):
    """Upload a company logo (admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Allowed types: {', '.join(allowed_types)}"
        )

    # Max 2MB
    content = await file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum 2MB.")

    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"company-logo.{ext}"
    logo_dir = os.path.join(UPLOAD_DIR, "logos")
    os.makedirs(logo_dir, exist_ok=True)

    # Remove any previous logo files
    for old_file in os.listdir(logo_dir):
        if old_file.startswith("company-logo"):
            os.remove(os.path.join(logo_dir, old_file))

    filepath = os.path.join(logo_dir, filename)
    async with aiofiles.open(filepath, "wb") as f:
        await f.write(content)

    return {
        "url": f"/uploads/logos/{filename}",
        "filename": filename,
        "content_type": file.content_type
    }


@router.delete("/expense/{filename}")
async def delete_expense_document(
    filename: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Delete an expense document"""
    filepath = os.path.join(UPLOAD_DIR, "expenses", filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")
    
    os.remove(filepath)
    
    return {"message": "File deleted successfully"}


@router.delete("/repair/{filename}")
async def delete_repair_photo(
    filename: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Delete a repair photo"""
    filepath = os.path.join(UPLOAD_DIR, "repairs", filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")
    
    os.remove(filepath)
    
    return {"message": "File deleted successfully"}
