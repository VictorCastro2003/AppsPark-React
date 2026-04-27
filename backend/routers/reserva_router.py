from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from database import get_db
from models.reserva import Reserva
from models.cajon import Cajon
from models.estacionamiento import Estacionamiento
from models.notificacion import Notificacion
from schemas.reserva_schema import ReservaCreate, ReservaOut, ReservaOutWithUsuario, ReservaOutWithEstacionamiento
from datetime import datetime, date, time, timedelta
from pydantic import BaseModel
from typing import Optional
import secrets
import math


router = APIRouter(prefix="/reservas", tags=["reservas"])

# Schema para crear reservas - CAJON_ID opcional
class ReservaCreateRequest(BaseModel):
    estacionamiento_id: int
    usuario_id: int
    cajon_id: Optional[int] = None
    fecha_reserva: str  # formato YYYY-MM-DD
    hora_inicio: str    # formato HH:MM
    hora_fin: str       # formato HH:MM
    placa_vehiculo: str

class SalidaRequest(BaseModel):
    token: str

# ENDPOINT PRINCIPAL PARA CREAR RESERVAS - CAJON opcional
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
    
    # Validar cajón (si se envía) y evitar doble reserva en mismo horario
    cajon_id_to_use = None
    if reserva_data.cajon_id is not None:
        if reserva_data.cajon_id <= 0:
            raise HTTPException(status_code=400, detail="Cajón inválido")

        # 1) Intentar por ID directo
        cajon = db.query(Cajon).filter(Cajon.id == reserva_data.cajon_id).first()
        if cajon:
            if cajon.estacionamiento_id != reserva_data.estacionamiento_id:
                raise HTTPException(
                    status_code=400,
                    detail="El cajón no pertenece a este estacionamiento"
                )
            cajon_id_to_use = cajon.id
        else:
            # 2) Intentar por número de cajón (mapeo desde zonas)
            cajon = db.query(Cajon).filter(
                Cajon.estacionamiento_id == reserva_data.estacionamiento_id,
                Cajon.numero_cajon == str(reserva_data.cajon_id)
            ).first()

            # 3) Si no existe, crear automáticamente el cajón
            if not cajon:
                cajon = Cajon(
                    numero_cajon=str(reserva_data.cajon_id),
                    estacionamiento_id=reserva_data.estacionamiento_id,
                    status="libre"
                )
                db.add(cajon)
                db.flush()  # obtener ID sin commit

            cajon_id_to_use = cajon.id

        fecha_inicio = datetime.combine(fecha_reserva.date(), time.min)
        fecha_fin = datetime.combine(fecha_reserva.date(), time.max)

        conflicto = db.query(Reserva).filter(
            Reserva.estacionamiento_id == reserva_data.estacionamiento_id,
            Reserva.cajon_id == cajon_id_to_use,
            Reserva.estado.in_(["pendiente", "aceptada"]),
            Reserva.fecha_reserva >= fecha_inicio,
            Reserva.fecha_reserva <= fecha_fin,
            or_(
                Reserva.hora_inicio == None,
                Reserva.hora_fin == None,
                and_(
                    Reserva.hora_inicio < hora_fin,
                    Reserva.hora_fin > hora_inicio
                )
            )
        ).first()

        if conflicto:
            raise HTTPException(
                status_code=400,
                detail="El espacio ya está reservado para ese horario"
            )

    # Crear la reserva (cajón opcional)
    salida_token = secrets.token_urlsafe(18)
    nueva_reserva = Reserva(
        estacionamiento_id=reserva_data.estacionamiento_id,
        usuario_id=reserva_data.usuario_id,
        cajon_id=cajon_id_to_use,
        fecha_reserva=fecha_reserva,
        hora_inicio=hora_inicio,
        hora_fin=hora_fin,
        placa_vehiculo=reserva_data.placa_vehiculo.upper(),
        estado="pendiente",  # Estado inicial
        salida_token=salida_token
    )
    
    try:
        db.add(nueva_reserva)
        db.commit()
        db.refresh(nueva_reserva)
        
        return {
            "message": "Reserva creada exitosamente",
            "reserva_id": nueva_reserva.id,
            "estado": "pendiente",
            "espacios_restantes": estacionamiento.espacios_disponibles - 1,
            "salida_token": salida_token
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error al crear la reserva: {str(e)}"
        )

