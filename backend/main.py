from fastapi import FastAPI, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from ultralytics import YOLO
from fastapi import WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from datetime import datetime
import numpy as np
import cv2
import base64
import traceback
import os
import json
import torch
from fastapi import Body


# ============================================
# MIDDLEWARE PERSONALIZADO PARA CORS EN ARCHIVOS ESTÁTICOS
# ============================================
class CORSStaticFilesMiddleware(BaseHTTPMiddleware):
    """Middleware para agregar headers CORS a archivos estáticos"""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Si es una solicitud a /videos/, agregar headers CORS
        if request.url.path.startswith('/videos/'):
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = '*'
            response.headers['Access-Control-Expose-Headers'] = 'Content-Length, Content-Range'
        
        return response


from contextlib import asynccontextmanager
from cron_jobs import start_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Iniciar los cron jobs en background
    start_scheduler()
    yield

app = FastAPI(
    title="Sistema de Detección de Estacionamiento",
    description="API para detección de espacios de estacionamiento usando YOLO",
    version="1.0.0",
    lifespan=lifespan
)

# CORS config - DEBE IR PRIMERO
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]  # Importante para videos
)

# Agregar middleware personalizado para archivos estáticos
app.add_middleware(CORSStaticFilesMiddleware)

print("=== IMPORTANDO ROUTERS ===")

try:
    from routers.usuario_router import router as usuario_router
    app.include_router(usuario_router)
    print("✓ Router usuarios importado exitosamente")
except ImportError as e:
    print(f"✗ Error importando usuario_router: {e}")

try:
    from routers.auth_router import router as auth_router
    app.include_router(auth_router)
    print("✓ Router auth importado exitosamente")
except ImportError as e:
    print(f"✗ Error importando auth_router: {e}")

try:
    from routers.estacionamiento_router import router as estacionamiento_router
    app.include_router(estacionamiento_router)
    print("✓ Router estacionamiento importado exitosamente")
except ImportError as e:
    print(f"✗ Error importando estacionamiento_router: {e}")

try:
    from routers.reserva_router import router as reserva_router
    app.include_router(reserva_router)
    print("✓ Router reserva importado exitosamente")
except ImportError as e:
    print(f"✗ Error importando reserva_router: {e}")

try:
    from routers.notificacion_router import router as notificacion_router
    app.include_router(notificacion_router)
    print("✓ Router notificaciones importado exitosamente")
except ImportError as e:
    print(f"✗ Error importando notificacion_router: {e}")

try:
    from routers.pago_router import router as pago_router
    app.include_router(pago_router)
    print("✓ Router pagos (PayPal) importado exitosamente")
except ImportError as e:
    print(f"✗ Error importando pago_router: {e}")

print("=== FIN IMPORTACIÓN ROUTERS ===\n")

model_path = "yolo11n.pt"
if not os.path.exists(model_path):
    raise FileNotFoundError(f"Modelo no encontrado: {model_path}")

# Cargar modelo una sola vez (singleton)
MODEL = YOLO(model_path)

# Cache simple de zonas por estacionamiento (con validación por mtime)
PARKING_ZONES_CACHE = {}

DETECTION_CONFIG = {"conf": 0.2, "iou": 0.4}

# Zonas por defecto si no existe archivo
DEFAULT_ZONES = [
    {"points": [[30, 200], [120, 200], [120, 310], [30, 310]]},
    {"points": [[140, 200], [230, 200], [230, 310], [140, 310]]},
    {"points": [[250, 200], [340, 200], [340, 310], [250, 310]]},
    {"points": [[360, 200], [450, 200], [450, 310], [360, 310]]},
    {"points": [[30, 330], [120, 330], [120, 440], [30, 440]]},
    {"points": [[140, 330], [230, 330], [230, 440], [140, 440]]},
    {"points": [[250, 330], [340, 330], [340, 440], [250, 440]]},
    {"points": [[360, 330], [450, 330], [450, 440], [360, 440]]},
]

