/**
 * PaymentModal.jsx
 * Modal de pago con PayPal para reservas de estacionamiento.
 *
 * Características:
 *  - Idempotencia: genera un idempotency_key único por sesión de pago;
 *    si el usuario recarga o vuelve a abrir, se reutiliza la misma clave.
 *  - Desactivación del botón: mientras se procesa el pago el botón se deshabilita
 *    y muestra un spinner para evitar dobles llamadas a la API.
 *  - PayPal JS SDK: carga el SDK dinámicamente y renderiza el botón oficial.
 */

import React, { useEffect, useRef, useState, useCallback } from "react";

const API_URL = "http://localhost:8000";

// ─── ID de tu aplicación PayPal Sandbox ─────────────────────────────────────
// Para producción cambia esta clave y también la variable PAYPAL_BASE_URL del backend
const PAYPAL_CLIENT_ID =
  "AW-fpEEGCXQdJCbNpcMKn8f71JnlN_LR7GWSz2gTP-xm01GXXYOBK-599RVA1Uxv3-Se5gIvahII3vJY";

// Genera un UUID v4 simple para idempotencia
function generateIdempotencyKey() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export default function PaymentModal({ reservaId, monto, moneda = "MXN", onSuccess, onClose }) {
  const paypalContainerRef = useRef(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  // Idempotency key: persiste por reserva en sessionStorage para sobrevivir recargas
  const idempotencyKeyRef = useRef(
    sessionStorage.getItem(`ikey_${reservaId}`) ||
      (() => {
        const k = generateIdempotencyKey();
        sessionStorage.setItem(`ikey_${reservaId}`, k);
        return k;
      })()
  );

  // ─── Cargar PayPal SDK ───────────────────────────────────────────────────
  useEffect(() => {
    // Evitar cargar el script más de una vez
    if (document.getElementById("paypal-sdk")) {
      setSdkReady(true);
      return;
    }
    const script = document.createElement("script");
    script.id = "paypal-sdk";
    script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=${moneda}&intent=capture&locale=es_MX`;
    script.async = true;
    script.onload = () => setSdkReady(true);
    script.onerror = () => setError("No se pudo cargar el SDK de PayPal. Verifica tu conexión.");
    document.body.appendChild(script);
  }, [moneda]);

  // ─── Renderizar botón PayPal cuando el SDK esté listo ────────────────────
  const renderPaypalButton = useCallback(() => {
    if (!window.paypal || !paypalContainerRef.current || processing || success) return;

    // Limpiar instancias previas
    if (paypalContainerRef.current) {
      paypalContainerRef.current.innerHTML = "";
    }

    window.paypal
      .Buttons({
        style: {
          layout: "vertical",
          color: "gold",
          shape: "rect",
          label: "pay",
          height: 48,
        },
        // Deshabilitar el botón durante el procesamiento se hace envolviendo
        // onApprove/onError con el estado `processing`.
        createOrder: async () => {
          setProcessing(true);
          setError(null);
          setStatusMsg("Creando orden de pago...");
          try {
            const resp = await fetch(`${API_URL}/pagos/crear-orden`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                reserva_id: reservaId,
                idempotency_key: idempotencyKeyRef.current,
              }),
            });
            const data = await resp.json();
            if (!resp.ok) {
              throw new Error(data.detail || "Error creando orden PayPal");
            }
            setStatusMsg("Esperando aprobación en PayPal...");
            return data.paypal_order_id;
          } catch (err) {
            setError(err.message);
            setProcessing(false);
            setStatusMsg("");
            throw err; // PayPal cierra el popup al lanzar error
          }
        },

        onApprove: async (data) => {
          setStatusMsg("Capturando pago...");
          try {
            const resp = await fetch(`${API_URL}/pagos/capturar`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                paypal_order_id: data.orderID,
                reserva_id: reservaId,
              }),
            });
            const result = await resp.json();
            if (!resp.ok) {
              throw new Error(result.detail || "Error capturando pago");
            }
            // Limpiar la clave de idempotencia usada
            sessionStorage.removeItem(`ikey_${reservaId}`);
            setSuccess(true);
            setStatusMsg("✅ ¡Pago completado exitosamente!");
            if (onSuccess) onSuccess(result);
          } catch (err) {
            setError(err.message);
          } finally {
            setProcessing(false);
          }
        },

        onCancel: () => {
          setProcessing(false);
          setStatusMsg("Pago cancelado. Puedes intentarlo de nuevo.");
        },

        onError: (err) => {
          console.error("PayPal Error:", err);
          setError("Ocurrió un error con PayPal. Por favor intenta de nuevo.");
          setProcessing(false);
          setStatusMsg("");
        },
      })
      .render(paypalContainerRef.current);
  }, [reservaId, processing, success, onSuccess]);

  useEffect(() => {
    if (sdkReady && !success) {
      renderPaypalButton();
    }
  }, [sdkReady, success, renderPaypalButton]);

  // ─── UI ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div
        className="modal-backdrop-custom"
        onClick={!processing ? onClose : undefined}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          zIndex: 1050,
          backdropFilter: "blur(3px)",
        }}
      />
      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-modal-title"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 1051,
          width: "100%",
          maxWidth: "460px",
          padding: "0 16px",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: "20px",
            boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              background: "linear-gradient(135deg, #003087 0%, #009cde 100%)",
              padding: "20px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* PayPal logo SVG simplificado */}
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42c-.024.143-.049.29-.077.44-1.012 5.196-4.488 7.03-8.919 7.03H10.09c-.524 0-.967.38-1.049.9L7.732 21.96a.64.64 0 0 1-.632.74h-2.35a.641.641 0 0 1-.634-.741l.44-2.787 1.79-11.373h-.001l.09-.567c.082-.52.527-.9 1.05-.9h4.22c4.427 0 7.89-1.836 8.902-7.03.024-.15.048-.298.073-.444.3-1.705.113-2.77-.545-3.764z" fill="#ffffff"/>
              </svg>
              <span
                style={{
                  color: "#fff",
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  fontFamily: "'Inter', sans-serif",
                }}
                id="payment-modal-title"
              >
                Pago con PayPal
              </span>
            </div>
            {!processing && (
              <button
                onClick={onClose}
                aria-label="Cerrar modal de pago"
                style={{
                  background: "rgba(255,255,255,0.2)",
                  border: "none",
                  color: "#fff",
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  cursor: "pointer",
                  fontSize: "1rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.2s",
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Body */}
          <div style={{ padding: "24px" }}>
            {/* Resumen de pago */}
            <div
              style={{
                background: "linear-gradient(135deg, #f0f7ff, #e8f4fd)",
                borderRadius: "12px",
                padding: "16px 20px",
                marginBottom: "20px",
                border: "1px solid #cce0f5",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "#64748b", fontSize: "0.875rem" }}>Reserva</span>
                <span style={{ color: "#1e293b", fontWeight: 600, fontSize: "0.875rem" }}>
                  #{reservaId}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#475569", fontWeight: 600 }}>Total a pagar</span>
                <span
                  style={{
                    color: "#003087",
                    fontWeight: 800,
                    fontSize: "1.5rem",
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  ${Number(monto).toFixed(2)}{" "}
                  <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>{moneda}</span>
                </span>
              </div>
            </div>

            {/* Mensaje de estado */}
            {statusMsg && !error && !success && (
              <div
                style={{
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: "10px",
                  padding: "10px 14px",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  color: "#1d4ed8",
                  fontSize: "0.875rem",
                }}
              >
                {processing && (
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      border: "2px solid #bfdbfe",
                      borderTopColor: "#2563eb",
                      borderRadius: "50%",
                      display: "inline-block",
                      animation: "spin 0.8s linear infinite",
                      flexShrink: 0,
                    }}
                  />
                )}
                {statusMsg}
              </div>
            )}

            {/* Error */}
            {error && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "10px",
                  padding: "10px 14px",
                  marginBottom: "16px",
                  color: "#dc2626",
                  fontSize: "0.875rem",
                }}
              >
                ❌ {error}
              </div>
            )}

            {/* Éxito */}
            {success ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: "3rem", marginBottom: 12 }}>✅</div>
                <p
                  style={{
                    color: "#16a34a",
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    marginBottom: 4,
                  }}
                >
                  ¡Pago completado!
                </p>
                <p style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: 20 }}>
                  Tu reserva #{reservaId} ha sido pagada exitosamente.
                </p>
                <button
                  onClick={onClose}
                  style={{
                    background: "linear-gradient(135deg, #16a34a, #22c55e)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "10px",
                    padding: "10px 28px",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: "0.95rem",
                  }}
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <>
                {/* Contenedor del botón PayPal */}
                {!sdkReady ? (
                  <div style={{ textAlign: "center", padding: "20px 0", color: "#64748b" }}>
                    <span
                      style={{
                        display: "inline-block",
                        width: 24,
                        height: 24,
                        border: "3px solid #e2e8f0",
                        borderTopColor: "#003087",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                      }}
                    />
                    <p style={{ marginTop: 8, fontSize: "0.875rem" }}>Cargando PayPal...</p>
                  </div>
                ) : (
                  <div
                    style={{
                      opacity: processing ? 0.6 : 1,
                      pointerEvents: processing ? "none" : "auto",
                      transition: "opacity 0.2s",
                    }}
                  >
                    <div ref={paypalContainerRef} id={`paypal-btn-${reservaId}`} />
                  </div>
                )}

                {/* Nota de seguridad */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 16,
                    color: "#94a3b8",
                    fontSize: "0.75rem",
                    justifyContent: "center",
                  }}
                >
                  🔒 Pago seguro procesado por PayPal. AppsPark no almacena datos de tu tarjeta.
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
