# video_detection.py - SINCRONIZADO CON FRONTEND
# Optimizado para que el backend procese a la velocidad del frontend

from fastapi import WebSocket, WebSocketDisconnect, UploadFile, File, Body
from fastapi.responses import StreamingResponse, JSONResponse
import asyncio
import cv2
import base64
import json
import time
import os
import traceback
import numpy as np
from typing import Optional
from datetime import datetime
from ultralytics import YOLO
from concurrent.futures import ThreadPoolExecutor
import torch

# Thread pool optimizado
executor = ThreadPoolExecutor(max_workers=2)  # Reducido a 2 para WebSocket

# ============================================
# FUNCIONES AUXILIARES OPTIMIZADAS
# ============================================

def process_single_frame_fast(frame, model, parking_zones):
    """Procesa un frame de forma ULTRA rápida para WebSocket"""
    try:
        # Detección con resolución muy baja para velocidad
        results = model.predict(frame, verbose=False, imgsz=320, conf=0.25)
        
        all_objects = []
        if results[0].boxes is not None and len(results[0].boxes) > 0:
            for box in results[0].boxes:
                class_id = int(box.cls[0])
                confidence = float(box.conf[0])
                
                if confidence < 0.25:
                    continue
                    
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                class_name = model.names[class_id]
                
                # Solo vehículos
                if class_name in ['car', 'truck', 'bus', 'motorcycle']:
                    all_objects.append({
                        'center': (float((x1+x2)/2), float((y1+y2)/2)),
                        'bbox': (float(x1), float(y1), float(x2), float(y2)),
                        'class': class_name,
                        'confidence': float(confidence)
                    })
        
        # Análisis rápido de zonas usando point_in_polygon
        occupied_zones = set()
        for zone_idx, zone in enumerate(parking_zones):
            zone_points = zone.get('points', [])
            if not zone_points:
                continue
                
            for obj in all_objects:
                # Verificar si el centro está en la zona
                if point_in_polygon_fast(obj['center'], zone_points):
                    occupied_zones.add(zone_idx)
                    break
        
        return {
            'occupied': len(occupied_zones),
            'available': len(parking_zones) - len(occupied_zones),
            'total': len(parking_zones),
            'objects': all_objects
        }
        
    except Exception as e:
        print(f"Error procesando frame: {e}")
        return None


def point_in_polygon_fast(point, polygon):
    """Versión rápida de point_in_polygon"""
    x, y = point
    n = len(polygon)
    inside = False
    p1x, p1y = polygon[0]
    for i in range(1, n + 1):
        p2x, p2y = polygon[i % n]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside


