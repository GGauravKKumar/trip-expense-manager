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
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Allowed types: {', '.join(allowed_types)}"
        )
    
    # Generate unique filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, "expenses", filename)
    
    # Save file
    async with aiofiles.open(filepath, "wb") as f:
        content = await file.read()
        await f.write(content)
    
    # Return URL path
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
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Allowed types: {', '.join(allowed_types)}"
        )
    
    # Generate unique filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, "repairs", filename)
    
    # Save file
    async with aiofiles.open(filepath, "wb") as f:
        content = await file.read()
        await f.write(content)
    
    # Return URL path
    return {
        "url": f"/uploads/repairs/{filename}",
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