def load_parking_zones(estacionamiento_id: int = None):
    """
    Carga las zonas de estacionamiento desde archivo JSON.
    Si se proporciona estacionamiento_id, busca en bounding_boxes/{id}.json
    Si no existe, usa el archivo general bounding_boxes.json
    Si tampoco existe, usa zonas por defecto.
    """
    print(f"\n{'='*50}")
    print(f"📄 CARGANDO BOUNDING BOXES")
    print(f"   Estacionamiento ID recibido: {estacionamiento_id}")
    print(f"   Tipo: {type(estacionamiento_id)}")
    print(f"{'='*50}")
    
    # Intentar cargar archivo específico del estacionamiento
    if estacionamiento_id is not None:
        # Asegurar que sea entero
        estacionamiento_id = int(estacionamiento_id)
        specific_path = f"bounding_boxes/{estacionamiento_id}.json"
        
        print(f"📂 Buscando archivo específico: {specific_path}")
        print(f"   ¿Existe? {os.path.exists(specific_path)}")
        
        if os.path.exists(specific_path):
            # Cache por mtime
            mtime = os.path.getmtime(specific_path)
            cached = PARKING_ZONES_CACHE.get(specific_path)
            if cached and cached["mtime"] == mtime:
                return cached["zones"]
            try:
                with open(specific_path, 'r') as f:
                    data = json.load(f)
                    print(f"✅ Zonas cargadas desde: {specific_path}")
                    print(f"   Cantidad de zonas: {len(data)}")
                    # Mostrar primera zona para verificar
                    if data and len(data) > 0:
                        print(f"   Primera zona (verificación): {data[0]}")
                    PARKING_ZONES_CACHE[specific_path] = {"zones": data, "mtime": mtime}
                    return data
            except Exception as e:
                print(f"❌ Error leyendo {specific_path}: {e}")
        else:
            print(f"⚠️ Archivo NO encontrado: {specific_path}")
            # Listar archivos disponibles en la carpeta
            if os.path.exists("bounding_boxes"):
                archivos = os.listdir("bounding_boxes")
                print(f"   Archivos disponibles en bounding_boxes/: {archivos}")
    
    # Intentar cargar archivo general
    general_path = "bounding_boxes.json"
    print(f"\n📂 Intentando archivo general: {general_path}")
    print(f"   ¿Existe? {os.path.exists(general_path)}")
    
    if os.path.exists(general_path):
        # Cache por mtime
        mtime = os.path.getmtime(general_path)
        cached = PARKING_ZONES_CACHE.get(general_path)
        if cached and cached["mtime"] == mtime:
            return cached["zones"]
        try:
            with open(general_path, 'r') as f:
                data = json.load(f)
                print(f"✅ Zonas cargadas desde: {general_path}")
                print(f"   Cantidad de zonas: {len(data)}")
                PARKING_ZONES_CACHE[general_path] = {"zones": data, "mtime": mtime}
                return data
        except Exception as e:
            print(f"❌ Error leyendo {general_path}: {e}")
    
    # Usar zonas por defecto
    print("⚠️ Usando zonas por defecto (no se encontró archivo JSON)")
    print(f"   Cantidad de zonas por defecto: {len(DEFAULT_ZONES)}")
    return DEFAULT_ZONES


def point_in_polygon(point, polygon):
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


def calculate_overlap_percentage(bbox, polygon):
    try:
        x1, y1, x2, y2 = bbox
        rect_points = np.array([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], dtype=np.float32)
        polygon_points = np.array(polygon, dtype=np.float32)
        retval, intersection = cv2.intersectConvexConvex(rect_points, polygon_points)
        if retval > 0 and intersection is not None and len(intersection) > 2:
            overlap_area = cv2.contourArea(intersection)
            bbox_area = (x2 - x1) * (y2 - y1)
            if bbox_area > 0:
                return overlap_area / bbox_area
        return 0.0
    except Exception as e:
        print(f"Error calculando overlap: {e}")
        return 0.0


