from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class Cajon(Base):
    __tablename__ = "cajones"

    id = Column(Integer, primary_key=True, index=True)
    numero_cajon = Column(String(10), nullable=False)
    status = Column(String(10), default="libre")  # puede ser "libre" u "ocupado"
    coordenadas = Column(String, nullable=True)  # guardado como JSON string o texto

    estacionamiento_id = Column(Integer, ForeignKey("estacionamientos.id"))

    estacionamiento = relationship("Estacionamiento", back_populates="cajones")
    reservas = relationship("Reserva", back_populates="cajon")
