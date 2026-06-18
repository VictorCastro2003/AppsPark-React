"""
Router de pagos con PayPal (REST API v2).
- Crea órdenes PayPal con idempotency_key para evitar doble cobro.
- Captura el pago cuando el usuario aprueba en PayPal.
- Actualiza el estado de la reserva con el resultado.
"""

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from database import get_db
from models.reserva import Reserva
from models.estacionamiento import Estacionamiento
from pydantic import BaseModel
from typing import Optional
import os
import requests
import secrets
from datetime import datetime

router = APIRouter(prefix="/pagos", tags=["pagos"])

# ─── Credenciales PayPal Sandbox ──────────────────────────────────────────────
# IMPORTANTE: En producción mueve estas claves a variables de entorno (.env)
PAYPAL_CLIENT_ID = os.getenv(
    "PAYPAL_CLIENT_ID",
    "AZ3g62L0PvLGDVFGpqSIHMXQUZ2FGfvGcl5c3vLqbXMZKW7oBGIuqbNQ7q0ZqEAC3NhEwJ2nKQWPsUZ"  # Sandbox demo key
)
PAYPAL_CLIENT_SECRET = os.getenv(
    "PAYPAL_CLIENT_SECRET",
    "EEHqKMqf6JnxovMhAHCiUh-0_tFhFkJlp1bRN0hI8n-tnHNXGCEqr7RFSbdv0gJ3TcQLVWx0PuJoY4g"  # Sandbox demo secret
)
PAYPAL_BASE_URL = os.getenv("PAYPAL_BASE_URL", "https://api-m.sandbox.paypal.com")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


# ─── Schemas ──────────────────────────────────────────────────────────────────
class CrearOrdenRequest(BaseModel):
    reserva_id: int
    idempotency_key: str  # UUID v4 generado en el frontend


class CapturarPagoRequest(BaseModel):
    paypal_order_id: str
    reserva_id: int


# ─── Helpers PayPal ───────────────────────────────────────────────────────────
def get_paypal_token() -> str:
    """Obtiene access_token de PayPal mediante Client Credentials."""
    resp = requests.post(
        f"{PAYPAL_BASE_URL}/v1/oauth2/token",
        auth=(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET),
        data={"grant_type": "client_credentials"},
        timeout=10,
    )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"No se pudo autenticar con PayPal: {resp.text}"
        )
    return resp.json()["access_token"]


def calcular_monto(reserva: Reserva) -> float:
    """Calcula el monto total de la reserva en base al precio/hora."""
    if not (reserva.hora_inicio and reserva.hora_fin and reserva.estacionamiento):
        return 0.0
    inicio = datetime.combine(datetime.today(), reserva.hora_inicio)
    fin = datetime.combine(datetime.today(), reserva.hora_fin)
    horas = max(0, (fin - inicio).total_seconds() / 3600)
    precio_hora = float(reserva.estacionamiento.precio or 0)
    return round(horas * precio_hora, 2)


