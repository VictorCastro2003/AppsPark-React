from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from models.cajon import Cajon
from schemas.cajon_schema import CajonCreate, CajonOut
from database import get_db

router = APIRouter(prefix="/cajones", tags=["Cajones"])

@router.post("/", response_model=CajonOut)
def crear_cajon(data: CajonCreate, db: Session = Depends(get_db)):
    cajon = Cajon(**data.dict())
    db.add(cajon)
    db.commit()
    db.refresh(cajon)
    return cajon
