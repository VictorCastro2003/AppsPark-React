from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from ultralytics import YOLO
import numpy as np
import cv2
import base64
import traceback
import os
import json
import torch
from fastapi import Body


app = FastAPI(
    title="Sistema de Detección de Estacionamiento",
    description="API para detección de espacios de estacionamiento usando YOLO",
    version="1.0.0"
)

# CORS config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("=== IMPORTANDO ROUTERS ===")

try:
    from routers.usuario_router import router as usuario_router
    app.include_router(usuario_router)
    print("✓ Router usuarios importado exitosamente")
except ImportError as e:
    print(f"✗ Error importando usuario_router: {e}")
    print("   - Verificar que existe routers/usuario_router.py")
    print("   - Verificar que el router está definido correctamente")

try:
    from routers.auth_router import router as auth_router
    app.include_router(auth_router)
    print(f"✓ Rutas disponibles: {app.routes}")
    print("✓ Router auth importado exitosamente")
except ImportError as e:
    print(f"✗ Error importando auth_router: {e}")
    print("   - Verificar que existe routers/auth_router.py")
    print("   - Verificar que el router está definido correctamente")

try:
    from routers.estacionamiento_router import router as estacionamiento_router
    app.include_router(estacionamiento_router)
    print("✓ Router estacionamiento importado exitosamente")
except ImportError as e:
    print(f"✗ Error importando estacionamiento_router: {e}")
    print("   - Verificar que existe routers/estacionamiento_router.py")
    print("   - Verificar que el router está definido correctamente")

try:
    from routers.reserva_router import router as reserva_router
    app.include_router(reserva_router)
    print("✓ Router reserva importado exitosamente")
except ImportError as e:
    print(f"✗ Error importando reserva_router: {e}")
    print("   - Verificar que existe routers/reserva_router.py")
    print("   - Verificar que el router está definido correctamente")

print("=== FIN IMPORTACIÓN ROUTERS ===\n")

# Verifica que el modelo existe
model_path = "yolo11n.pt"
if not os.path.exists(model_path):
    raise FileNotFoundError(f"Modelo no encontrado: {model_path}")

# Configuración de detección simplificada
DETECTION_CONFIG = {"conf": 0.2, "iou": 0.4}  # Más sensible para detectar cualquier objeto

# Función para leer el archivo JSON de bounding boxes
def load_parking_zones(json_file="bounding_boxes.json"):
    try:
        with open(json_file, 'r') as f:
            data = json.load(f)
            return data
    except FileNotFoundError:
        print(f"Archivo {json_file} no encontrado. Usando zonas por defecto.")
        # Zonas por defecto para 8 cajones
        return [
            {"points": [[30, 200], [120, 200], [120, 310], [30, 310]]},    # Cajón 1
            {"points": [[140, 200], [230, 200], [230, 310], [140, 310]]},  # Cajón 2 
            {"points": [[250, 200], [340, 200], [340, 310], [250, 310]]},  # Cajón 3
            {"points": [[360, 200], [450, 200], [450, 310], [360, 310]]},  # Cajón 4
            {"points": [[30, 330], [120, 330], [120, 440], [30, 440]]},    # Cajón 5
            {"points": [[140, 330], [230, 330], [230, 440], [140, 440]]},  # Cajón 6
            {"points": [[250, 330], [340, 330], [340, 440], [250, 440]]},  # Cajón 7
            {"points": [[360, 330], [450, 330], [450, 440], [360, 440]]},  # Cajón 8
        ]

def point_in_polygon(point, polygon):
    """Verifica si un punto está dentro de un polígono usando ray casting"""
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
    """Calcula el porcentaje de superposición entre un bbox y un polígono"""
    try:
        x1, y1, x2, y2 = bbox
        
        # Crear puntos del rectángulo
        rect_points = np.array([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], dtype=np.float32)
        polygon_points = np.array(polygon, dtype=np.float32)
        
        # Calcular intersección usando OpenCV
        retval, intersection = cv2.intersectConvexConvex(rect_points, polygon_points)
        
        if retval > 0 and intersection is not None and len(intersection) > 2:
            overlap_area = cv2.contourArea(intersection)
            bbox_area = (x2 - x1) * (y2 - y1)
            
            # Retornar el porcentaje de superposición del bbox
            if bbox_area > 0:
                return overlap_area / bbox_area
        
        return 0.0
    except Exception as e:
        print(f"Error calculando overlap: {e}")
        return 0.0

