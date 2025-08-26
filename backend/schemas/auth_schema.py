from pydantic import BaseModel, EmailStr

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UsuarioResponse(BaseModel):
    id: int
    nombre: str
    email: EmailStr
    rol: str

class AuthResponse(BaseModel):
    usuario: UsuarioResponse
    token: str
class TokenResponse(BaseModel):
    access_token: str
    token_type: str