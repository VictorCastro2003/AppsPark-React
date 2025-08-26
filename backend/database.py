from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv
import os

# Carga las variables del archivo .env
load_dotenv()

# URL de conexión a MySQL
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL no está configurada en el archivo .env")

# Crear el motor de la base de datos
engine = create_engine(DATABASE_URL, echo=True)  # echo=True para debug

# Crear una sesión
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base para los modelos
Base = declarative_base()

# Función para obtener la sesión de la base de datos
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Función para crear todas las tablas
def create_tables():
    Base.metadata.create_all(bind=engine)