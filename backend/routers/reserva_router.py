from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.reserva import Reserva
from models.estacionamiento import Estacionamiento
from schemas.reserva_schema import ReservaCreate, ReservaOut
from datetime import datetime, date, time, timedelta
from pydantic import BaseModel
from typing import Optional


router = APIRouter(prefix="/reservas", tags=["reservas"])

# Schema para crear reservas - SIN CAJON_ID
class ReservaCreateRequest(BaseModel):
    estacionamiento_id: int
    usuario_id: int
    fecha_reserva: str  # formato YYYY-MM-DD
    hora_inicio: str    # formato HH:MM
    hora_fin: str       # formato HH:MM
    placa_vehiculo: str

# ENDPOINT PRINCIPAL PARA CREAR RESERVAS - SIMPLIFICADO SIN CAJONES
@router.post("/", response_model=dict)
def crear_reserva(reserva_data: ReservaCreateRequest, db: Session = Depends(get_db)):
    """
    Crear una nueva reserva - Simplificado sin manejo de cajones
    """
    # Verificar que el estacionamiento existe
    estacionamiento = db.query(Estacionamiento).filter(
        Estacionamiento.id == reserva_data.estacionamiento_id
    ).first()
    
    if not estacionamiento:
        raise HTTPException(status_code=404, detail="Estacionamiento no encontrado")
    
    # Verificar que hay espacios disponibles
    if estacionamiento.espacios_disponibles <= 0:
        raise HTTPException(
            status_code=400,
            detail="No hay espacios disponibles en este estacionamiento"
        )
    
    # Validar que la hora de fin sea posterior a la de inicio
    try:
        hora_inicio = datetime.strptime(reserva_data.hora_inicio, "%H:%M").time()
        hora_fin = datetime.strptime(reserva_data.hora_fin, "%H:%M").time()
        
        if hora_fin <= hora_inicio:
            raise HTTPException(
                status_code=400,
                detail="La hora de fin debe ser posterior a la hora de inicio"
            )
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Formato de hora inválido. Use HH:MM"
        )
    
    # Convertir fecha string a datetime
    try:
        fecha_reserva = datetime.strptime(reserva_data.fecha_reserva, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Formato de fecha inválido. Use YYYY-MM-DD"
        )
    
    # Crear la reserva SIN CAJON_ID
    nueva_reserva = Reserva(
        estacionamiento_id=reserva_data.estacionamiento_id,
        usuario_id=reserva_data.usuario_id,
        cajon_id=None,  # Sin asignación de cajón
        fecha_reserva=fecha_reserva,
        hora_inicio=hora_inicio,
        hora_fin=hora_fin,
        placa_vehiculo=reserva_data.placa_vehiculo.upper(),
        estado="pendiente"  # Estado inicial
    )
    
    try:
        db.add(nueva_reserva)
        db.commit()
        db.refresh(nueva_reserva)
        
        return {
            "message": "Reserva creada exitosamente",
            "reserva_id": nueva_reserva.id,
            "estado": "pendiente",
            "espacios_restantes": estacionamiento.espacios_disponibles - 1
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error al crear la reserva: {str(e)}"
        )

# ENDPOINT PARA OBTENER RESERVAS DEL USUARIO
@router.get("/usuario/{usuario_id}", response_model=list[ReservaOut])
def obtener_reservas_usuario(usuario_id: int, db: Session = Depends(get_db)):
    """
    Obtener todas las reservas de un usuario específico
    """
    reservas = db.query(Reserva).filter(
        Reserva.usuario_id == usuario_id
    ).order_by(Reserva.fecha_reserva.desc()).all()
    
    return reservas

# ENDPOINT PARA OBTENER UNA RESERVA ESPECÍFICA
@router.get("/{reserva_id}", response_model=ReservaOut)
def obtener_reserva(reserva_id: int, db: Session = Depends(get_db)):
    """
    Obtener detalles de una reserva específica
    """
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    
    return reserva

@router.get("/pendientes/{duenio_id}", response_model=list[ReservaOut])
def obtener_reservas_pendientes(duenio_id: int, db: Session = Depends(get_db)):
    """
    Obtener reservas pendientes para un dueño de estacionamientos
    """
    return db.query(Reserva).join(Estacionamiento).filter(
        Estacionamiento.duenio_id == duenio_id,
        Reserva.estado == "pendiente"
    ).all()

@router.put("/{reserva_id}/aceptar")
def aceptar_reserva(reserva_id: int, db: Session = Depends(get_db)):
    """
    Aceptar una reserva pendiente - SIN MANEJO DE CAJONES
    """
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    if reserva.estado != "pendiente":
        raise HTTPException(status_code=400, detail="La reserva ya fue procesada")

    # Obtener el estacionamiento
    estacionamiento = db.query(Estacionamiento).filter(
        Estacionamiento.id == reserva.estacionamiento_id
    ).first()
    
    if not estacionamiento:
        raise HTTPException(status_code=404, detail="Estacionamiento no encontrado")

    # Verificar si hay espacios disponibles
    if estacionamiento.espacios_disponibles <= 0:
        raise HTTPException(
            status_code=400, 
            detail="No hay espacios disponibles en este estacionamiento"
        )

    # Aceptar la reserva
    reserva.estado = "aceptada"
    
    # Reducir espacios disponibles
    estacionamiento.espacios_disponibles -= 1

    db.commit()
    return {
        "message": "Reserva aceptada exitosamente",
        "espacios_restantes": estacionamiento.espacios_disponibles
    }