def is_significant_object(confidence, bbox_area, bbox):
    if confidence < 0.15:
        return False, f"Confianza muy baja: {confidence:.3f}"
    min_area = 500
    if bbox_area < min_area:
        return False, f"Área muy pequeña: {bbox_area:.0f} < {min_area}"
    x1, y1, x2, y2 = bbox
    width = x2 - x1
    height = y2 - y1
    aspect_ratio = width / height if height > 0 else 0
    if not (0.2 <= aspect_ratio <= 8.0):
        return False, f"Aspecto extremo: {aspect_ratio:.2f}"
    return True, "Objeto significativo detectado"


def detect_by_color_analysis(image_cv2, parking_zones):
    hsv = cv2.cvtColor(image_cv2, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(image_cv2, cv2.COLOR_BGR2GRAY)
    potential_objects = []
    
    for i, zone in enumerate(parking_zones):
        mask = np.zeros(image_cv2.shape[:2], dtype=np.uint8)
        points = np.array(zone['points'], np.int32)
        cv2.fillPoly(mask, [points], 255)
        zone_gray = cv2.bitwise_and(gray, gray, mask=mask)
        zone_hsv = cv2.bitwise_and(hsv, hsv, mask=mask)
        masked_pixels = gray[mask > 0]
        
        if len(masked_pixels) > 0:
            intensity_std = np.std(masked_pixels)
            variability_score = intensity_std / 255.0
            edges = cv2.Canny(zone_gray, 50, 150)
            edge_pixels = cv2.countNonZero(edges)
            zone_area = cv2.countNonZero(mask)
            edge_density = edge_pixels / zone_area if zone_area > 0 else 0
            zone_hsv_masked = zone_hsv[mask > 0]
            saturation_score = np.mean(zone_hsv_masked[:, 1]) / 255.0 if len(zone_hsv_masked) > 0 else 0
            
            combined_score = variability_score * 0.4 + edge_density * 0.4 + saturation_score * 0.2
            
            if combined_score > 0.15:
                confidence_score = min(combined_score * 2.0, 0.9)
                potential_objects.append({
                    'zone_id': i,
                    'combined_score': combined_score,
                    'confidence_score': confidence_score,
                    'variability_score': variability_score,
                    'edge_density': edge_density,
                    'saturation_score': saturation_score
                })
    
    return potential_objects


def analyze_parking_zones_simple(all_objects, color_detections, parking_zones):
    occupied_zones = set()
    zone_details = []
    
    for zone_idx, zone in enumerate(parking_zones):
        is_occupied = False
        occupying_object = None
        best_overlap = 0
        detection_method = "none"
        confidence_score = 0.0
        
        for obj in all_objects:
            center_in_zone = point_in_polygon(obj['center'], zone['points'])
            overlap_percentage = calculate_overlap_percentage(obj['bbox'], zone['points'])
            if center_in_zone or overlap_percentage > 0.15:
                if overlap_percentage > best_overlap:
                    is_occupied = True
                    occupying_object = obj
                    best_overlap = overlap_percentage
                    detection_method = "object_detection"
                    confidence_score = obj['confidence']
        
        color_confidence = 0.0
        for cd in color_detections:
            if cd['zone_id'] == zone_idx:
                color_confidence = cd['confidence_score']
                if not is_occupied and cd['confidence_score'] > 0.3:
                    is_occupied = True
                    detection_method = "color_analysis"
                    confidence_score = cd['confidence_score']
                elif is_occupied and cd['confidence_score'] > 0.2:
                    detection_method = "dual_detection"
                break
        
        if is_occupied:
            occupied_zones.add(zone_idx)
        
        zone_details.append({
            'id': zone_idx + 1,
            'occupied': is_occupied,
            'confidence': float(confidence_score),
            'detection_method': detection_method,
            'overlap_percentage': float(best_overlap),
            'color_confidence': float(color_confidence)
        })
    
    return occupied_zones, zone_details


def draw_simple_annotations(image, parking_zones, occupied_zones, zone_details, all_objects):
    annotated_image = image.copy()
    for obj in all_objects:
        x1, y1, x2, y2 = obj['bbox']
        cv2.rectangle(annotated_image, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 255), 2)
    
    for i, zone in enumerate(parking_zones):
        points = np.array(zone['points'], np.int32).reshape((-1, 1, 2))
        color = (0, 0, 255) if i in occupied_zones else (0, 255, 0)
        cv2.polylines(annotated_image, [points], True, color, 4)
        overlay = annotated_image.copy()
        cv2.fillPoly(overlay, [points], color)
        cv2.addWeighted(overlay, 0.3, annotated_image, 0.7, 0, annotated_image)
    
    return annotated_image