def is_significant_object(confidence, bbox_area, bbox):
    """Determina si un objeto es lo suficientemente significativo para considerarlo"""
    
    # Confianza mínima muy baja para capturar más objetos
    if confidence < 0.15:
        return False, f"Confianza muy baja: {confidence:.3f}"
    
    # Área mínima muy pequeña para no filtrar objetos válidos
    min_area = 500  # Reducido significativamente
    if bbox_area < min_area:
        return False, f"Área muy pequeña: {bbox_area:.0f} < {min_area}"
    
    # Verificar que no sea demasiado alargado (posible línea o borde)
    x1, y1, x2, y2 = bbox
    width = x2 - x1
    height = y2 - y1
    aspect_ratio = width / height if height > 0 else 0
    
    # Rango muy amplio de aspect ratio
    if not (0.2 <= aspect_ratio <= 8.0):
        return False, f"Aspecto extremo: {aspect_ratio:.2f}"
    
    return True, "Objeto significativo detectado"

def detect_by_color_analysis(image_cv2, parking_zones):
    """Detección complementaria basada en análisis de color mejorado"""
    # Convertir a diferentes espacios de color para mejor análisis
    hsv = cv2.cvtColor(image_cv2, cv2.COLOR_BGR2HSV)
    lab = cv2.cvtColor(image_cv2, cv2.COLOR_BGR2LAB)
    gray = cv2.cvtColor(image_cv2, cv2.COLOR_BGR2GRAY)
    
    potential_objects = []
    
    for i, zone in enumerate(parking_zones):
        # Crear máscara de la zona
        mask = np.zeros(image_cv2.shape[:2], dtype=np.uint8)
        points = np.array(zone['points'], np.int32)
        cv2.fillPoly(mask, [points], 255)
        
        # Extraer región de la zona
        zone_gray = cv2.bitwise_and(gray, gray, mask=mask)
        zone_hsv = cv2.bitwise_and(hsv, hsv, mask=mask)
        
        # Análisis 1: Variabilidad de intensidad (objetos vs asfalto vacío)
        masked_pixels = gray[mask > 0]
        if len(masked_pixels) > 0:
            intensity_std = np.std(masked_pixels)
            intensity_mean = np.mean(masked_pixels)
            
            # El asfalto vacío tiende a ser más uniforme
            # Los objetos (coches) tienen más variabilidad
            variability_score = intensity_std / 255.0
            
            # Análisis 2: Detección de bordes
            edges = cv2.Canny(zone_gray, 50, 150)
            edge_pixels = cv2.countNonZero(edges)
            zone_area = cv2.countNonZero(mask)
            edge_density = edge_pixels / zone_area if zone_area > 0 else 0
            
            # Análisis 3: Saturación de color (coches suelen tener colores más saturados)
            zone_hsv_masked = zone_hsv[mask > 0]
            if len(zone_hsv_masked) > 0:
                saturation_mean = np.mean(zone_hsv_masked[:, 1])
                saturation_score = saturation_mean / 255.0
            else:
                saturation_score = 0
            
            # Combinar todas las métricas
            combined_score = (
                variability_score * 0.4 +      # 40% variabilidad de intensidad
                edge_density * 0.4 +           # 40% densidad de bordes
                saturation_score * 0.2         # 20% saturación de color
            )
            
            # Umbral para considerar que hay un objeto
            if combined_score > 0.15:  # Umbral ajustable
                confidence_score = min(combined_score * 2.0, 0.9)
                potential_objects.append({
                    'zone_id': i,
                    'combined_score': combined_score,
                    'confidence_score': confidence_score,
                    'variability_score': variability_score,
                    'edge_density': edge_density,
                    'saturation_score': saturation_score
                })
                
                print(f"  Zona #{i+1} - Análisis de color:")
                print(f"    Variabilidad: {variability_score:.3f}")
                print(f"    Densidad bordes: {edge_density:.3f}")
                print(f"    Saturación: {saturation_score:.3f}")
                print(f"    Score combinado: {combined_score:.3f}")
    
    return potential_objects

