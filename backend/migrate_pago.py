"""
Script de migracion para agregar columnas de pago a la tabla reservas.
Ejecutar UNA SOLA VEZ: python migrate_pago.py
"""
import sys
from database import engine
from sqlalchemy import text, inspect

def column_exists(inspector, table, column):
    cols = [c['name'] for c in inspector.get_columns(table)]
    return column in cols

inspector = inspect(engine)

migrations = [
    ("pago_estado", "ALTER TABLE reservas ADD COLUMN pago_estado VARCHAR(30) NULL DEFAULT NULL"),
    ("pago_id", "ALTER TABLE reservas ADD COLUMN pago_id VARCHAR(100) NULL"),
    ("idempotency_key", "ALTER TABLE reservas ADD COLUMN idempotency_key VARCHAR(64) NULL"),
]

with engine.connect() as conn:
    for col_name, sql in migrations:
        if column_exists(inspector, 'reservas', col_name):
            print(f"[SKIP] Columna '{col_name}' ya existe.")
            continue
        try:
            conn.execute(text(sql))
            conn.commit()
            print(f"[OK] Columna '{col_name}' agregada.")
        except Exception as e:
            print(f"[ERR] {col_name}: {e}")

    # Agregar indice unico para idempotency_key si no existe
    try:
        conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_reservas_idempotency "
            "ON reservas (idempotency_key)"
        ))
        conn.commit()
        print("[OK] Indice unico idempotency_key creado.")
    except Exception as e:
        print(f"[SKIP] Indice: {e}")

print("\nMigracion completada.")