# ─── Endpoints ────────────────────────────────────────────────────────────────
@router.post("/crear-orden")
def crear_orden_paypal(body: CrearOrdenRequest, db: Session = Depends(get_db)):
    """
    Crea una orden PayPal para la reserva dada.
    
    Idempotencia: si ya existe una orden activa con el mismo idempotency_key
    se devuelve la orden existente en vez de crear una nueva.
    """
    # 1) Verificar reserva
    reserva = db.query(Reserva).filter(Reserva.id == body.reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    if reserva.estado not in ("pendiente", "aceptada"):
        raise HTTPException(
            status_code=400,
            detail=f"No se puede pagar una reserva con estado '{reserva.estado}'"
        )

    # 2) Idempotencia: si ya existe una orden pendiente para esta clave, devolverla
    existente = db.query(Reserva).filter(
        Reserva.idempotency_key == body.idempotency_key
    ).first()
    if existente and existente.id != body.reserva_id:
        raise HTTPException(
            status_code=409,
            detail="Idempotency key ya utilizada para otra reserva"
        )
    if reserva.pago_estado == "completado":
        raise HTTPException(
            status_code=409,
            detail="Esta reserva ya fue pagada"
        )
    if reserva.pago_id and reserva.pago_estado == "pendiente":
        # Devolver la orden ya existente (idempotencia)
        return {
            "paypal_order_id": reserva.pago_id,
            "monto": calcular_monto(reserva),
            "moneda": "MXN",
            "idempotency_key": body.idempotency_key,
            "ya_existia": True,
        }

    # 3) Calcular monto
    monto = calcular_monto(reserva)
    if monto <= 0:
        raise HTTPException(
            status_code=400,
            detail="No se puede calcular el monto de la reserva. Verifica horas y precio."
        )

    # 4) Crear orden en PayPal
    token = get_paypal_token()
    payload = {
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "reference_id": str(reserva.id),
                "description": f"Reserva AppsPark #{reserva.id} - {getattr(reserva.estacionamiento, 'nombre', 'Estacionamiento')}",
                "amount": {
                    "currency_code": "MXN",
                    "value": f"{monto:.2f}",
                },
            }
        ],
        "application_context": {
            "brand_name": "AppsPark",
            "landing_page": "NO_PREFERENCE",
            "user_action": "PAY_NOW",
            "return_url": f"{FRONTEND_URL}/mis-reservas",
            "cancel_url": f"{FRONTEND_URL}/reservar",
        },
    }

    resp = requests.post(
        f"{PAYPAL_BASE_URL}/v2/checkout/orders",
        json=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "PayPal-Request-Id": body.idempotency_key,  # Idempotencia nativa de PayPal
        },
        timeout=15,
    )

    if resp.status_code not in (200, 201):
        raise HTTPException(
            status_code=502,
            detail=f"Error creando orden PayPal: {resp.text}"
        )

    order_data = resp.json()
    paypal_order_id = order_data["id"]

    # 5) Persistir datos de pago en la reserva
    reserva.pago_id = paypal_order_id
    reserva.pago_estado = "pendiente"
    reserva.idempotency_key = body.idempotency_key
    db.commit()

    return {
        "paypal_order_id": paypal_order_id,
        "monto": monto,
        "moneda": "MXN",
        "idempotency_key": body.idempotency_key,
        "ya_existia": False,
    }


@router.post("/capturar")
def capturar_pago_paypal(body: CapturarPagoRequest, db: Session = Depends(get_db)):
    """
    Captura el pago de una orden PayPal ya aprobada por el usuario.
    Actualiza el estado de la reserva a 'pagado'.
    """
    reserva = db.query(Reserva).filter(Reserva.id == body.reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    # Idempotencia: si ya fue capturado, devolver éxito sin volver a cobrar
    if reserva.pago_estado == "completado":
        return {
            "message": "El pago ya fue procesado anteriormente",
            "reserva_id": reserva.id,
            "pago_estado": "completado",
            "pago_id": reserva.pago_id,
        }

    if reserva.pago_id != body.paypal_order_id:
        raise HTTPException(
            status_code=400,
            detail="El ID de orden PayPal no coincide con la reserva"
        )

    # Capturar orden en PayPal
    token = get_paypal_token()
    resp = requests.post(
        f"{PAYPAL_BASE_URL}/v2/checkout/orders/{body.paypal_order_id}/capture",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        timeout=15,
    )

    if resp.status_code not in (200, 201):
        reserva.pago_estado = "fallido"
        db.commit()
        raise HTTPException(
            status_code=502,
            detail=f"Error capturando pago PayPal: {resp.text}"
        )

    capture_data = resp.json()
    capture_status = capture_data.get("status")

    if capture_status == "COMPLETED":
        capture_id = (
            capture_data.get("purchase_units", [{}])[0]
            .get("payments", {})
            .get("captures", [{}])[0]
            .get("id", body.paypal_order_id)
        )
        reserva.pago_estado = "completado"
        reserva.pago_id = capture_id
        db.commit()
        return {
            "message": "Pago completado exitosamente",
            "reserva_id": reserva.id,
            "pago_estado": "completado",
            "pago_id": capture_id,
            "capture_data": {
                "status": capture_status,
                "id": capture_id,
            },
        }
    else:
        reserva.pago_estado = "fallido"
        db.commit()
        raise HTTPException(
            status_code=400,
            detail=f"Pago no completado. Estado PayPal: {capture_status}"
        )


@router.get("/estado/{reserva_id}")
def obtener_estado_pago(reserva_id: int, db: Session = Depends(get_db)):
    """Obtiene el estado de pago actual de una reserva."""
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    return {
        "reserva_id": reserva.id,
        "pago_estado": reserva.pago_estado,
        "pago_id": reserva.pago_id,
    }
