# video_detection.py - Añadir estos endpoints a main.py

from fastapi import WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
import asyncio
import cv2
import base64
import json
import time
from typing import Optional
from datetime import datetime

# ============================================
# ENDPOINT 1: Análisis de Video (archivo)
# ============================================
@app.post("/detect/video/")
async def detect_video(
    file: UploadFile = File(...),
    frame_skip: int = 5,  # Procesar 1 de cada N frames
    max_frames: int = 100  # Máximo de frames a procesar
):
    """
    Analiza un archivo de video y retorna estadísticas agregadas
    """
    try:
        # Guardar video temporalmente
        temp_path = f"temp_video_{int(time.time())}.mp4"
        with open(temp_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Abrir video
        cap = cv2.VideoCapture(temp_path)
        if not cap.isOpened():
            os.remove(temp_path)
            return JSONResponse(status_code=400, content={"error": "No se pudo abrir el video"})
        
        # Info del video
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        model = YOLO(model_path)
        parking_zones = load_parking_zones()
        
        # Resultados por frame
        frame_results = []
        processed_count = 0
        frame_idx = 0
        
        print(f"\n=== PROCESANDO VIDEO ===")
        print(f"FPS: {fps}, Total frames: {total_frames}")
        print(f"Resolución: {width}x{height}")
        
        while cap.isOpened() and processed_count < max_frames:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Saltar frames según frame_skip
            if frame_idx % frame_skip != 0:
                frame_idx += 1
                continue
            
            # Detectar objetos
            results = model(frame, **DETECTION_CONFIG)
            
            all_objects = []
            if results[0].boxes is not None:
                for box in results[0].boxes:
                    class_id = int(box.cls[0])
                    confidence = float(box.conf[0])
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    bbox_area = (x2 - x1) * (y2 - y1)
                    class_name = model.names[class_id]
                    
                    is_significant, reason = is_significant_object(confidence, bbox_area, (x1, y1, x2, y2))
                    
                    if is_significant:
                        center_x = (x1 + x2) / 2
                        center_y = (y1 + y2) / 2
                        all_objects.append({
                            'center': (float(center_x), float(center_y)),
                            'bbox': (float(x1), float(y1), float(x2), float(y2)),
                            'class': class_name,
                            'confidence': float(confidence)
                        })
            
            # Análisis de color
            color_detections = detect_by_color_analysis(frame, parking_zones)
            
            # Analizar zonas
            occupied_zones, zone_details = analyze_parking_zones_simple(
                all_objects, color_detections, parking_zones
            )
            
            frame_results.append({
                'frame': frame_idx,
                'timestamp': frame_idx / fps if fps > 0 else 0,
                'occupied': len(occupied_zones),
                'available': len(parking_zones) - len(occupied_zones),
                'objects_detected': len(all_objects),
                'zones': zone_details
            })
            
            processed_count += 1
            frame_idx += 1
            
            if processed_count % 10 == 0:
                print(f"Procesados {processed_count} frames...")
        
        cap.release()
        os.remove(temp_path)
        
        # Calcular estadísticas agregadas
        avg_occupied = sum(r['occupied'] for r in frame_results) / len(frame_results) if frame_results else 0
        max_occupied = max(r['occupied'] for r in frame_results) if frame_results else 0
        min_occupied = min(r['occupied'] for r in frame_results) if frame_results else 0
        
        # Último frame anotado
        last_annotated = None
        if frame_results:
            cap = cv2.VideoCapture(temp_path) if os.path.exists(temp_path) else None
            # Ya no podemos obtener el último frame, usamos el último resultado
        
        return {
            "success": True,
            "video_info": {
                "fps": fps,
                "total_frames": total_frames,
                "duration_seconds": total_frames / fps if fps > 0 else 0,
                "resolution": f"{width}x{height}"
            },
            "processing_info": {
                "frames_processed": processed_count,
                "frame_skip": frame_skip
            },
            "statistics": {
                "total_zones": len(parking_zones),
                "avg_occupied": round(avg_occupied, 2),
                "max_occupied": max_occupied,
                "min_occupied": min_occupied,
                "avg_available": round(len(parking_zones) - avg_occupied, 2)
            },
            "frame_results": frame_results
        }
        
    except Exception as e:
        print(f"Error procesando video: {e}")
        traceback.print_exc()
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return JSONResponse(status_code=500, content={"error": str(e)})


# ============================================
# ENDPOINT 2: Streaming de Video en Tiempo Real
# ============================================
@app.websocket("/ws/detect/stream")
async def websocket_video_stream(websocket: WebSocket):
    """
    WebSocket para análisis en tiempo real de frames de video/cámara
    El cliente envía frames base64, el servidor responde con detecciones
    """
    await websocket.accept()
    print("WebSocket conectado para streaming")
    
    model = YOLO(model_path)
    parking_zones = load_parking_zones()
    
    try:
        while True:
            # Recibir frame del cliente (base64)
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get('type') == 'frame':
                # Decodificar imagen
                img_data = message['data']
                if ',' in img_data:
                    img_data = img_data.split(',')[1]
                
                img_bytes = base64.b64decode(img_data)
                nparr = np.frombuffer(img_bytes, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                if frame is None:
                    await websocket.send_json({"error": "Frame inválido"})
                    continue
                
                # Detectar
                results = model(frame, **DETECTION_CONFIG)
                
                all_objects = []
                if results[0].boxes is not None:
                    for box in results[0].boxes:
                        class_id = int(box.cls[0])
                        confidence = float(box.conf[0])
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        bbox_area = (x2 - x1) * (y2 - y1)
                        class_name = model.names[class_id]
                        
                        is_significant, _ = is_significant_object(confidence, bbox_area, (x1, y1, x2, y2))
                        
                        if is_significant:
                            all_objects.append({
                                'center': (float((x1+x2)/2), float((y1+y2)/2)),
                                'bbox': (float(x1), float(y1), float(x2), float(y2)),
                                'class': class_name,
                                'confidence': float(confidence)
                            })
                
                color_detections = detect_by_color_analysis(frame, parking_zones)
                occupied_zones, zone_details = analyze_parking_zones_simple(
                    all_objects, color_detections, parking_zones
                )
                
                # Anotar imagen
                annotated = draw_simple_annotations(frame, parking_zones, occupied_zones, zone_details, all_objects)
                _, buffer = cv2.imencode('.jpg', annotated, [cv2.IMWRITE_JPEG_QUALITY, 80])
                annotated_b64 = base64.b64encode(buffer).decode()
                
                # Enviar respuesta
                await websocket.send_json({
                    "type": "detection_result",
                    "timestamp": datetime.now().isoformat(),
                    "image": f"data:image/jpeg;base64,{annotated_b64}",
                    "total": len(parking_zones),
                    "occupied": len(occupied_zones),
                    "available": len(parking_zones) - len(occupied_zones),
                    "objects": len(all_objects),
                    "zones": zone_details
                })
                
            elif message.get('type') == 'ping':
                await websocket.send_json({"type": "pong"})
                
    except WebSocketDisconnect:
        print("WebSocket desconectado")
    except Exception as e:
        print(f"Error en WebSocket: {e}")
        await websocket.close()


# ============================================
# ENDPOINT 3: Análisis Automático Periódico
# ============================================
# Almacén de tareas de monitoreo activas
active_monitors = {}

@app.post("/detect/auto/start")
async def start_auto_detection(
    estacionamiento_id: int = Body(...),
    interval_seconds: int = Body(default=30),  # Intervalo entre análisis
    source_type: str = Body(default="image"),  # "image", "rtsp", "http"
    source_url: Optional[str] = Body(default=None)  # URL de cámara IP
):
    """
    Inicia monitoreo automático de un estacionamiento
    """
    monitor_id = f"monitor_{estacionamiento_id}"
    
    if monitor_id in active_monitors:
        return {"message": "Monitor ya activo", "monitor_id": monitor_id}
    
    active_monitors[monitor_id] = {
        "estacionamiento_id": estacionamiento_id,
        "interval": interval_seconds,
        "source_type": source_type,
        "source_url": source_url,
        "active": True,
        "last_result": None,
        "started_at": datetime.now().isoformat()
    }
    
    # Iniciar tarea en background
    asyncio.create_task(auto_detection_task(monitor_id))
    
    return {
        "success": True,
        "message": "Monitoreo iniciado",
        "monitor_id": monitor_id,
        "interval": interval_seconds
    }

@app.post("/detect/auto/stop")
async def stop_auto_detection(estacionamiento_id: int = Body(...)):
    """Detiene el monitoreo automático"""
    monitor_id = f"monitor_{estacionamiento_id}"
    
    if monitor_id in active_monitors:
        active_monitors[monitor_id]["active"] = False
        del active_monitors[monitor_id]
        return {"success": True, "message": "Monitoreo detenido"}
    
    return {"success": False, "message": "Monitor no encontrado"}

@app.get("/detect/auto/status/{estacionamiento_id}")
async def get_auto_detection_status(estacionamiento_id: int):
    """Obtiene el estado del monitoreo automático"""
    monitor_id = f"monitor_{estacionamiento_id}"
    
    if monitor_id in active_monitors:
        return {
            "active": True,
            "monitor": active_monitors[monitor_id]
        }
    
    return {"active": False}

async def auto_detection_task(monitor_id: str):
    """Tarea de detección automática en background"""
    model = YOLO(model_path)
    parking_zones = load_parking_zones()
    
    while monitor_id in active_monitors and active_monitors[monitor_id]["active"]:
        monitor = active_monitors[monitor_id]
        
        try:
            frame = None
            
            # Obtener frame según tipo de fuente
            if monitor["source_type"] == "image":
                # Leer desde archivo de imagen
                image_path = f"images/estacionamientos/{monitor['estacionamiento_id']}.jpg"
                if os.path.exists(image_path):
                    frame = cv2.imread(image_path)
                    
            elif monitor["source_type"] == "rtsp" and monitor["source_url"]:
                # Leer desde cámara RTSP
                cap = cv2.VideoCapture(monitor["source_url"])
                ret, frame = cap.read()
                cap.release()
                
            elif monitor["source_type"] == "http" and monitor["source_url"]:
                # Leer desde URL HTTP (cámara IP)
                import urllib.request
                resp = urllib.request.urlopen(monitor["source_url"])
                img_array = np.array(bytearray(resp.read()), dtype=np.uint8)
                frame = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
            
            if frame is not None:
                # Realizar detección
                results = model(frame, **DETECTION_CONFIG)
                
                all_objects = []
                if results[0].boxes is not None:
                    for box in results[0].boxes:
                        class_id = int(box.cls[0])
                        confidence = float(box.conf[0])
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        bbox_area = (x2 - x1) * (y2 - y1)
                        class_name = model.names[class_id]
                        
                        is_significant, _ = is_significant_object(confidence, bbox_area, (x1, y1, x2, y2))
                        if is_significant:
                            all_objects.append({
                                'center': (float((x1+x2)/2), float((y1+y2)/2)),
                                'bbox': (float(x1), float(y1), float(x2), float(y2)),
                                'class': class_name,
                                'confidence': float(confidence)
                            })
                
                color_detections = detect_by_color_analysis(frame, parking_zones)
                occupied_zones, zone_details = analyze_parking_zones_simple(
                    all_objects, color_detections, parking_zones
                )
                
                # Actualizar resultado
                active_monitors[monitor_id]["last_result"] = {
                    "timestamp": datetime.now().isoformat(),
                    "total": len(parking_zones),
                    "occupied": len(occupied_zones),
                    "available": len(parking_zones) - len(occupied_zones),
                    "zones": zone_details
                }
                
                print(f"[{monitor_id}] Detectado: {len(occupied_zones)}/{len(parking_zones)} ocupados")
                
        except Exception as e:
            print(f"Error en auto-detección {monitor_id}: {e}")
        
        # Esperar intervalo
        await asyncio.sleep(monitor["interval"])
    
    print(f"Monitor {monitor_id} detenido")