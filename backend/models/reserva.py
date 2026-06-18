from sqlalchemy import Column, Integer, ForeignKey, DateTime, String, Time, Boolean, Float
from sqlalchemy.orm import relationship
from database import Base
import datetime

class Reserva(Base):
    __tablename__ = "reservas"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    cajon_id = Column(Integer, ForeignKey("cajones.id"), nullable=True)  # Ahora completamente opcional
    estacionamiento_id = Column(Integer, ForeignKey("estacionamientos.id"))  
    fecha_reserva = Column(DateTime, default=datetime.datetime.utcnow)
    estado = Column(String(20), default="pendiente")  # pendiente, aceptada, rechazada
    hora_inicio = Column(Time, nullable=True)
    hora_fin = Column(Time, nullable=True)
    placa_vehiculo = Column(String(20), nullable=True)
    salida_token = Column(String(64), nullable=True, index=True)
    salida_usada = Column(Boolean, default=False)
    hora_salida = Column(DateTime, nullable=True)
    minutos_exceso = Column(Integer, nullable=True)
    costo_extra = Column(Float, nullable=True)
    # Campos de pago
    pago_estado = Column(String(30), nullable=True, default=None)  # None, 'pendiente', 'completado', 'fallido'
    pago_id = Column(String(100), nullable=True)  # PayPal order/capture ID
    idempotency_key = Column(String(64), nullable=True, unique=True, index=True)  # Para idempotencia

    usuario = relationship("Usuario", back_populates="reservas")
    cajon = relationship("Cajon", back_populates="reservas")
    estacionamiento = relationship("Estacionamiento", back_populates="reservas")
