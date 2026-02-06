"""
Driver management routes
"""
import uuid
from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from database import get_db
from models import Profile, UserRole, User, AppRole, Trip
from auth import get_current_user, require_admin, TokenData, get_password_hash

router = APIRouter()


class DriverCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    license_number: Optional[str] = None
    license_expiry: Optional[date] = None
    address: Optional[str] = None


class DriverUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    license_number: Optional[str] = None
    license_expiry: Optional[date] = None
    address: Optional[str] = None


class RoleAssignment(BaseModel):
    user_id: str
    role: str


def profile_to_dict(profile: Profile, user: User = None, role: UserRole = None) -> dict:
    return {
        "id": str(profile.id),
        "user_id": str(profile.user_id),
        "full_name": profile.full_name,
        "phone": profile.phone,
        "license_number": profile.license_number,
        "license_expiry": str(profile.license_expiry) if profile.license_expiry else None,
        "address": profile.address,
        "avatar_url": profile.avatar_url,
        "email": user.email if user else None,
        "role": role.role.value if role else None,
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
        "updated_at": profile.updated_at.isoformat() if profile.updated_at else None
    }


@router.get("")
async def list_drivers(
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List all profiles (admin only) - for driver management page"""
    # Get all profiles (not just drivers) for the management page
    profiles = db.query(Profile).order_by(Profile.created_at.desc()).all()
    
    result = []
    for profile in profiles:
        user = db.query(User).filter(User.id == profile.user_id).first()
        role = db.query(UserRole).filter(UserRole.user_id == profile.user_id).first()
        result.append(profile_to_dict(profile, user, role))
    
    return result


@router.get("/roles")
async def list_roles(
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List all user roles (admin only)"""
    roles = db.query(UserRole).all()
    return [{
        "id": str(r.id),
        "user_id": str(r.user_id),
        "role": r.role.value,
        "created_at": r.created_at.isoformat() if r.created_at else None
    } for r in roles]


@router.post("/assign-role")
async def assign_role(
    data: RoleAssignment,
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Assign or update a role for a user (admin only)"""
    try:
        user_id = uuid.UUID(data.user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format")
    
    # Validate role
    try:
        role_enum = AppRole(data.role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid role: {data.role}")
    
    # Check if user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if role exists
    existing = db.query(UserRole).filter(UserRole.user_id == user_id).first()
    
    if existing:
        existing.role = role_enum
    else:
        new_role = UserRole(
            id=uuid.uuid4(),
            user_id=user_id,
            role=role_enum
        )
        db.add(new_role)
    
    db.commit()
    return {"message": "Role assigned successfully"}


@router.post("/create")
async def create_driver_alt(
    driver_data: DriverCreate,
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create a new driver - alternative endpoint for frontend compatibility"""
    # Check if email exists
    existing = db.query(User).filter(User.email == driver_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = User(
        id=uuid.uuid4(),
        email=driver_data.email,
        encrypted_password=get_password_hash(driver_data.password),
        email_confirmed_at=None,
        raw_user_meta_data={"full_name": driver_data.full_name}
    )
    db.add(user)
    db.flush()
    
    # Create profile
    profile = Profile(
        id=uuid.uuid4(),
        user_id=user.id,
        full_name=driver_data.full_name,
        phone=driver_data.phone,
        license_number=driver_data.license_number,
        license_expiry=driver_data.license_expiry,
        address=driver_data.address
    )
    db.add(profile)
    db.flush()
    
    # Assign driver role
    user_role = UserRole(
        id=uuid.uuid4(),
        user_id=user.id,
        role=AppRole.driver
    )
    db.add(user_role)
    
    db.commit()
    
    return profile_to_dict(profile, user, user_role)


@router.get("/{driver_id}")
async def get_driver(
    driver_id: str,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a single driver by profile ID"""
    profile = db.query(Profile).filter(Profile.id == uuid.UUID(driver_id)).first()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    # Check access
    if current_user.role != "admin" and str(profile.id) != current_user.profile_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    user = db.query(User).filter(User.id == profile.user_id).first()
    role = db.query(UserRole).filter(UserRole.user_id == profile.user_id).first()
    
    return profile_to_dict(profile, user, role)


@router.post("")
async def create_driver(
    driver_data: DriverCreate,
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create a new driver (admin only)"""
    # Check if email exists
    existing = db.query(User).filter(User.email == driver_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = User(
        id=uuid.uuid4(),
        email=driver_data.email,
        encrypted_password=get_password_hash(driver_data.password),
        email_confirmed_at=None,  # Will be set on email confirmation
        raw_user_meta_data={"full_name": driver_data.full_name}
    )
    db.add(user)
    db.flush()
    
    # Create profile
    profile = Profile(
        id=uuid.uuid4(),
        user_id=user.id,
        full_name=driver_data.full_name,
        phone=driver_data.phone,
        license_number=driver_data.license_number,
        license_expiry=driver_data.license_expiry,
        address=driver_data.address
    )
    db.add(profile)
    db.flush()
    
    # Assign driver role
    user_role = UserRole(
        id=uuid.uuid4(),
        user_id=user.id,
        role=AppRole.driver
    )
    db.add(user_role)
    
    db.commit()
    
    return profile_to_dict(profile, user, user_role)


@router.put("/{driver_id}")
async def update_driver(
    driver_id: str,
    driver_data: DriverUpdate,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a driver"""
    profile = db.query(Profile).filter(Profile.id == uuid.UUID(driver_id)).first()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    # Check access
    if current_user.role != "admin" and str(profile.id) != current_user.profile_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_data = driver_data.dict(exclude_unset=True)
    
    for key, value in update_data.items():
        setattr(profile, key, value)
    
    db.commit()
    db.refresh(profile)
    
    user = db.query(User).filter(User.id == profile.user_id).first()
    role = db.query(UserRole).filter(UserRole.user_id == profile.user_id).first()
    
    return profile_to_dict(profile, user, role)


@router.delete("/{driver_id}")
async def delete_driver(
    driver_id: str,
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete a driver (admin only)"""
    profile = db.query(Profile).filter(Profile.id == uuid.UUID(driver_id)).first()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    # First, update all trips with this driver to store the driver name snapshot
    db.query(Trip).filter(Trip.driver_id == profile.id).update(
        {Trip.driver_name_snapshot: profile.full_name},
        synchronize_session=False
    )
    
    # Delete user role
    db.query(UserRole).filter(UserRole.user_id == profile.user_id).delete(synchronize_session=False)
    
    # Delete user (cascades to role)
    user = db.query(User).filter(User.id == profile.user_id).first()
    if user:
        db.delete(user)
    
    # Delete profile
    db.delete(profile)
    db.commit()
    
    return {"message": "Driver deleted successfully"}
