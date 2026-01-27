"""
Route management routes
"""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel

from database import get_db
from models import Route, IndianState
from auth import get_current_user, require_admin, TokenData

router = APIRouter()


class RouteCreate(BaseModel):
    route_name: str
    from_state_id: str
    to_state_id: str
    from_address: Optional[str] = None
    to_address: Optional[str] = None
    distance_km: Optional[float] = None
    estimated_duration_hours: Optional[float] = None


class RouteUpdate(BaseModel):
    route_name: Optional[str] = None
    from_state_id: Optional[str] = None
    to_state_id: Optional[str] = None
    from_address: Optional[str] = None
    to_address: Optional[str] = None
    distance_km: Optional[float] = None
    estimated_duration_hours: Optional[float] = None


def route_to_dict(route: Route) -> dict:
    return {
        "id": str(route.id),
        "route_name": route.route_name,
        "from_state_id": str(route.from_state_id),
        "to_state_id": str(route.to_state_id),
        "from_address": route.from_address,
        "to_address": route.to_address,
        "distance_km": float(route.distance_km) if route.distance_km else None,
        "estimated_duration_hours": float(route.estimated_duration_hours) if route.estimated_duration_hours else None,
        "from_state": {
            "id": str(route.from_state.id),
            "state_name": route.from_state.state_name,
            "state_code": route.from_state.state_code
        } if route.from_state else None,
        "to_state": {
            "id": str(route.to_state.id),
            "state_name": route.to_state.state_name,
            "state_code": route.to_state.state_code
        } if route.to_state else None,
        "created_at": route.created_at.isoformat() if route.created_at else None,
        "updated_at": route.updated_at.isoformat() if route.updated_at else None
    }


@router.get("")
async def list_routes(
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all routes"""
    routes = db.query(Route).options(
        joinedload(Route.from_state),
        joinedload(Route.to_state)
    ).order_by(Route.route_name).all()
    
    return [route_to_dict(r) for r in routes]


@router.get("/{route_id}")
async def get_route(
    route_id: str,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a single route by ID"""
    route = db.query(Route).options(
        joinedload(Route.from_state),
        joinedload(Route.to_state)
    ).filter(Route.id == uuid.UUID(route_id)).first()
    
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    return route_to_dict(route)


@router.post("")
async def create_route(
    route_data: RouteCreate,
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create a new route (admin only)"""
    route = Route(
        id=uuid.uuid4(),
        route_name=route_data.route_name,
        from_state_id=uuid.UUID(route_data.from_state_id),
        to_state_id=uuid.UUID(route_data.to_state_id),
        from_address=route_data.from_address,
        to_address=route_data.to_address,
        distance_km=route_data.distance_km,
        estimated_duration_hours=route_data.estimated_duration_hours
    )
    
    db.add(route)
    db.commit()
    db.refresh(route)
    
    # Reload with relationships
    route = db.query(Route).options(
        joinedload(Route.from_state),
        joinedload(Route.to_state)
    ).filter(Route.id == route.id).first()
    
    return route_to_dict(route)


@router.put("/{route_id}")
async def update_route(
    route_id: str,
    route_data: RouteUpdate,
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update a route (admin only)"""
    route = db.query(Route).filter(Route.id == uuid.UUID(route_id)).first()
    
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    update_data = route_data.dict(exclude_unset=True)
    
    for key, value in update_data.items():
        if key in ["from_state_id", "to_state_id"] and value:
            setattr(route, key, uuid.UUID(value))
        else:
            setattr(route, key, value)
    
    db.commit()
    db.refresh(route)
    
    # Reload with relationships
    route = db.query(Route).options(
        joinedload(Route.from_state),
        joinedload(Route.to_state)
    ).filter(Route.id == route.id).first()
    
    return route_to_dict(route)


@router.delete("/{route_id}")
async def delete_route(
    route_id: str,
    current_user: TokenData = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete a route (admin only)"""
    route = db.query(Route).filter(Route.id == uuid.UUID(route_id)).first()
    
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    db.delete(route)
    db.commit()
    
    return {"message": "Route deleted successfully"}