# ENDPOINT PARA OBTENER RESERVAS DEL USUARIO
@router.get("/usuario/{usuario_id}", response_model=list[ReservaOutWithEstacionamiento])
def obtener_reservas_usuario(usuario_id: int, db: Session = Depends(get_db)):
    """
    Obtener todas las reservas de un usuario específico
    """
    reservas = db.query(Reserva).filter(
        Reserva.usuario_id == usuario_id
    ).order_by(Reserva.fecha_reserva.desc()).all()
    
    return [
        {
            "id": r.id,
            "usuario_id": r.usuario_id,
            "cajon_id": r.cajon_id,
            "estacionamiento_id": r.estacionamiento_id,
            "fecha_reserva": r.fecha_reserva,
            "estado": r.estado,
            "hora_inicio": r.hora_inicio,
            "hora_fin": r.hora_fin,
            "placa_vehiculo": r.placa_vehiculo,
            "cajon_numero": getattr(r.cajon, "numero_cajon", None),
            "salida_token": r.salida_token,
            "salida_usada": r.salida_usada,
            "hora_salida": r.hora_salida,
            "minutos_exceso": r.minutos_exceso,
            "costo_extra": r.costo_extra,
            "estacionamiento_nombre": getattr(r.estacionamiento, "nombre", None),
            "estacionamiento_precio": getattr(r.estacionamiento, "precio", None),
            "estacionamiento_direccion": getattr(r.estacionamiento, "direccion", None),
        }
        for r in reservas
    ]