@router.put("/{reserva_id}/rechazar")
def rechazar_reserva(reserva_id: int, db: Session = Depends(get_db)):
    """
    Rechazar una reserva pendiente
    """
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    if reserva.estado != "pendiente":
        raise HTTPException(status_code=400, detail="La reserva ya fue procesada")

    reserva.estado = "rechazada"
    db.commit()
    return {"message": "Reserva rechazada"}

# ENDPOINT PARA CANCELAR RESERVA (por parte del usuario)
@router.put("/{reserva_id}/cancelar")
def cancelar_reserva(reserva_id: int, usuario_id: int, db: Session = Depends(get_db)):
    """
    Permite al usuario cancelar su propia reserva
    """
    reserva = db.query(Reserva).filter(
        Reserva.id == reserva_id,
        Reserva.usuario_id == usuario_id
    ).first()
    
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    
    if reserva.estado in ["completada", "cancelada"]:
        raise HTTPException(status_code=400, detail="Esta reserva no se puede cancelar")
    
    # Si la reserva estaba aceptada, liberar el espacio
    if reserva.estado == "aceptada":
        estacionamiento = db.query(Estacionamiento).filter(
            Estacionamiento.id == reserva.estacionamiento_id
        ).first()
        if estacionamiento:
            estacionamiento.espacios_disponibles += 1
    
    reserva.estado = "cancelada"
    
    db.commit()
    return {"message": "Reserva cancelada exitosamente"}

# ENDPOINT PARA OBTENER RESERVAS ACTIVAS DE UN ESTACIONAMIENTO
@router.get("/activas/{estacionamiento_id}")
def obtener_reservas_activas(estacionamiento_id: int, db: Session = Depends(get_db)):
    """
    Obtener el número de reservas activas (aceptadas) para un estacionamiento específico.
    Solo cuenta reservas para HOY y que estén dentro del horario actual.
    """
    # Verificar que el estacionamiento existe
    estacionamiento = db.query(Estacionamiento).filter(
        Estacionamiento.id == estacionamiento_id
    ).first()
    
    if not estacionamiento:
        raise HTTPException(status_code=404, detail="Estacionamiento no encontrado")
    
    # Obtener la fecha y hora actual
    ahora = datetime.now()
    fecha_actual = ahora.date()
    hora_actual = ahora.time()
    
    # Solo reservas para HOY y dentro del horario
    reservas_activas = db.query(Reserva).filter(
        Reserva.estacionamiento_id == estacionamiento_id,
        Reserva.fecha_reserva == fecha_actual,
        Reserva.estado == "aceptada",
        Reserva.hora_inicio <= hora_actual,
        Reserva.hora_fin >= hora_actual
    ).count()
    
    return {
        "estacionamiento_id": estacionamiento_id,
        "fecha": fecha_actual.isoformat(),
        "hora_actual": hora_actual.strftime("%H:%M:%S"),
        "reservas_activas": reservas_activas
    }

@router.post("/limpiar-reservas-pasadas")
def limpiar_reservas_pasadas(db: Session = Depends(get_db)):
    """
    Limpiar reservas pasadas que ya deberían estar completadas
    """
    ahora = datetime.now()
    fecha_actual = ahora.date()
    hora_actual = ahora.time()
    
    # Marcar como completadas las reservas que ya terminaron
    reservas_completadas = db.query(Reserva).filter(
        Reserva.fecha_reserva < fecha_actual,
        Reserva.estado == "aceptada"
    ).update({"estado": "completada"})
    
    # También las de hoy que ya terminaron
    reservas_hoy_completadas = db.query(Reserva).filter(
        Reserva.fecha_reserva == fecha_actual,
        Reserva.hora_fin < hora_actual,
        Reserva.estado == "aceptada"
    ).update({"estado": "completada"})
    
    db.commit()
    
    return {
        "message": "Reservas limpiadas",
        "reservas_pasadas_completadas": reservas_completadas,
        "reservas_hoy_completadas": reservas_hoy_completadas
    }

# ENDPOINT PARA ESTADÍSTICAS DEL DUEÑO
@router.get("/estadisticas/{duenio_id}")
def obtener_estadisticas_duenio(duenio_id: int, db: Session = Depends(get_db)):
    """
    Obtener estadísticas de reservas para el dueño
    """
    # Contar reservas por estado
    total_pendientes = db.query(Reserva).join(Estacionamiento).filter(
        Estacionamiento.duenio_id == duenio_id,
        Reserva.estado == "pendiente"
    ).count()
    
    total_aceptadas = db.query(Reserva).join(Estacionamiento).filter(
        Estacionamiento.duenio_id == duenio_id,
        Reserva.estado == "aceptada"
    ).count()
    
    total_rechazadas = db.query(Reserva).join(Estacionamiento).filter(
        Estacionamiento.duenio_id == duenio_id,
        Reserva.estado == "rechazada"
    ).count()
    
    # Reservas del mes actual
    fecha_actual = datetime.now()
    primer_dia_mes = fecha_actual.replace(day=1).date()
    
    reservas_mes = db.query(Reserva).join(Estacionamiento).filter(
        Estacionamiento.duenio_id == duenio_id,
        Reserva.fecha_reserva >= primer_dia_mes,
        Reserva.estado == "aceptada"
    ).all()
    
    return {
        "reservas_pendientes": total_pendientes,
        "reservas_aceptadas": total_aceptadas,
        "reservas_rechazadas": total_rechazadas,
        "total_reservas": total_pendientes + total_aceptadas + total_rechazadas,
        "reservas_mes_actual": len(reservas_mes)
    }