def process_detection(image_cv2, estacionamiento_id=None):
    """Función común para procesar detección"""
    parking_zones = load_parking_zones(estacionamiento_id)
    
    print(f"\n=== DETECCIÓN DE ESTACIONAMIENTO ===")
    print(f"Dimensiones imagen: {image_cv2.shape}")
    print(f"Zonas a analizar: {len(parking_zones)}")
    
    # Detección YOLO
    results = MODEL(image_cv2, **DETECTION_CONFIG)
    all_objects = []
    
    if results[0].boxes is not None:
        for box in results[0].boxes:
            class_id = int(box.cls[0])
            confidence = float(box.conf[0])
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
            bbox_area = (x2 - x1) * (y2 - y1)
            class_name = MODEL.names[class_id]
            is_significant, reason = is_significant_object(confidence, bbox_area, (x1, y1, x2, y2))
            
            if is_significant:
                center_x, center_y = (x1 + x2) / 2, (y1 + y2) / 2
                all_objects.append({
                    'center': (float(center_x), float(center_y)),
                    'bbox': (float(x1), float(y1), float(x2), float(y2)),
                    'class': class_name,
                    'confidence': float(confidence),
                    'reason': reason
                })
                print(f"✓ OBJETO: {class_name} (conf: {confidence:.3f})")
    
    # Análisis de color
    color_detections = detect_by_color_analysis(image_cv2, parking_zones)
    
    # Análisis de zonas
    occupied_zones, zone_details = analyze_parking_zones_simple(all_objects, color_detections, parking_zones)
    
    # Imagen anotada
    annotated_image = draw_simple_annotations(image_cv2, parking_zones, occupied_zones, zone_details, all_objects)
    
    # Estadísticas
    total_zones = len(parking_zones)
    occupied_count = len(occupied_zones)
    available_count = total_zones - occupied_count
    occupancy_rate = (occupied_count / total_zones) * 100 if total_zones > 0 else 0
    
    # Codificar imagen
    _, buffer = cv2.imencode(".jpg", annotated_image)
    encoded_image = base64.b64encode(buffer).decode("utf-8")
    data_uri = f"data:image/jpeg;base64,{encoded_image}"
    
    return {
        "data_uri": data_uri,
        "total_zones": total_zones,
        "occupied_count": occupied_count,
        "available_count": available_count,
        "occupancy_rate": occupancy_rate,
        "all_objects": all_objects,
        "color_detections": color_detections,
        "zone_details": zone_details
    }