# ENDPOINT PARA OBTENER RESERVAS POR ESTACIONAMIENTO Y FECHA
@router.get("/estacionamiento/{estacionamiento_id}", response_model=list[ReservaOutWithUsuario])
def obtener_reservas_estacionamiento(
    estacionamiento_id: int,
    fecha: str,
    hora_inicio: Optional[str] = None,
    hora_fin: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Obtener reservas de un estacionamiento para una fecha específica.
    Si se envían hora_inicio y hora_fin, filtra por traslape de horario.
    """
    try:
        fecha_dt = datetime.strptime(fecha, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use YYYY-MM-DD")

    inicio_dia = datetime.combine(fecha_dt, time.min)
    fin_dia = datetime.combine(fecha_dt, time.max)

    query = db.query(Reserva).filter(
        Reserva.estacionamiento_id == estacionamiento_id,
        Reserva.fecha_reserva >= inicio_dia,
        Reserva.fecha_reserva <= fin_dia,
        Reserva.estado.in_(["pendiente", "aceptada"])
    )

    if hora_inicio and hora_fin:
        try:
            hi = datetime.strptime(hora_inicio, "%H:%M").time()
            hf = datetime.strptime(hora_fin, "%H:%M").time()
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de hora inválido. Use HH:MM")

        query = query.filter(
            or_(
                Reserva.hora_inicio == None,
                Reserva.hora_fin == None,
                and_(Reserva.hora_inicio < hf, Reserva.hora_fin > hi)
            )
        )

    reservas = query.all()
    return [
        {
            "id": r.id,
            "usuario_id": r.usuario_id,
            "usuario_nombre": getattr(r.usuario, "nombre", None),
            "cajon_id": r.cajon_id,
            "cajon_numero": getattr(r.cajon, "numero_cajon", None),
            "estacionamiento_id": r.estacionamiento_id,
            "fecha_reserva": r.fecha_reserva,
            "estado": r.estado,
            "hora_inicio": r.hora_inicio,
            "hora_fin": r.hora_fin,
            "placa_vehiculo": r.placa_vehiculo,
        }
        for r in reservas
    ]

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

# ENDPOINT PARA GENERAR/REGENERAR TOKEN DE SALIDA
@router.post("/{reserva_id}/token")
def generar_token_salida(reserva_id: int, db: Session = Depends(get_db)):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    if reserva.salida_usada:
        raise HTTPException(status_code=400, detail="La salida ya fue registrada")
    if not reserva.salida_token:
        reserva.salida_token = secrets.token_urlsafe(18)
        db.commit()
    return {"reserva_id": reserva.id, "salida_token": reserva.salida_token}

# ENDPOINT PARA REGISTRAR SALIDA CON QR
@router.post("/salida")
def registrar_salida(data: SalidaRequest, db: Session = Depends(get_db)):
    reserva = db.query(Reserva).filter(Reserva.salida_token == data.token).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Token de salida inválido")
    if reserva.salida_usada:
        raise HTTPException(status_code=400, detail="Salida ya registrada")
    if reserva.estado != "aceptada":
        raise HTTPException(status_code=400, detail="La reserva no está aceptada")
    if not reserva.hora_fin:
        raise HTTPException(status_code=400, detail="La reserva no tiene hora fin")

    ahora = datetime.now()
    fin_dt = datetime.combine(reserva.fecha_reserva.date(), reserva.hora_fin)
    delay_minutes = max(0, (ahora - fin_dt).total_seconds() / 60)

    tolerance = 10
    if delay_minutes <= tolerance:
        charge_minutes = 0
    else:
        charge_minutes = math.ceil(delay_minutes / 10) * 10

    precio_hora = reserva.estacionamiento.precio if reserva.estacionamiento else 0
    extra_cost = (charge_minutes / 60) * precio_hora if charge_minutes > 0 else 0

    reserva.hora_salida = ahora
    reserva.minutos_exceso = int(charge_minutes)
    reserva.costo_extra = round(extra_cost, 2) if extra_cost else 0
    reserva.salida_usada = True
    reserva.estado = "completada"

    if charge_minutes > 0:
        mensaje = (
            f"Exceso de {int(charge_minutes)} min. "
            f"Costo extra: ${round(extra_cost, 2)}"
        )
        db.add(Notificacion(
            usuario_id=reserva.usuario_id,
            reserva_id=reserva.id,
            titulo="Tiempo excedido en reserva",
            mensaje=mensaje
        ))
        if reserva.estacionamiento:
            db.add(Notificacion(
                usuario_id=reserva.estacionamiento.duenio_id,
                reserva_id=reserva.id,
                titulo="Reserva con tiempo excedido",
                mensaje=mensaje
            ))

    db.commit()

    return {
        "message": "Salida registrada",
        "minutos_exceso": int(charge_minutes),
        "costo_extra": round(extra_cost, 2)
    }

@router.get("/pendientes/{duenio_id}", response_model=list[ReservaOutWithEstacionamiento])
def obtener_reservas_pendientes(duenio_id: int, db: Session = Depends(get_db)):
    """
    Obtener reservas pendientes para un dueño de estacionamientos
    """
    reservas = db.query(Reserva).join(Estacionamiento).filter(
        Estacionamiento.duenio_id == duenio_id,
        Reserva.estado == "pendiente"
    ).all()

    return [
        {
            "id": r.id,
            "usuario_id": r.usuario_id,
            "cajon_id": r.cajon_id,
            "estacionamiento_id": r.estacionamiento_id,
            "fecha_reserva": r.fecha_reserva,
            "estado": r.estado,
            "hora_inicio": r.hora_inicio,
            "hora_fin": r.hora_fin,
            "placa_vehiculo": r.placa_vehiculo,
            "cajon_numero": getattr(r.cajon, "numero_cajon", None),
            "salida_token": r.salida_token,
            "salida_usada": r.salida_usada,
            "hora_salida": r.hora_salida,
            "minutos_exceso": r.minutos_exceso,
            "costo_extra": r.costo_extra,
            "estacionamiento_nombre": getattr(r.estacionamiento, "nombre", None),
            "estacionamiento_precio": getattr(r.estacionamiento, "precio", None),
            "estacionamiento_direccion": getattr(r.estacionamiento, "direccion", None),
        }
        for r in reservas
    ]

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
