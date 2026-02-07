"""
Admin settings routes
"""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from models import AdminSetting
from auth import get_current_user, require_admin, TokenData

router = APIRouter()


class SettingUpdate(BaseModel):
    value: str
    description: Optional[str] = None


@router.get("")
async def list_settings(
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List all admin settings (admin only)"""
    settings = db.query(AdminSetting).order_by(AdminSetting.key).all()
    
    return [{
        "id": str(s.id),
        "key": s.key,
        "value": s.value,
        "description": s.description,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None
    } for s in settings]


@router.get("/{key}")
async def get_setting(
    key: str,
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get a single setting by key, returns default if not found"""
    # Default values for known settings
    defaults = {
        "expiry_alert_days": "30",
        "fuel_price_per_liter": "90",
        "gst_percentage": "18",
    }
    
    setting = db.query(AdminSetting).filter(AdminSetting.key == key).first()
    
    if not setting:
        default_val = defaults.get(key)
        if default_val is not None:
            return {"id": None, "key": key, "value": default_val, "description": None}
        raise HTTPException(status_code=404, detail="Setting not found")
    
    return {
        "id": str(setting.id),
        "key": setting.key,
        "value": setting.value,
        "description": setting.description
    }


@router.put("")
async def update_settings_bulk(
    body: dict,
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Bulk update settings (admin only) - accepts { settings: [{key, value}] }"""
    settings_list = body.get("settings", [])
    results = []
    for item in settings_list:
        key = item.get("key")
        value = item.get("value", "")
        if not key:
            continue
        setting = db.query(AdminSetting).filter(AdminSetting.key == key).first()
        if not setting:
            setting = AdminSetting(id=uuid.uuid4(), key=key, value=value)
            db.add(setting)
        else:
            setting.value = value
        results.append({"key": key, "value": value})
    db.commit()
    return results


@router.put("/{key}")
async def update_setting(
    key: str,
    setting_data: SettingUpdate,
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update a setting (admin only)"""
    setting = db.query(AdminSetting).filter(AdminSetting.key == key).first()
    
    if not setting:
        # Create new setting
        setting = AdminSetting(
            id=uuid.uuid4(),
            key=key,
            value=setting_data.value,
            description=setting_data.description
        )
        db.add(setting)
    else:
        setting.value = setting_data.value
        if setting_data.description is not None:
            setting.description = setting_data.description
    
    db.commit()
    db.refresh(setting)
    
    return {
        "id": str(setting.id),
        "key": setting.key,
        "value": setting.value,
        "description": setting.description
    }