@app.post("/detect/")
async def detect_parking(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        image_cv2 = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image_cv2 is None:
            return JSONResponse(status_code=400, content={"error": "No se pudo decodificar la imagen"})
        
        result = process_detection(image_cv2)
        
        return {
            "success": True,
            "image_annotated": result["data_uri"],
            "total": result["total_zones"],
            "occupied": result["occupied_count"],
            "available": result["available_count"],
            "occupancy_rate": round(result["occupancy_rate"], 1),
            "statistics": {
                "total": result["total_zones"],
                "occupied": result["occupied_count"],
                "available": result["available_count"],
                "occupancy_rate": round(result["occupancy_rate"], 1)
            },
            "detection_info": {
                "objects_detected": len(result["all_objects"]),
                "color_analysis_zones": len(result["color_detections"]),
                "detection_method": "simplified_any_object"
            },
            "zones": result["zone_details"]
        }
    except Exception as e:
        print(f"Error en detección: {str(e)}")
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@app.post("/detect/estacionamiento/")
async def detect_estacionamiento(estacionamiento_id: int = Body(..., embed=True)):
    try:
        print(f"\n{'='*60}")
        print(f"🎯 ENDPOINT /detect/estacionamiento/ LLAMADO")
        print(f"   ID recibido: {estacionamiento_id}")
        print(f"   Tipo: {type(estacionamiento_id)}")
        print(f"{'='*60}")
        
        # Asegurar que el ID sea entero
        estacionamiento_id = int(estacionamiento_id)
        
        # Buscar imagen específica del estacionamiento
        image_path = f"images/estacionamientos/{estacionamiento_id}.jpg"
        print(f"\n📷 Buscando imagen en: {image_path}")
        
        if not os.path.exists(image_path):
            print(f"⚠️ Imagen específica no encontrada, usando default")
            image_path = "images/default_parking.jpg"
        
        if not os.path.exists(image_path):
            print(f"❌ No se encontró ninguna imagen")
            return JSONResponse(status_code=404, content={
                "error": f"No se encontró imagen para estacionamiento {estacionamiento_id}"
            })
        
        print(f"✅ Usando imagen: {image_path}")
        
        image_cv2 = cv2.imread(image_path)
        if image_cv2 is None:
            return JSONResponse(status_code=400, content={"error": "No se pudo leer la imagen"})
        
        # IMPORTANTE: Pasar el ID para cargar bounding boxes específicos
        print(f"\n📄 Llamando process_detection con ID: {estacionamiento_id}")
        result = process_detection(image_cv2, estacionamiento_id)
        
        print(f"\n{'='*60}")
        print(f"📊 RESUMEN - Estacionamiento {estacionamiento_id}")
        print(f"   Imagen: {image_path}")
        print(f"   Zonas: {result['total_zones']} total, {result['occupied_count']} ocupadas")
        print(f"   Ocupación: {result['occupancy_rate']:.1f}%")
        print(f"{'='*60}\n")
        
        return {
            "success": True,
            "estacionamiento_id": estacionamiento_id,
            "image_annotated": result["data_uri"],
            "total": result["total_zones"],
            "occupied": result["occupied_count"],
            "available": result["available_count"],
            "occupancy_rate": round(result["occupancy_rate"], 1),
            "statistics": {
                "total": result["total_zones"],
                "occupied": result["occupied_count"],
                "available": result["available_count"],
                "occupancy_rate": round(result["occupancy_rate"], 1)
            },
            "detection_info": {
                "objects_detected": len(result["all_objects"]),
                "color_analysis_zones": len(result["color_detections"]),
                "detection_method": "simplified_any_object",
                "image_source": image_path,
                "bounding_boxes_id": estacionamiento_id  # Para debug
            },
            "zones": result["zone_details"]
        }
    except Exception as e:
        print(f"❌ Error en /detect/estacionamiento/: {str(e)}")
        traceback.print_exc()
        return JSONResponse(status_code=500, content={
            "success": False,
            "error": str(e),
            "estacionamiento_id": estacionamiento_id
        })


@app.get("/")
async def root():
    return {"message": "Sistema de Detección de Estacionamiento"}


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "model_loaded": os.path.exists(model_path),
        "detection_mode": "any_object",
        "features": ["object_detection", "color_analysis", "dual_confirmation"]
    }


# ============================================
# MONTAR ARCHIVOS ESTÁTICOS CON CORS
# ============================================
app.mount("/videos", StaticFiles(directory="videos"), name="videos")


# Endpoint para verificar si existe video
@app.get("/check-video/{estacionamiento_id}")
async def check_video_exists(estacionamiento_id: int):
    """Verifica si existe un video para el estacionamiento"""
    video_extensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm']
    
    for ext in video_extensions:
        video_path = f"videos/{estacionamiento_id}{ext}"
        if os.path.exists(video_path):
            return {
                "exists": True,
                "path": video_path,
                "url": f"/videos/{estacionamiento_id}{ext}",
                "extension": ext
            }
    
    return {
        "exists": False,
        "path": None,
        "url": None
    }


