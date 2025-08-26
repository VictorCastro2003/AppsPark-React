from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from models.user import Usuario
from database import get_db
import bcrypt
import jwt
import os

router = APIRouter(prefix="/auth", tags=["auth"])

SECRET_KEY = os.getenv("SECRET_KEY", "mysecret")  # Usa variables de entorno en producción

@router.post("/login")
def login(request: dict, db: Session = Depends(get_db)):
    email = request.get("email")
    password = request.get("password")

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email y contraseña requeridos")

    user = db.query(Usuario).filter(Usuario.email == email).first()
    if not user or not bcrypt.checkpw(password.encode(), user.password.encode()):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    token_data = {"sub": str(user.id)}
    token = jwt.encode(token_data, SECRET_KEY, algorithm="HS256")

    return {
        "token": token,
        "usuario": {
            "id": user.id,
            "nombre": user.nombre,
            "email": user.email,
            "rol": user.rol
        }
    }
