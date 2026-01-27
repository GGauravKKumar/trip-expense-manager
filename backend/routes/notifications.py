"""
Notifications routes
"""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from models import Notification
from auth import get_current_user, TokenData

router = APIRouter()


@router.get("")
async def list_notifications(
    unread_only: bool = False,
    limit: int = 50,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List notifications for current user"""
    query = db.query(Notification).filter(
        Notification.user_id == uuid.UUID(current_user.user_id)
    )
    
    if unread_only:
        query = query.filter(Notification.read == False)
    
    notifications = query.order_by(Notification.created_at.desc()).limit(limit).all()
    
    return [{
        "id": str(n.id),
        "title": n.title,
        "message": n.message,
        "type": n.type,
        "read": n.read,
        "link": n.link,
        "created_at": n.created_at.isoformat() if n.created_at else None
    } for n in notifications]


@router.put("/{notification_id}/read")
async def mark_as_read(
    notification_id: str,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a notification as read"""
    notification = db.query(Notification).filter(
        Notification.id == uuid.UUID(notification_id),
        Notification.user_id == uuid.UUID(current_user.user_id)
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notification.read = True
    db.commit()
    
    return {"message": "Notification marked as read"}


@router.put("/read-all")
async def mark_all_as_read(
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark all notifications as read"""
    db.query(Notification).filter(
        Notification.user_id == uuid.UUID(current_user.user_id),
        Notification.read == False
    ).update({"read": True})
    
    db.commit()
    
    return {"message": "All notifications marked as read"}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a notification"""
    notification = db.query(Notification).filter(
        Notification.id == uuid.UUID(notification_id),
        Notification.user_id == uuid.UUID(current_user.user_id)
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    db.delete(notification)
    db.commit()
    
    return {"message": "Notification deleted"}
