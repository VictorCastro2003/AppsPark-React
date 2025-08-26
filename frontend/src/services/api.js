// src/services/api.js
import axios from "axios";

const API_URL = "http://localhost:8000"; // ajusta según tu backend

const api = axios.create({
  baseURL: API_URL,
});

// Interceptor para añadir el token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