def draw_detections_fast(frame, zones, occupied_zones, objects):
    """Dibuja detecciones de forma rápida"""
    annotated = frame.copy()
    
    # Dibujar objetos
    for obj in objects:
        x1, y1, x2, y2 = [int(v) for v in obj['bbox']]
        cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 255), 2)
        # Etiqueta
        label = f"{obj['class']} {obj['confidence']:.2f}"
        cv2.putText(annotated, label, (x1, y1-10), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 2)
    
    # Dibujar zonas
    for i, zone in enumerate(zones):
        points = np.array(zone.get('points', []), np.int32).reshape((-1, 1, 2))
        color = (0, 0, 255) if i in occupied_zones else (0, 255, 0)
        
        # Polígono con relleno transparente
        overlay = annotated.copy()
        cv2.fillPoly(overlay, [points], color)
        cv2.addWeighted(overlay, 0.3, annotated, 0.7, 0, annotated)
        
        # Borde
        cv2.polylines(annotated, [points], True, color, 3)
        
        # Número de zona
        if len(points) > 0:
            center = points.mean(axis=0)[0]
            status = "OCUPADO" if i in occupied_zones else "LIBRE"
            cv2.putText(annotated, f"#{i+1} {status}", 
                       tuple(center.astype(int)), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    
    return annotated


# ============================================
# ENDPOINT: WebSocket OPTIMIZADO para Frontend
# ============================================
@app.websocket("/ws/detect/stream/{estacionamiento_id}")
async def websocket_video_stream_optimized(websocket: WebSocket, estacionamiento_id: int):
    """
    WebSocket OPTIMIZADO para streaming del frontend
    Procesa frames a la velocidad que los envía el frontend
    """
    await websocket.accept()
    print(f"🔌 WebSocket conectado - Estacionamiento {estacionamiento_id}")
    
    # Cargar modelo UNA sola vez
    model = YOLO(model_path)
    if torch.cuda.is_available():
        model.to('cuda')
        print("✅ Usando GPU")
    else:
        print("⚠️ Usando CPU")
    
    # Cargar zonas específicas del estacionamiento
    parking_zones = load_parking_zones(estacionamiento_id)
    print(f"📍 Zonas cargadas: {len(parking_zones)}")
    
    # Estadísticas
    frame_count = 0
    start_time = time.time()
    last_fps_update = time.time()
    fps = 0
    
    try:
        while True:
            # Recibir frame del frontend
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get('type') == 'frame':
                frame_start = time.time()
                
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
                
                # Redimensionar para velocidad (opcional)
                h, w = frame.shape[:2]
                if w > 800:  # Si es muy grande, reducir
                    scale = 800 / w
                    new_w, new_h = 800, int(h * scale)
                    frame = cv2.resize(frame, (new_w, new_h))
                
                # PROCESAR con el modelo (esto es lo que toma tiempo)
                result = await asyncio.get_event_loop().run_in_executor(
                    executor,
                    process_single_frame_fast,
                    frame, model, parking_zones
                )
                
                if result:
                    # Dibujar anotaciones
                    annotated = draw_detections_fast(
                        frame, 
                        parking_zones, 
                        set(range(result['occupied'])),  # Simplificado
                        result['objects']
                    )
                    
                    # Codificar resultado
                    _, buffer = cv2.imencode('.jpg', annotated, 
                                            [cv2.IMWRITE_JPEG_QUALITY, 75])
                    annotated_b64 = base64.b64encode(buffer).decode()
                    
                    # Calcular FPS
                    frame_count += 1
                    current_time = time.time()
                    if current_time - last_fps_update >= 1.0:
                        fps = frame_count / (current_time - last_fps_update)
                        frame_count = 0
                        last_fps_update = current_time
                    
                    processing_time = time.time() - frame_start
                    
                    # Enviar respuesta
                    await websocket.send_json({
                        "type": "detection_result",
                        "timestamp": datetime.now().isoformat(),
                        "image": f"data:image/jpeg;base64,{annotated_b64}",
                        "total": result['total'],
                        "occupied": result['occupied'],
                        "available": result['available'],
                        "objects": len(result['objects']),
                        "fps": round(fps, 1),
                        "processing_time_ms": round(processing_time * 1000, 1)
                    })
                    
                    # Log cada 30 frames
                    if frame_count % 30 == 0:
                        print(f"📊 FPS: {fps:.1f} | Procesamiento: {processing_time*1000:.1f}ms")
                
            elif message.get('type') == 'ping':
                await websocket.send_json({"type": "pong"})
                
    except WebSocketDisconnect:
        print(f"🔌 WebSocket desconectado - Estacionamiento {estacionamiento_id}")
    except Exception as e:
        print(f"❌ Error WebSocket: {e}")
        traceback.print_exc()
        await websocket.close()


# ============================================
# ENDPOINT: Análisis de Video Completo
# ============================================
@app.post("/detect/video/")
async def detect_video_batch(
    file: UploadFile = File(...),
    estacionamiento_id: Optional[int] = None,
    frame_skip: int = 30,  # 1 de cada 30 frames
    max_frames: int = 50,  # Máximo 50 frames
    resize_width: int = 640  # Resolución moderada
):
    """
    Analiza un video completo de forma optimizada
    Útil para análisis histórico o reportes
    """
    temp_path = None
    try:
        # Guardar video temporalmente
        temp_path = f"temp_video_{int(time.time())}_{estacionamiento_id or 0}.mp4"
        with open(temp_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Abrir video
        cap = cv2.VideoCapture(temp_path)
        if not cap.isOpened():
            return JSONResponse(status_code=400, 
                              content={"error": "No se pudo abrir el video"})
        
        # Info del video
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        duration = total_frames / fps if fps > 0 else 0
        
        print(f"\n🎬 === PROCESANDO VIDEO ===")
        print(f"📹 {width}x{height} @ {fps:.1f} fps")
        print(f"⏱️  Duración: {duration:.1f}s ({total_frames} frames)")
        print(f"🎯 Procesará ~{total_frames//frame_skip} frames")
        
        # Cargar modelo y zonas
        model = YOLO(model_path)
        if torch.cuda.is_available():
            model.to('cuda')
        
        parking_zones = load_parking_zones(estacionamiento_id) if estacionamiento_id else load_parking_zones()
        
        # Calcular escala
        scale = resize_width / width if width > resize_width else 1.0
        new_height = int(height * scale)
        
        start_time = time.time()
        
        # Extraer y procesar frames
        frame_results = []
        frame_idx = 0
        processed = 0
        
        print("📥 Extrayendo frames...")
        
        while cap.isOpened() and processed < max_frames:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Saltar frames
            if frame_idx % frame_skip != 0:
                frame_idx += 1
                continue
            
            # Redimensionar
            if scale < 1.0:
                frame = cv2.resize(frame, (resize_width, new_height))
            
            # Procesar
            result = process_single_frame_fast(frame, model, parking_zones)
            
            if result:
                frame_results.append({
                    'frame': frame_idx,
                    'timestamp': frame_idx / fps if fps > 0 else 0,
                    'occupied': result['occupied'],
                    'available': result['available'],
                    'objects_detected': len(result['objects'])
                })
                
                processed += 1
                
                if processed % 10 == 0:
                    elapsed = time.time() - start_time
                    print(f"   ✓ {processed} frames ({processed/elapsed:.1f} fps)")
            
            frame_idx += 1
        
        cap.release()
        processing_time = time.time() - start_time
        
        # Calcular estadísticas
        if frame_results:
            avg_occupied = sum(r['occupied'] for r in frame_results) / len(frame_results)
            max_occupied = max(r['occupied'] for r in frame_results)
            min_occupied = min(r['occupied'] for r in frame_results)
        else:
            avg_occupied = max_occupied = min_occupied = 0
        
        print(f"\n✅ === COMPLETADO ===")
        print(f"⏱️  {processing_time:.2f}s")
        print(f"⚡ {len(frame_results)/processing_time:.1f} fps")
        print(f"📊 Ocupación: {avg_occupied:.1f}/{len(parking_zones)}")
        
        return {
            "success": True,
            "video_info": {
                "fps": fps,
                "total_frames": total_frames,
                "duration_seconds": duration,
                "resolution": f"{width}x{height}",
                "processing_resolution": f"{resize_width}x{new_height}"
            },
            "processing_info": {
                "frames_processed": len(frame_results),
                "frame_skip": frame_skip,
                "processing_time_seconds": round(processing_time, 2),
                "processing_fps": round(len(frame_results)/processing_time, 2)
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
        print(f"❌ Error: {e}")
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})
    
    finally:
        # Limpiar archivo temporal
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except:
                pass