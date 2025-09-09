from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.estacionamiento import Estacionamiento
from schemas.estacionamiento_schema import EstacionamientoCreate, EstacionamientoOut
from pydantic import BaseModel
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/estacionamientos", tags=["estacionamientos"])

# Schema para actualizar espacios disponibles
class EspaciosUpdate(BaseModel):
    espacios_disponibles: int

@router.put("/{estacionamiento_id}/espacios", response_model=EstacionamientoOut)
def update_espacios_disponibles(
    estacionamiento_id: int, 
    espacios_data: EspaciosUpdate, 
    db: Session = Depends(get_db)
):
    """Actualizar espacios disponibles de un estacionamiento"""
    logger.info(f"🔄 Actualizando espacios para estacionamiento {estacionamiento_id}")
    logger.info(f"📊 Nuevos espacios disponibles: {espacios_data.espacios_disponibles}")
    
    # Buscar el estacionamiento
    estacionamiento = db.query(Estacionamiento).filter_by(
        id=estacionamiento_id, 
        activo=True
    ).first()
    
    if not estacionamiento:
        logger.error(f"❌ Estacionamiento {estacionamiento_id} no encontrado")
        raise HTTPException(status_code=404, detail="Estacionamiento no encontrado")
    
    logger.info(f"✅ Estacionamiento encontrado: {estacionamiento.nombre}")
    logger.info(f"📋 Espacios actuales: {estacionamiento.espacios_disponibles}")
    
    # Validar que los espacios disponibles no sean negativos
    if espacios_data.espacios_disponibles < 0:
        logger.error(f"❌ Espacios negativos no permitidos: {espacios_data.espacios_disponibles}")
        raise HTTPException(
            status_code=400, 
            detail="Los espacios disponibles no pueden ser negativos"
        )
    
    # Validar que no excedan el total de espacios
    if espacios_data.espacios_disponibles > estacionamiento.espacios_total:
        logger.warning(f"⚠️ Espacios disponibles ({espacios_data.espacios_disponibles}) exceden el total ({estacionamiento.espacios_total})")
        # Opcional: ajustar automáticamente o lanzar error
        # espacios_data.espacios_disponibles = estacionamiento.espacios_total
    
    try:
        # Actualizar espacios disponibles
        espacios_anteriores = estacionamiento.espacios_disponibles
        estacionamiento.espacios_disponibles = espacios_data.espacios_disponibles
        
        # Commit a la base de datos
        db.commit()
        db.refresh(estacionamiento)
        
        logger.info(f"✅ Actualización exitosa!")
        logger.info(f"📊 Espacios anteriores: {espacios_anteriores}")
        logger.info(f"📊 Espacios nuevos: {estacionamiento.espacios_disponibles}")
        logger.info(f"🏢 Estacionamiento: {estacionamiento.nombre}")
        
        return estacionamiento
        
    except Exception as e:
        logger.error(f"❌ Error al actualizar en BD: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=500, 
            detail=f"Error interno al actualizar espacios: {str(e)}"
        )

# Los demás endpoints se mantienen igual...
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