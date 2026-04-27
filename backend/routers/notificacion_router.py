from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.notificacion import Notificacion
from schemas.notificacion_schema import NotificacionOut

router = APIRouter(prefix="/notificaciones", tags=["notificaciones"])


@router.get("/usuario/{usuario_id}", response_model=list[NotificacionOut])
def listar_notificaciones_usuario(usuario_id: int, db: Session = Depends(get_db)):
    return db.query(Notificacion).filter(
        Notificacion.usuario_id == usuario_id
    ).order_by(Notificacion.fecha_creacion.desc()).all()


@router.put("/{notificacion_id}/leida")
def marcar_notificacion_leida(notificacion_id: int, db: Session = Depends(get_db)):
    notif = db.query(Notificacion).filter(Notificacion.id == notificacion_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    notif.leida = True
    db.commit()
    return {"message": "Notificación marcada como leída"}