def analyze_parking_zones_simple(all_objects, color_detections, parking_zones):
    """Analiza cada zona de estacionamiento de forma simplificada"""
    occupied_zones = set()
    zone_details = []
    
    print(f"\n--- ANÁLISIS SIMPLIFICADO DE ZONAS ---")
    
    for zone_idx, zone in enumerate(parking_zones):
        is_occupied = False
        occupying_object = None
        best_overlap = 0
        detection_method = "none"
        confidence_score = 0.0
        
        # 1. Verificar cualquier objeto detectado por YOLO
        for obj in all_objects:
            center_in_zone = point_in_polygon(obj['center'], zone['points'])
            overlap_percentage = calculate_overlap_percentage(obj['bbox'], zone['points'])
            
            # Criterios más flexibles - cualquier overlap significativo
            if center_in_zone or overlap_percentage > 0.15:  # Solo 15% de overlap
                if overlap_percentage > best_overlap:
                    is_occupied = True
                    occupying_object = obj
                    best_overlap = overlap_percentage
                    detection_method = "object_detection"
                    confidence_score = obj['confidence']
        
        # 2. Verificar detección por análisis de color
        color_confidence = 0.0
        for cd in color_detections:
            if cd['zone_id'] == zone_idx:
                color_confidence = cd['confidence_score']
                
                # Usar color si no hay detección YOLO o para confirmar
                if not is_occupied and cd['confidence_score'] > 0.3:
                    is_occupied = True
                    detection_method = "color_analysis"
                    confidence_score = cd['confidence_score']
                    occupying_object = {
                        'class': 'object_by_analysis',
                        'confidence': cd['confidence_score'],
                        'method': 'color_analysis'
                    }
                elif is_occupied and cd['confidence_score'] > 0.2:
                    detection_method = "dual_detection"  # Confirmación dual
                break
        
        # 3. Registrar resultado
        if is_occupied:
            occupied_zones.add(zone_idx)
        
        # 4. Logging
        status = "OCUPADA" if is_occupied else "LIBRE"
        method_str = f" [{detection_method.upper()}]"
        confidence_str = f" (conf: {confidence_score:.3f})" if confidence_score > 0 else ""
        
        print(f"Zona #{zone_idx+1}: {status}{confidence_str}{method_str}")
        
        if is_occupied and occupying_object:
            if detection_method == "object_detection" or detection_method == "dual_detection":
                print(f"  -> Overlap: {best_overlap:.3f}")
            if color_confidence > 0:
                print(f"  -> Análisis color: {color_confidence:.3f}")
        
        # 5. Guardar detalles
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
    """Dibuja anotaciones simplificadas en la imagen sin texto"""
    annotated_image = image.copy()
    
    # 1. Dibujar bounding boxes de objetos detectados (sin etiquetas)
    for obj in all_objects:
        x1, y1, x2, y2 = obj['bbox']
        cv2.rectangle(annotated_image, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 255), 2)
    
    # 2. Dibujar zonas de estacionamiento
    for i, zone in enumerate(parking_zones):
        points = np.array(zone['points'], np.int32)
        points = points.reshape((-1, 1, 2))
        
        # Color según estado
        color = (0, 0, 255) if i in occupied_zones else (0, 255, 0)
        
        # Dibujar contorno
        cv2.polylines(annotated_image, [points], True, color, 4)
        
        # Rellenar con transparencia
        overlay = annotated_image.copy()
        cv2.fillPoly(overlay, [points], color)
        cv2.addWeighted(overlay, 0.3, annotated_image, 0.7, 0, annotated_image)
    
    return annotated_image

