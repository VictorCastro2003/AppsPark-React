# usuario_router.py - VERSIÓN CORREGIDA

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from models.user import Usuario, RolEnum
from schemas.user_schema import UsuarioCreate, UsuarioOut, UsuarioUpdate  # ✅ Ahora UsuarioUpdate existe
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
    
    print(f"🔍 DEBUG: Intentando actualizar usuario ID: {user_id}")
    print(f"🔍 DEBUG: Usuario actual ID: {current_user.id}")
    print(f"🔍 DEBUG: Datos recibidos: {data.dict()}")
    
    # Verificar que el usuario solo puede actualizar su propio perfil (o sea admin)
    if current_user.id != user_id and current_user.rol != "admin":
        print(f"❌ DEBUG: Sin permisos - Usuario {current_user.id} intentando actualizar {user_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para actualizar este usuario"
        )
    
    # Obtener el usuario a actualizar
    user_to_update = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not user_to_update:
        print(f"❌ DEBUG: Usuario {user_id} no encontrado en la base de datos")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Usuario con ID {user_id} no encontrado"
        )
    
    print(f"✅ DEBUG: Usuario encontrado - ID: {user_to_update.id}, Nombre: {user_to_update.nombre}")
    
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
        print(f"🔐 DEBUG: Intentando cambiar contraseña")
        if not bcrypt.checkpw(data.currentPassword.encode(), user_to_update.password.encode()):
            print(f"❌ DEBUG: Contraseña actual incorrecta")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La contraseña actual es incorrecta"
            )
        # Hashear la nueva contraseña
        hashed_new_pw = bcrypt.hashpw(data.newPassword.encode(), bcrypt.gensalt()).decode()
        user_to_update.password = hashed_new_pw
        print(f"✅ DEBUG: Contraseña actualizada")
    
    # Actualizar campos básicos
    if data.nombre is not None:
        user_to_update.nombre = data.nombre
        print(f"✅ DEBUG: Nombre actualizado a: {data.nombre}")
    if data.email is not None:
        user_to_update.email = data.email
        print(f"✅ DEBUG: Email actualizado a: {data.email}")
    
    # Solo admin puede cambiar roles
    if data.rol is not None and current_user.rol == "admin":
        user_to_update.rol = data.rol
        print(f"✅ DEBUG: Rol actualizado a: {data.rol}")
    
    try:
        db.commit()
        db.refresh(user_to_update)
        print(f"✅ DEBUG: Usuario actualizado exitosamente")
        return user_to_update
    except Exception as e:
        print(f"❌ DEBUG: Error al guardar en BD: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar usuario: {str(e)}"
        )

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