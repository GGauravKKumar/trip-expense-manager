"""
Authentication routes - Login, Signup, Password change
"""
import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from database import get_db
from models import User, Profile, UserRole, AppRole
from auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, TokenData
)

router = APIRouter()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Login with email and password"""
    # Find user
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Verify password
    if not verify_password(request.password, user.encrypted_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Get profile and role
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    user_role = db.query(UserRole).filter(UserRole.user_id == user.id).first()
    
    if not profile or not user_role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User profile not found"
        )
    
    # Create token
    access_token = create_access_token({
        "sub": str(user.id),
        "role": user_role.role.value,
        "profile_id": str(profile.id)
    })
    
    return AuthResponse(
        access_token=access_token,
        user={
            "id": str(user.id),
            "email": user.email,
            "full_name": profile.full_name,
            "role": user_role.role.value,
            "profile_id": str(profile.id)
        }
    )


@router.post("/signup", response_model=AuthResponse)
async def signup(request: SignupRequest, db: Session = Depends(get_db)):
    """Create a new user account (requires admin for role assignment)"""
    # Check if email exists
    existing = db.query(User).filter(User.email == request.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create user
    user = User(
        id=uuid.uuid4(),
        email=request.email,
        encrypted_password=get_password_hash(request.password),
        email_confirmed_at=datetime.utcnow(),
        raw_user_meta_data={"full_name": request.full_name}
    )
    db.add(user)
    db.flush()
    
    # Create profile
    profile = Profile(
        id=uuid.uuid4(),
        user_id=user.id,
        full_name=request.full_name
    )
    db.add(profile)
    db.flush()
    
    # Assign default role (driver - can be changed by admin later)
    user_role = UserRole(
        id=uuid.uuid4(),
        user_id=user.id,
        role=AppRole.driver
    )
    db.add(user_role)
    
    db.commit()
    
    # Create token
    access_token = create_access_token({
        "sub": str(user.id),
        "role": user_role.role.value,
        "profile_id": str(profile.id)
    })
    
    return AuthResponse(
        access_token=access_token,
        user={
            "id": str(user.id),
            "email": user.email,
            "full_name": profile.full_name,
            "role": user_role.role.value,
            "profile_id": str(profile.id)
        }
    )


@router.get("/me")
async def get_current_user_info(
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user information"""
    user = db.query(User).filter(User.id == uuid.UUID(current_user.user_id)).first()
    profile = db.query(Profile).filter(Profile.id == uuid.UUID(current_user.profile_id)).first()
    
    if not user or not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": profile.full_name,
        "role": current_user.role,
        "profile_id": str(profile.id),
        "phone": profile.phone,
        "license_number": profile.license_number,
        "license_expiry": str(profile.license_expiry) if profile.license_expiry else None,
        "address": profile.address,
        "avatar_url": profile.avatar_url
    }


@router.post("/change-password")
async def change_password(
    request: PasswordChangeRequest,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change current user's password"""
    user = db.query(User).filter(User.id == uuid.UUID(current_user.user_id)).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Verify current password
    if not verify_password(request.current_password, user.encrypted_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Validate new password
    if len(request.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters"
        )
    
    # Update password
    user.encrypted_password = get_password_hash(request.new_password)
    db.commit()
    
    return {"message": "Password changed successfully"}
