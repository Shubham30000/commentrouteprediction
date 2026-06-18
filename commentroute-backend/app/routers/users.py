from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.schemas import UserCreate, UserOut
from app.crud import crud

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/", response_model=UserOut)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    return crud.create_user(db, payload)


@router.get("/", response_model=list[UserOut])
def list_users(
    skip:  int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return crud.get_users(db, skip=skip, limit=limit)


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
