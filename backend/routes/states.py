"""
Indian states routes
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import IndianState
from auth import get_current_user, TokenData

router = APIRouter()


@router.get("")
async def list_states(
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all Indian states"""
    states = db.query(IndianState).order_by(IndianState.state_name).all()
    
    return [{
        "id": str(s.id),
        "state_name": s.state_name,
        "state_code": s.state_code,
        "is_union_territory": s.is_union_territory
    } for s in states]
