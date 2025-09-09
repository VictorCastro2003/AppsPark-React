from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from models.user import Usuario, RolEnum
from schemas.user_schema import UsuarioCreate, UsuarioOut, UsuarioUpdate
from database import get_db
import bcrypt
import jwt
import os

router = APIRouter(prefix="/usuarios", tags=["usuarios"])
security = HTTPBearer()

SECRET_KEY = os.getenv("SECRET_KEY", "mysecret")

# Función para verificar el token JWT
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido"
            )
        
        user = db.query(Usuario).filter(Usuario.id == int(user_id)).first()
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuario no encontrado"
            )
        return user
        
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido"
        )

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
        rol=data.rol
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.get("/me", response_model=UsuarioOut)
def get_current_user_profile(current_user: Usuario = Depends(get_current_user)):
    """Obtener perfil del usuario autenticado"""
    return current_user

@router.put("/{user_id}", response_model=UsuarioOut)
def update_usuario(
    user_id: int, 
    data: UsuarioUpdate, 
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Actualizar perfil de usuario"""
    
    # Verificar que el usuario solo puede actualizar su propio perfil (o sea admin)
    if current_user.id != user_id and current_user.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para actualizar este usuario"
        )
    
    # Obtener el usuario a actualizar
    user_to_update = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not user_to_update:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    # Verificar email único si se está cambiando
    if data.email and data.email != user_to_update.email:
        existing_email = db.query(Usuario).filter(Usuario.email == data.email).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El correo ya está registrado por otro usuario"
            )
    
    # Si se está cambiando la contraseña, verificar la actual
    if data.newPassword and data.currentPassword:
        if not bcrypt.checkpw(data.currentPassword.encode(), user_to_update.password.encode()):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La contraseña actual es incorrecta"
            )
        # Hashear la nueva contraseña
        hashed_new_pw = bcrypt.hashpw(data.newPassword.encode(), bcrypt.gensalt()).decode()
        user_to_update.password = hashed_new_pw
    
    # Actualizar campos básicos
    if data.nombre is not None:
        user_to_update.nombre = data.nombre
    if data.email is not None:
        user_to_update.email = data.email
    
    # Solo admin puede cambiar roles
    if data.rol is not None and current_user.rol == "admin":
        user_to_update.rol = data.rol
    
    db.commit()
    db.refresh(user_to_update)
    
    return user_to_update

@router.delete("/{user_id}")
def delete_usuario(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Eliminar usuario (solo admin o el propio usuario)"""
    
    if current_user.id != user_id and current_user.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para eliminar este usuario"
        )
    
    user_to_delete = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not user_to_delete:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    db.delete(user_to_delete)
    db.commit()
    
    return {"message": "Usuario eliminado exitosamente"}


# 2. ACTUALIZAR user_schema.py
# schemas/user_schema.py
from pydantic import BaseModel, EmailStr
from typing import Optional
from models.user import RolEnum

class UsuarioBase(BaseModel):
    nombre: str
    email: EmailStr
    rol: RolEnum

class UsuarioCreate(UsuarioBase):
    password: str

class UsuarioUpdate(BaseModel):
    """Schema para actualizar usuario"""
    nombre: Optional[str] = None
    email: Optional[EmailStr] = None
    rol: Optional[RolEnum] = None
    currentPassword: Optional[str] = None
    newPassword: Optional[str] = None

    class Config:
        # Permitir campos adicionales que no estén en el schema
        extra = "ignore"

class UsuarioOut(UsuarioBase):
    id: int
    
    class Config:
        from_attributes = True  # Para SQLAlchemy v2
        # orm_mode = True  # Para SQLAlchemy v1