@app.post("/detect/")
async def detect_parking(file: UploadFile = File(...)):
    try:
        # Leer y decodificar imagen
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        image_cv2 = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image_cv2 is None:
            return JSONResponse(status_code=400, content={"error": "No se pudo decodificar la imagen"})

        # Cargar modelo y zonas
        model = YOLO(model_path)
        parking_zones = load_parking_zones()
        
        print(f"\n=== DETECCIÓN SIMPLIFICADA DE ESTACIONAMIENTO ===")
        print(f"Dimensiones imagen: {image_cv2.shape}")
        print(f"Zonas a analizar: {len(parking_zones)}")
        
        # === FASE 1: DETECCIÓN DE CUALQUIER OBJETO ===
        print(f"\n1. Detectando objetos con YOLO...")
        results = model(image_cv2, **DETECTION_CONFIG)
        
        all_objects = []
        if results[0].boxes is not None:
            for box in results[0].boxes:
                class_id = int(box.cls[0])
                confidence = float(box.conf[0])
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                bbox_area = (x2 - x1) * (y2 - y1)
                class_name = model.names[class_id]
                
                # Verificar si es un objeto significativo (sin filtrar por clase)
                is_significant, reason = is_significant_object(confidence, bbox_area, (x1, y1, x2, y2))
                
                if is_significant:
                    center_x = (x1 + x2) / 2
                    center_y = (y1 + y2) / 2
                    
                    all_objects.append({
                        'center': (float(center_x), float(center_y)),
                        'bbox': (float(x1), float(y1), float(x2), float(y2)),
                        'class': class_name,
                        'confidence': float(confidence),
                        'reason': reason
                    })
                    print(f"✓ OBJETO DETECTADO: {class_name} (conf: {confidence:.3f}, área: {bbox_area:.0f})")
                else:
                    print(f"✗ Objeto rechazado: {class_name} (conf: {confidence:.3f}) - {reason}")
        
        print(f"Total objetos válidos: {len(all_objects)}")
        
        # === FASE 2: ANÁLISIS COMPLEMENTARIO POR COLOR ===
        print(f"\n2. Análisis complementario por color...")
        color_detections = detect_by_color_analysis(image_cv2, parking_zones)
        print(f"Zonas con actividad detectada: {len(color_detections)}")
        
        # === FASE 3: ANÁLISIS SIMPLIFICADO DE ZONAS ===
        print(f"\n3. Analizando ocupación de zonas...")
        occupied_zones, zone_details = analyze_parking_zones_simple(all_objects, color_detections, parking_zones)
        
        # === FASE 4: GENERAR IMAGEN ANOTADA ===
        annotated_image = draw_simple_annotations(image_cv2, parking_zones, occupied_zones, zone_details, all_objects)
        
        # === FASE 5: CALCULAR ESTADÍSTICAS ===
        total_zones = len(parking_zones)
        occupied_count = len(occupied_zones)
        available_count = total_zones - occupied_count
        occupancy_rate = (occupied_count / total_zones) * 100 if total_zones > 0 else 0
        
        # Codificar imagen resultado
        _, buffer = cv2.imencode(".jpg", annotated_image)
        encoded_image = base64.b64encode(buffer).decode("utf-8")
        data_uri = f"data:image/jpeg;base64,{encoded_image}"
        
        # === RESUMEN FINAL ===
        print(f"\n=== RESUMEN FINAL ===")
        print(f"Total zonas: {total_zones}")
        print(f"Zonas ocupadas: {occupied_count}")
        print(f"Zonas disponibles: {available_count}")
        print(f"Tasa de ocupación: {occupancy_rate:.1f}%")
        print(f"Objetos detectados: {len(all_objects)}")
        print(f"Análisis de color: {len(color_detections)} zonas")
        print("================================\n")

        return {
            "success": True,
            "image_annotated": data_uri,
            "total": int(total_zones),
            "occupied": int(occupied_count),
            "available": int(available_count),
            "occupancy_rate": round(occupancy_rate, 1),
            "statistics": {
                "total": int(total_zones),
                "occupied": int(occupied_count),
                "available": int(available_count),
                "occupancy_rate": round(occupancy_rate, 1)
            },
            "detection_info": {
                "objects_detected": int(len(all_objects)),
                "color_analysis_zones": int(len(color_detections)),
                "detection_method": "simplified_any_object"
            },
            "zones": zone_details
        }

    except Exception as e:
        print(f"Error en detección: {str(e)}")
        traceback.print_exc()
        return JSONResponse(
            status_code=500, 
            content={"success": False, "error": str(e)}
        )

