# backend/app/detection.py
from pathlib import Path
import tempfile
from typing import Dict, Any

# Si ya tienes una función detect_by_path(path) en tu proyecto,
# cámbiala por la import siguiente (descomenta).
try:
    # from app.your_existing_module import detect_by_path as _existing_detect
    # def detect_from_path(path: str, **kwargs) -> Dict[str, Any]:
    #     return _existing_detect(path, **kwargs)
    raise ImportError("Use fallback")
except Exception:
    # Fallback minimal usando ultralytics (si tienes instalado).
    # Ajusta conforme a tu pipeline real (zonas, color, etc.).
    try:
        from ultralytics import YOLO
        MODEL_PATH = str(Path(__file__).resolve().parents[1] / "yolo11n.pt")
        model = YOLO(MODEL_PATH)
    except Exception:
        model = None

    def detect_from_path(path: str, resize_width: int = None) -> Dict[str, Any]:
        """
        Retorna un dict con keys:
          - detections: lista (puedes extender)
          - annotated_path: path a imagen anotada
        """
        if model is None:
            # si no hay ultralytics, devolvemos placeholder
            annotated_tmp = Path(tempfile.gettempdir()) / (Path(path).stem + "_annotated.jpg")
            # simplemente copia la imagen original a annotated_tmp
            with open(path, "rb") as src, open(annotated_tmp, "wb") as dst:
                dst.write(src.read())
            return {"detections": [], "annotated_path": str(annotated_tmp)}

        # correr detección
        results = model(path)  # Ajusta parámetros (conf, imgsz) según necesites
        # Guardar imagen anotada — la API concreta puede variar por versión
        annotated_tmp = Path(tempfile.gettempdir()) / (Path(path).stem + "_annotated.jpg")
        try:
            # algunos resultados permiten results[0].plot() o save()
            im = results[0].plot()  # puede ser un PIL.Image o similar en algunas versiones
            im.save(annotated_tmp)
        except Exception:
            # fallback: si la lib tiene save
            try:
                results.save(annotated_tmp)
            except Exception:
                # copia original
                with open(path, "rb") as src, open(annotated_tmp, "wb") as dst:
                    dst.write(src.read())

        # parse detections (ejemplo simplificado)
        detections = []
        try:
            for r in results:
                # r.boxes puede cambiar; este es un ejemplo
                for b in getattr(r, "boxes", []):
                    detections.append({
                        "xyxy": getattr(b, "xyxy", []).tolist() if hasattr(b, "xyxy") else None,
                        "conf": float(getattr(b, "conf", 0)),
                        "class": int(getattr(b, "cls", -1))
                    })
        except Exception:
            detections = []

        return {"detections": detections, "annotated_path": str(annotated_tmp)}
