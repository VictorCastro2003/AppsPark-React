from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.estacionamiento import Estacionamiento
from schemas.estacionamiento_schema import EstacionamientoCreate, EstacionamientoOut
from pydantic import BaseModel

router = APIRouter(prefix="/estacionamientos", tags=["estacionamientos"])

# Schema para actualizar espacios disponibles
class EspaciosUpdate(BaseModel):
    espacios_disponibles: int

@router.post("/", response_model=EstacionamientoOut)
def create_estacionamiento(data: EstacionamientoCreate, db: Session = Depends(get_db)):
    estacionamiento = Estacionamiento(**data.dict())
    db.add(estacionamiento)
    db.commit()
    db.refresh(estacionamiento)
    return estacionamiento

@router.get("/", response_model=list[EstacionamientoOut])
def get_all_estacionamientos(db: Session = Depends(get_db)):
    """Obtener todos los estacionamientos activos"""
    return db.query(Estacionamiento).filter_by(activo=True).all()

@router.get("/duenio/{duenio_id}", response_model=list[EstacionamientoOut])
def get_estacionamientos_por_duenio(duenio_id: int, db: Session = Depends(get_db)):
    """Obtener estacionamientos por dueño"""
    return db.query(Estacionamiento).filter_by(duenio_id=duenio_id, activo=True).all()

@router.get("/{estacionamiento_id}", response_model=EstacionamientoOut)
def get_estacionamiento(estacionamiento_id: int, db: Session = Depends(get_db)):
    """Obtener un estacionamiento específico"""
    estacionamiento = db.query(Estacionamiento).filter_by(
        id=estacionamiento_id, 
        activo=True
    ).first()
    
    if not estacionamiento:
        raise HTTPException(status_code=404, detail="Estacionamiento no encontrado")
    
    return estacionamiento

@router.put("/{estacionamiento_id}/espacios", response_model=EstacionamientoOut)
def update_espacios_disponibles(
    estacionamiento_id: int, 
    espacios_data: EspaciosUpdate, 
    db: Session = Depends(get_db)
):
    """Actualizar espacios disponibles de un estacionamiento"""
    estacionamiento = db.query(Estacionamiento).filter_by(
        id=estacionamiento_id, 
        activo=True
    ).first()
    
    if not estacionamiento:
        raise HTTPException(status_code=404, detail="Estacionamiento no encontrado")
    
    # Validar que los espacios disponibles no sean negativos
    if espacios_data.espacios_disponibles < 0:
        raise HTTPException(
            status_code=400, 
            detail="Los espacios disponibles no pueden ser negativos"
        )
    
    # Actualizar espacios disponibles
    estacionamiento.espacios_disponibles = espacios_data.espacios_disponibles
    db.commit()
    db.refresh(estacionamiento)
    
    return estacionamiento

@router.put("/{estacionamiento_id}", response_model=EstacionamientoOut)
def update_estacionamiento(
    estacionamiento_id: int, 
    data: EstacionamientoCreate, 
    db: Session = Depends(get_db)
):
    """Actualizar un estacionamiento completo"""
    estacionamiento = db.query(Estacionamiento).filter_by(
        id=estacionamiento_id, 
        activo=True
    ).first()
    
    if not estacionamiento:
        raise HTTPException(status_code=404, detail="Estacionamiento no encontrado")
    
    # Actualizar campos
    for key, value in data.dict().items():
        setattr(estacionamiento, key, value)
    
    db.commit()
    db.refresh(estacionamiento)
    
    return estacionamiento

@router.delete("/{estacionamiento_id}")
def delete_estacionamiento(estacionamiento_id: int, db: Session = Depends(get_db)):
    """Desactivar un estacionamiento (soft delete)"""
    estacionamiento = db.query(Estacionamiento).filter_by(
        id=estacionamiento_id, 
        activo=True
    ).first()
    
    if not estacionamiento:
        raise HTTPException(status_code=404, detail="Estacionamiento no encontrado")
    
    estacionamiento.activo = False
    db.commit()
    
    return {"message": "Estacionamiento desactivado correctamente"}