@app.post("/detect/estacionamiento/")
async def detect_estacionamiento(estacionamiento_id: int = Body(...)):
    try:
        # Buscar la imagen del estacionamiento
        image_path = f"images/estacionamientos/{estacionamiento_id}.jpg"
        
        # Si no existe, usar una imagen por defecto
        if not os.path.exists(image_path):
            image_path = "images/default_parking.jpg"
            
        # Verificar que la ruta exista (incluyendo la imagen por defecto)
        if not os.path.exists(image_path):
            return JSONResponse(status_code=404, content={
                "error": f"No se encontró imagen para estacionamiento {estacionamiento_id} ni imagen por defecto"
            })

        # Leer la imagen desde disco
        image_cv2 = cv2.imread(image_path)
        if image_cv2 is None:
            return JSONResponse(status_code=400, content={"error": "No se pudo leer la imagen"})

        # Cargar modelo y zonas
        model = YOLO(model_path)
        parking_zones = load_parking_zones()

        print(f"\n=== DETECCIÓN DESDE RUTA ===")
        print(f"Estacionamiento ID: {estacionamiento_id}")
        print(f"Ruta: {image_path}")
        print(f"Dimensiones: {image_cv2.shape}")
        print(f"Zonas a analizar: {len(parking_zones)}")

        # === FASE 1: DETECCIÓN DE CUALQUIER OBJETO ===
        print(f"\n1. Detectando objetos con YOLO...")
        results = model(image_cv2, **DETECTION_CONFIG)
        
        all_objects = []
        if results[0].boxes is not None:
            for box in results[0].boxes:
                class_id = int(box.cls[0])
                confidence = float(box.conf[0])
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                bbox_area = (x2 - x1) * (y2 - y1)
                class_name = model.names[class_id]
                
                # Verificar si es un objeto significativo (sin filtrar por clase)
                is_significant, reason = is_significant_object(confidence, bbox_area, (x1, y1, x2, y2))
                
                if is_significant:
                    center_x = (x1 + x2) / 2
                    center_y = (y1 + y2) / 2
                    
                    all_objects.append({
                        'center': (float(center_x), float(center_y)),
                        'bbox': (float(x1), float(y1), float(x2), float(y2)),
                        'class': class_name,
                        'confidence': float(confidence),
                        'reason': reason
                    })
                    print(f"✅ OBJETO DETECTADO: {class_name} (conf: {confidence:.3f}, área: {bbox_area:.0f})")
                else:
                    print(f"❌ Objeto rechazado: {class_name} (conf: {confidence:.3f}) - {reason}")
        
        print(f"Total objetos válidos: {len(all_objects)}")

        # === FASE 2: ANÁLISIS COMPLEMENTARIO POR COLOR ===
        print(f"\n2. Análisis complementario por color...")
        color_detections = detect_by_color_analysis(image_cv2, parking_zones)
        print(f"Zonas con actividad detectada: {len(color_detections)}")

        # === FASE 3: ANÁLISIS SIMPLIFICADO DE ZONAS ===
        print(f"\n3. Analizando ocupación de zonas...")
        occupied_zones, zone_details = analyze_parking_zones_simple(all_objects, color_detections, parking_zones)

        # === FASE 4: GENERAR IMAGEN ANOTADA ===
        annotated_image = draw_simple_annotations(image_cv2, parking_zones, occupied_zones, zone_details, all_objects)

        # === FASE 5: CALCULAR ESTADÍSTICAS ===
        total_zones = len(parking_zones)
        occupied_count = len(occupied_zones)
        available_count = total_zones - occupied_count
        occupancy_rate = (occupied_count / total_zones) * 100 if total_zones > 0 else 0

        # Codificar imagen resultado
        _, buffer = cv2.imencode(".jpg", annotated_image)
        encoded_image = base64.b64encode(buffer).decode("utf-8")
        data_uri = f"data:image/jpeg;base64,{encoded_image}"

        # === RESUMEN FINAL ===
        print(f"\n=== RESUMEN FINAL ===")
        print(f"Estacionamiento ID: {estacionamiento_id}")
        print(f"Total zonas: {total_zones}")
        print(f"Zonas ocupadas: {occupied_count}")
        print(f"Zonas disponibles: {available_count}")
        print(f"Tasa de ocupación: {occupancy_rate:.1f}%")
        print(f"Objetos detectados: {len(all_objects)}")
        print(f"Análisis de color: {len(color_detections)} zonas")
        print("================================\n")

        return {
            "success": True,
            "estacionamiento_id": int(estacionamiento_id),
            "image_annotated": data_uri,
            "total": int(total_zones),
            "occupied": int(occupied_count),
            "available": int(available_count),
            "occupancy_rate": round(occupancy_rate, 1),
            "statistics": {
                "total": int(total_zones),
                "occupied": int(occupied_count),
                "available": int(available_count),
                "occupancy_rate": round(occupancy_rate, 1)
            },
            "detection_info": {
                "objects_detected": int(len(all_objects)),
                "color_analysis_zones": int(len(color_detections)),
                "detection_method": "simplified_any_object",
                "image_source": image_path
            },
            "zones": zone_details
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
    return {"message": "Sistema de Detección de Estacionamiento - Versión Simplificada"}

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "model_loaded": os.path.exists(model_path),
        "detection_mode": "any_object",
        "features": ["object_detection", "color_analysis", "dual_confirmation"]
    }
    

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)