# Endpoint para obtener video directamente con CORS explícito
@app.get("/video/{estacionamiento_id}")
async def get_video(estacionamiento_id: int):
    """Retorna el archivo de video si existe CON HEADERS CORS"""
    video_extensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm']
    
    for ext in video_extensions:
        video_path = f"videos/{estacionamiento_id}{ext}"
        if os.path.exists(video_path):
            media_types = {
                '.mp4': 'video/mp4',
                '.avi': 'video/x-msvideo',
                '.mov': 'video/quicktime',
                '.mkv': 'video/x-matroska',
                '.webm': 'video/webm'
            }
            
            # Crear respuesta con headers CORS
            response = FileResponse(
                video_path, 
                media_type=media_types.get(ext, 'video/mp4'),
                filename=f"{estacionamiento_id}{ext}"
            )
            
            # Agregar headers CORS manualmente
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = '*'
            
            return response
    
    return JSONResponse(
        status_code=404, 
        content={"error": f"Video no encontrado para estacionamiento {estacionamiento_id}"}
    )


# ============================================
# WebSocket para streaming de video
# ============================================
@app.websocket("/ws/detect/stream/{estacionamiento_id}")
async def websocket_video_stream(websocket: WebSocket, estacionamiento_id: int):
    """WebSocket para análisis en tiempo real de frames de video"""
    await websocket.accept()
    print(f"✅ WebSocket conectado - Estacionamiento {estacionamiento_id}")

    parking_zones = load_parking_zones(estacionamiento_id)
    jpeg_quality = 70
    display_width = None
    
    try:
        while True:
            data = await websocket.receive()

            if data.get("type") == "websocket.receive":
                message_text = data.get("text")
                message_bytes = data.get("bytes")

                # Configuración opcional
                if message_text:
                    message = json.loads(message_text)
                    if message.get("type") == "config":
                        if "jpeg_quality" in message:
                            jpeg_quality = int(message["jpeg_quality"])
                        if "display_width" in message:
                            display_width = message["display_width"]
                        continue

                    if message.get("type") != "frame":
                        continue

                    img_data = message.get("data")
                    if not img_data:
                        continue
                    if ',' in img_data:
                        img_data = img_data.split(',')[1]
                    img_bytes = base64.b64decode(img_data)
                    nparr = np.frombuffer(img_bytes, np.uint8)
                    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

                elif message_bytes:
                    nparr = np.frombuffer(message_bytes, np.uint8)
                    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                else:
                    continue
                
                if frame is None:
                    await websocket.send_json({"error": "Frame inválido"})
                    continue
                
                # Detectar con YOLO
                results = MODEL(frame, **DETECTION_CONFIG)
                
                all_objects = []
                if results[0].boxes is not None:
                    for box in results[0].boxes:
                        class_id = int(box.cls[0])
                        confidence = float(box.conf[0])
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        bbox_area = (x2 - x1) * (y2 - y1)
                        class_name = MODEL.names[class_id]
                        
                        is_significant, _ = is_significant_object(confidence, bbox_area, (x1, y1, x2, y2))
                        
                        if is_significant:
                            all_objects.append({
                                'center': (float((x1+x2)/2), float((y1+y2)/2)),
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
                
                # Anotar imagen
                annotated = draw_simple_annotations(
                    frame, parking_zones, occupied_zones, zone_details, all_objects
                )

                # Reducir tamaño de salida si se solicita (solo para envío)
                if display_width and isinstance(display_width, int) and display_width > 0:
                    h, w = annotated.shape[:2]
                    if w > display_width:
                        scale = display_width / w
                        new_w = display_width
                        new_h = int(h * scale)
                        annotated = cv2.resize(annotated, (new_w, new_h))
                
                # Codificar resultado
                _, buffer = cv2.imencode('.jpg', annotated, [cv2.IMWRITE_JPEG_QUALITY, jpeg_quality])
                annotated_b64 = base64.b64encode(buffer).decode()
                
                # Enviar resultado
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
        print(f"WebSocket desconectado - Estacionamiento {estacionamiento_id}")
    except Exception as e:
        print(f"❌ Error WebSocket: {e}")
        traceback.print_exc()
        await websocket.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
