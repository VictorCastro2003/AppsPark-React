import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session
from database import SessionLocal
from models.reserva import Reserva
from models.estacionamiento import Estacionamiento
from models.notificacion import Notificacion

# Título usado para marcar que ya se envió la alerta automática
TITULO_ALERTA_OVERSTAY = "¡Tiempo de reserva agotado!"

def job_verificar_estado_estacionamientos():
    """
    Este job corre cada 5 minutos.
    Revisa si hay reservas activas que ya hayan excedido su hora de salida.
    (En el futuro, aquí también se integrará YOLO para verificar la entrada/salida física).
    """
    db = SessionLocal()
    try:
        ahora = datetime.datetime.now()
        
        # 1. BÚSQUEDA DE OVERSTAYS (Sobretiempos)
        # Reservas aceptadas, sin salida registrada
        reservas_activas = db.query(Reserva).filter(
            Reserva.estado == "aceptada",
            Reserva.salida_usada == False
        ).all()

        for reserva in reservas_activas:
            if not reserva.hora_fin:
                continue

            # Combinamos la fecha de la reserva con la hora fin para tener el datetime completo
            fin_dt = datetime.datetime.combine(reserva.fecha_reserva.date(), reserva.hora_fin)
            
            # Si ya pasaron más de 5 minutos de su hora de salida
            minutos_retraso = (ahora - fin_dt).total_seconds() / 60
            
            if minutos_retraso > 5:
                # Comprobar si ya le mandamos la alerta de sobretiempo automática
                alerta_existente = db.query(Notificacion).filter(
                    Notificacion.reserva_id == reserva.id,
                    Notificacion.titulo == TITULO_ALERTA_OVERSTAY
                ).first()

                if not alerta_existente:
                    # Enviar notificación al usuario
                    db.add(Notificacion(
                        usuario_id=reserva.usuario_id,
                        reserva_id=reserva.id,
                        titulo=TITULO_ALERTA_OVERSTAY,
                        mensaje=f"Tu reserva en el cajón ha excedido el tiempo límite. Se comenzarán a aplicar cargos por tiempo extra."
                    ))

                    # Enviar notificación al dueño del estacionamiento
                    estacionamiento = db.query(Estacionamiento).filter_by(id=reserva.estacionamiento_id).first()
                    if estacionamiento:
                        db.add(Notificacion(
                            usuario_id=estacionamiento.duenio_id,
                            reserva_id=reserva.id,
                            titulo="Vehículo con sobretiempo",
                            mensaje=f"La reserva #{reserva.id} se ha quedado más tiempo del pactado. (Pendiente de cobro al salir)."
                        ))
                    
                    db.commit()
                    print(f"[CRON] Alerta de overstay enviada para reserva {reserva.id}")

        # 2. ESPACIO PARA INTEGRAR YOLO (En el futuro)
        # Aquí es donde, al tener cámaras IP conectadas:
        # - Haríamos un request a la cámara: frame = tomar_foto(estacionamiento.url_camara)
        # - resultados = MODEL(frame)
        # - Si el cajón de la reserva.id está vacío pero salida_usada=False:
        #     ¡El auto ya se movió del cajón! 
        #     Llamamos a la función de salida para DETENER EL CRONÓMETRO exacto en ese minuto.
        #     Al registrar la salida, tu lógica actual automáticamente calcula el `costo_extra`
        #     si se pasaron de su hora, y deja esa deuda guardada en la base de datos para cobrarla.

    except Exception as e:
        print(f"[CRON ERROR] Falló la verificación de estacionamientos: {e}")
    finally:
        db.close()


def start_scheduler():
    scheduler = BackgroundScheduler()
    # Ejecutar la verificación cada 5 minutos
    scheduler.add_job(job_verificar_estado_estacionamientos, 'interval', minutes=5)
    scheduler.start()
    print("⏰ Tareas automáticas (Cron Jobs) iniciadas con éxito.")
