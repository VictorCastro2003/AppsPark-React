from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.reserva import Reserva
from models.estacionamiento import Estacionamiento
from models.cajon import Cajon  # Importar el modelo Cajon
from schemas.reserva_schema import ReservaCreate, ReservaOut
from datetime import datetime, date, time, timedelta
from pydantic import BaseModel
from typing import Optional


router = APIRouter(prefix="/reservas", tags=["reservas"])

# Schema para crear reservas
class ReservaCreateRequest(BaseModel):
    estacionamiento_id: int
    usuario_id: int
    cajon_id: Optional[int] = None  # Hacer opcional
    fecha_reserva: str  # formato YYYY-MM-DD
    hora_inicio: str    # formato HH:MM
    hora_fin: str       # formato HH:MM
    placa_vehiculo: str

# ENDPOINT PRINCIPAL PARA CREAR RESERVAS
@router.post("/", response_model=dict)
def crear_reserva(reserva_data: ReservaCreateRequest, db: Session = Depends(get_db)):
    """
    Crear una nueva reserva - Este es el endpoint que tu Flutter está llamando
    """
    # Verificar que el estacionamiento existe
    estacionamiento = db.query(Estacionamiento).filter(
        Estacionamiento.id == reserva_data.estacionamiento_id
    ).first()
    
    if not estacionamiento:
        raise HTTPException(status_code=404, detail="Estacionamiento no encontrado")
    
    # SOLUCIÓN 1: Validar que el cajón existe si se proporciona
    cajon_id_final = None
    if reserva_data.cajon_id:
        cajon = db.query(Cajon).filter(
            Cajon.id == reserva_data.cajon_id,
            Cajon.estacionamiento_id == reserva_data.estacionamiento_id
        ).first()
        
        if not cajon:
            raise HTTPException(
                status_code=404, 
                detail=f"Cajón con ID {reserva_data.cajon_id} no encontrado en este estacionamiento"
            )
        
        # Verificar que el cajón esté disponible
        if not cajon.disponible:
            raise HTTPException(
                status_code=400,
                detail=f"El cajón {reserva_data.cajon_id} no está disponible"
            )
        
        cajon_id_final = reserva_data.cajon_id
    else:
        # SOLUCIÓN 2: Auto-asignar un cajón disponible
        cajon_disponible = db.query(Cajon).filter(
            Cajon.estacionamiento_id == reserva_data.estacionamiento_id,
            Cajon.disponible == True
        ).first()
        
        if cajon_disponible:
            cajon_id_final = cajon_disponible.id
        # Si no hay cajones disponibles, dejar cajon_id como None
    
    # Verificar espacios disponibles para la fecha
    reservas_aceptadas = db.query(Reserva).filter(
        Reserva.estacionamiento_id == reserva_data.estacionamiento_id,
        Reserva.fecha_reserva == reserva_data.fecha_reserva,
        Reserva.estado == "aceptada"
    ).count()
    
    espacios_disponibles = estacionamiento.espacios_total - reservas_aceptadas
    
    if espacios_disponibles <= 0:
        raise HTTPException(
            status_code=400,
            detail=f"No hay espacios disponibles para la fecha {reserva_data.fecha_reserva}"
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
    
    # Crear la reserva
    nueva_reserva = Reserva(
        estacionamiento_id=reserva_data.estacionamiento_id,
        usuario_id=reserva_data.usuario_id,
        cajon_id=cajon_id_final,  # Puede ser None si no hay cajones disponibles
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
        
        # Si se asignó un cajón, marcarlo como ocupado temporalmente
        if cajon_id_final:
            cajon = db.query(Cajon).filter(Cajon.id == cajon_id_final).first()
            if cajon:
                cajon.disponible = False
                db.commit()
        
        return {
            "message": "Reserva creada exitosamente",
            "reserva_id": nueva_reserva.id,
            "estado": "pendiente",
            "cajon_asignado": cajon_id_final,
            "espacios_restantes": espacios_disponibles - 1
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error al crear la reserva: {str(e)}"
        )

# ENDPOINT PARA OBTENER CAJONES DISPONIBLES
@router.get("/cajones-disponibles/{estacionamiento_id}")
def obtener_cajones_disponibles(estacionamiento_id: int, db: Session = Depends(get_db)):
    """
    Obtener cajones disponibles para un estacionamiento
    """
    cajones = db.query(Cajon).filter(
        Cajon.estacionamiento_id == estacionamiento_id,
        Cajon.disponible == True
    ).all()
    
    return {
        "estacionamiento_id": estacionamiento_id,
        "cajones_disponibles": [
            {
                "id": cajon.id,
                "numero": cajon.numero,
                "tipo": cajon.tipo if hasattr(cajon, 'tipo') else "regular"
            }
            for cajon in cajones
        ]
    }

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
    Aceptar una reserva pendiente
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

    # Verificar si ya hay reservas aceptadas para la misma fecha
    reservas_aceptadas_fecha = db.query(Reserva).filter(
        Reserva.estacionamiento_id == reserva.estacionamiento_id,
        Reserva.fecha_reserva == reserva.fecha_reserva,
        Reserva.estado == "aceptada"
    ).count()

    # Calcular espacios realmente disponibles para esa fecha
    espacios_disponibles_fecha = estacionamiento.espacios_total - reservas_aceptadas_fecha

    if espacios_disponibles_fecha <= 0:
        raise HTTPException(
            status_code=400,
            detail=f"No hay espacios disponibles para la fecha {reserva.fecha_reserva}"
        )

    # Si no tiene cajón asignado, asignar uno disponible
    if not reserva.cajon_id:
        cajon_disponible = db.query(Cajon).filter(
            Cajon.estacionamiento_id == reserva.estacionamiento_id,
            Cajon.disponible == True
        ).first()
        
        if cajon_disponible:
            reserva.cajon_id = cajon_disponible.id
            cajon_disponible.disponible = False

    # Si todo está bien, aceptar la reserva
    reserva.estado = "aceptada"
    
    # Actualizar espacios disponibles generales
    estacionamiento.espacios_disponibles -= 1

    db.commit()
    return {
        "message": "Reserva aceptada exitosamente",
        "cajon_asignado": reserva.cajon_id,
        "espacios_restantes": espacios_disponibles_fecha - 1
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

    # Si tenía un cajón asignado, liberarlo
    if reserva.cajon_id:
        cajon = db.query(Cajon).filter(Cajon.id == reserva.cajon_id).first()
        if cajon:
            cajon.disponible = True

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
        
        # Liberar el cajón si estaba asignado
        if reserva.cajon_id:
            cajon = db.query(Cajon).filter(Cajon.id == reserva.cajon_id).first()
            if cajon:
                cajon.disponible = True
    
    reserva.estado = "cancelada"
    
    db.commit()
    return {"message": "Reserva cancelada exitosamente"}

# Endpoint para consultar espacios disponibles por fecha
@router.get("/espacios-disponibles/{estacionamiento_id}")
def consultar_espacios_disponibles(
    estacionamiento_id: int, 
    fecha: str,  # formato: YYYY-MM-DD
    db: Session = Depends(get_db)
):
    """
    Consultar espacios disponibles para una fecha específica
    """
    estacionamiento = db.query(Estacionamiento).filter(
        Estacionamiento.id == estacionamiento_id
    ).first()
    
    if not estacionamiento:
        raise HTTPException(status_code=404, detail="Estacionamiento no encontrado")
    
    # Contar reservas aceptadas para esa fecha
    reservas_aceptadas = db.query(Reserva).filter(
        Reserva.estacionamiento_id == estacionamiento_id,
        Reserva.fecha_reserva == fecha,
        Reserva.estado == "aceptada"
    ).count()
    
    espacios_disponibles = estacionamiento.espacios_total - reservas_aceptadas
    
    return {
        "estacionamiento_id": estacionamiento_id,
        "fecha": fecha,
        "espacios_totales": estacionamiento.espacios_total,
        "reservas_aceptadas": reservas_aceptadas,
        "espacios_disponibles": max(0, espacios_disponibles)
    }

@router.get("/espacios-disponibles-con-reservas/{estacionamiento_id}")
def obtener_espacios_disponibles_con_reservas(
    estacionamiento_id: int,
    fecha: str = None,  
    db: Session = Depends(get_db)
):
    """
    Obtiene los espacios disponibles considerando las reservas aceptadas
    """
    # Obtener el estacionamiento
    estacionamiento = db.query(Estacionamiento).filter(
        Estacionamiento.id == estacionamiento_id
    ).first()
    
    if not estacionamiento:
        raise HTTPException(status_code=404, detail="Estacionamiento no encontrado")
    
    # Si no se proporciona fecha, usar la fecha actual
    if not fecha:
        fecha = datetime.now().date().isoformat()
    
    # Contar reservas aceptadas para esa fecha
    reservas_aceptadas = db.query(Reserva).filter(
        Reserva.estacionamiento_id == estacionamiento_id,
        Reserva.fecha_reserva == fecha,
        Reserva.estado == "aceptada"
    ).count()
    
    # Calcular espacios disponibles
    espacios_disponibles = max(0, estacionamiento.espacios_total - reservas_aceptadas)
    
    return {
        "estacionamiento_id": estacionamiento_id,
        "fecha": fecha,
        "espacios_totales": estacionamiento.espacios_total,
        "reservas_aceptadas": reservas_aceptadas,
        "espacios_disponibles": espacios_disponibles
    }

@router.get("/duenio/{duenio_id}/con-espacios-disponibles")
def obtener_estacionamientos_con_espacios_disponibles(
    duenio_id: int,
    fecha: str = None,
    db: Session = Depends(get_db)
):
    """
    Obtiene todos los estacionamientos de un dueño con sus espacios disponibles
    """
    # Si no se proporciona fecha, usar la fecha actual
    if not fecha:
        fecha = datetime.now().date().isoformat()
    
    # Obtener estacionamientos del dueño
    estacionamientos = db.query(Estacionamiento).filter(
        Estacionamiento.duenio_id == duenio_id
    ).all()
    
    resultado = []
    
    for estacionamiento in estacionamientos:
        # Contar reservas aceptadas para cada estacionamiento
        reservas_aceptadas = db.query(Reserva).filter(
            Reserva.estacionamiento_id == estacionamiento.id,
            Reserva.fecha_reserva == fecha,
            Reserva.estado == "aceptada"
        ).count()
        
        espacios_disponibles = max(0, estacionamiento.espacios_total - reservas_aceptadas)
        
        resultado.append({
            "id": estacionamiento.id,
            "nombre": estacionamiento.nombre,
            "direccion": estacionamiento.direccion,
            "precio": estacionamiento.precio,
            "horario": estacionamiento.horario,
            "espacios_totales": estacionamiento.espacios_total,
            "espacios_disponibles_base": estacionamiento.espacios_disponibles,
            "reservas_aceptadas": reservas_aceptadas,
            "espacios_disponibles_con_reservas": espacios_disponibles,
            "fecha_consulta": fecha
        })
    
    return resultado

# ENDPOINT PARA OBTENER RESERVAS ACTIVAS DE UN ESTACIONAMIENTO
@router.get("/activas/{estacionamiento_id}")
def obtener_reservas_activas(estacionamiento_id: int, db: Session = Depends(get_db)):
    """
    Obtener el número de reservas activas (aceptadas) para un estacionamiento específico.
    Incluye reservas de hoy hacia adelante.
    """
    # Verificar que el estacionamiento existe
    estacionamiento = db.query(Estacionamiento).filter(
        Estacionamiento.id == estacionamiento_id
    ).first()
    
    if not estacionamiento:
        raise HTTPException(status_code=404, detail="Estacionamiento no encontrado")
    
    # Obtener la fecha actual
    fecha_actual = datetime.now().date()
    
    # CAMBIO: Buscar reservas activas desde HOY hacia adelante
    # Esto es más lógico porque las reservas pasadas ya no deberían contar
    reservas_activas = db.query(Reserva).filter(
        Reserva.estacionamiento_id == estacionamiento_id,
        Reserva.fecha_reserva >= fecha_actual,  # Desde hoy hacia adelante
        Reserva.estado == "aceptada"
    ).all()
    
    # Para debug, mantener las consultas originales
    todas_las_reservas = db.query(Reserva).filter(
        Reserva.estacionamiento_id == estacionamiento_id
    ).all()
    
    reservas_hoy = db.query(Reserva).filter(
        Reserva.estacionamiento_id == estacionamiento_id,
        Reserva.fecha_reserva == fecha_actual,
        Reserva.estado == "aceptada"
    ).all()
    
    todas_reservas_activas = db.query(Reserva).filter(
        Reserva.estacionamiento_id == estacionamiento_id,
        Reserva.estado == "aceptada"
    ).all()
    
    # Usar las reservas desde hoy hacia adelante
    reservas_activas_count = len(reservas_activas)
    
    return {
        "estacionamiento_id": estacionamiento_id,
        "fecha": fecha_actual.isoformat(),
        "reservas_activas": reservas_activas_count,
        # Información adicional para debug
        "debug_info": {
            "total_reservas": len(todas_las_reservas),
            "reservas_hoy": len(reservas_hoy),
            "todas_activas": len(todas_reservas_activas),
            "reservas_futuras_y_actuales": len(reservas_activas),
            "fechas_reservas_activas": [r.fecha_reserva.isoformat() for r in reservas_activas],
            "fechas_todas_activas": [r.fecha_reserva.isoformat() for r in todas_reservas_activas]
        }
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