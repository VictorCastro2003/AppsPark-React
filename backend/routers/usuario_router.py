# app/routers/usuario_router.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models.user import Usuario, RolEnum
from schemas.user_schema import UsuarioCreate, UsuarioOut
from database import get_db
import bcrypt

router = APIRouter(prefix="/usuarios", tags=["usuarios"])

@router.post("/", response_model=UsuarioOut)
def create_usuario(data: UsuarioCreate, db: Session = Depends(get_db)):
    existing_user = db.query(Usuario).filter(Usuario.email == data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="El correo ya está registrado.")
    
    hashed_pw = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
    new_user = Usuario(
        nombre=data.nombre,
        email=data.email,
        password=hashed_pw,
        rol=data.rol  # ← este campo debe llamarse "rol" como en el modelo
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user
