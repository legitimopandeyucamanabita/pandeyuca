import { useEffect, useRef, useState, useCallback } from "react";
import { ref, onValue, set, update, runTransaction } from "firebase/database";
import { db } from "@/lib/firebase";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const CLAVE_ADMIN = "panyuca.2026";
const WHATS = "https://wa.me/593984637626";
const WHATS_PEDIDO =
  "https://wa.me/593984637626?text=Hola%20quiero%20hacer%20un%20pedido%20(Pide%20y%20Retira)";
const DEFAULT_POS = { lat: -1.024, lon: -79.46 };

interface RouteData {
  lat: number;
  lon: number;
  estado: "activo" | "inactivo";
}

function Toast({ message }: { message: string }) {
  return (
    <div className="toast-msg">
      {message}
    </div>
  );
}

export default function Home() {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const watchIdRef = useRef<number | null>(null);

  const [routeActive, setRouteActive] = useState(false);
  const [ultimaPos, setUltimaPos] = useState(DEFAULT_POS);
  const [likes, setLikes] = useState(0);
  const [fbStatus, setFbStatus] = useState<"connecting" | "ok" | "error">("connecting");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [adminPass, setAdminPass] = useState("");
  const [toast, setToast] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [showLlegar, setShowLlegar] = useState(false);
  const [mapSub, setMapSub] = useState("Mostrando última ubicación registrada");

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2400);
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, { zoomControl: false }).setView(
      [DEFAULT_POS.lat, DEFAULT_POS.lon],
      13
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(map);
    const marker = L.marker([DEFAULT_POS.lat, DEFAULT_POS.lon]).addTo(map);
    marker.bindPopup("📍 Última ubicación registrada").openPopup();
    mapRef.current = map;
    markerRef.current = marker;
    setTimeout(() => map.invalidateSize(), 350);
  }, []);

  useEffect(() => {
    try {
      const routeRef = ref(db, "ubicacion_ruta");
      const unsub = onValue(routeRef, (snap) => {
        const d = snap.val() as RouteData | null;
        setFbStatus("ok");
        if (d && d.estado === "activo") {
          const pos = { lat: d.lat, lon: d.lon };
          setUltimaPos(pos);
          setRouteActive(true);
          setShowLlegar(true);
          setMapSub("Ruta activa • ubicación en tiempo real");
          if (markerRef.current) {
            markerRef.current.setLatLng([pos.lat, pos.lon]);
            markerRef.current.bindPopup("🚚 ¡Estamos aquí!").openPopup();
          }
          if (mapRef.current) mapRef.current.flyTo([pos.lat, pos.lon], 16, { duration: 0.8 });
        } else {
          setRouteActive(false);
          setShowLlegar(false);
          setMapSub("Ruta cerrada • mostrando última ubicación");
          if (markerRef.current) markerRef.current.bindPopup("🚚 Ruta cerrada");
        }
      });
      return () => unsub();
    } catch {
      setFbStatus("error");
    }
  }, []);

  useEffect(() => {
    const likesRef = ref(db, "likes");
    const unsub = onValue(likesRef, (snap) => {
      setLikes(snap.val() || 0);
    });
    return () => unsub();
  }, []);

  function centrar() {
    mapRef.current?.flyTo([ultimaPos.lat, ultimaPos.lon], 17, { duration: 0.7 });
  }

  function repararMapa() {
    mapRef.current?.invalidateSize();
    showToast("Mapa ajustado ✅");
  }

  function abrirMaps() {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${ultimaPos.lat},${ultimaPos.lon}`,
      "_blank",
      "noopener"
    );
  }

  async function darLike() {
    try {
      await runTransaction(ref(db, "likes"), (v) => (v || 0) + 1);
      showToast("¡Gracias por tu apoyo! ❤️");
    } catch {
      const local = Number(localStorage.getItem("likes_local") || 0) + 1;
      localStorage.setItem("likes_local", String(local));
      setLikes(local);
      showToast("Like guardado (modo local) ❤️");
    }
  }

  function checkClave() {
    if (adminPass !== CLAVE_ADMIN) {
      showToast("Clave incorrecta ❌");
      return false;
    }
    return true;
  }

  function iniciarRuta() {
    if (!checkClave()) return;
    if (!navigator.geolocation) {
      showToast("Tu navegador no soporta GPS.");
      return;
    }
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        set(ref(db, "ubicacion_ruta"), {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          estado: "activo",
        });
      },
      (err) => {
        showToast("Error GPS: " + err.message);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );
    showToast("Ruta iniciada ✅");
  }

  function cerrarRuta() {
    if (!checkClave()) return;
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    update(ref(db, "ubicacion_ruta"), { estado: "inactivo" });
    showToast("Ruta cerrada ⛔");
  }

  return (
    <div className="app-root">
      <link
        href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&display=swap"
        rel="stylesheet"
      />

      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="logo">PY</div>
            <div style={{ minWidth: 0 }}>
              <h1>Legítimo Pan de Yuca Manabita</h1>
              <small>Artesanal • Fresco • Calidad garantizada</small>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div className="status-pill" title="Estado de la ruta">
              <span className={`dot ${routeActive ? "dot-ok" : "dot-bad"}`} />
              <span>{routeActive ? "Ruta activa" : "Ruta cerrada"}</span>
            </div>
            <button className="btn" onClick={() => setDrawerOpen(true)}>
              🛡️ Admin
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="wrap">
        {/* Left column */}
        <section className="card">
          {/* Hero */}
          <div className="hero">
            <div>
              <h2>Pan de yuca auténtico, sabor manabita</h2>
              <p>
                Ubica la ruta en tiempo real cuando esté activa, y haz tu pedido por WhatsApp en
                segundos. Diseño limpio, confiable y listo para vender.
              </p>
              <div className="trust">
                <div className="badge">✅ Higiene & calidad</div>
                <div className="badge">📍 Ruta en vivo</div>
                <div className="badge">💬 Pedido rápido</div>
                <div className="badge">🔒 Compra segura</div>
              </div>
              <div className="hero-actions">
                <a className="btn btn-primary" href={WHATS_PEDIDO} target="_blank" rel="noopener">
                  🛍️ Pide y retira
                </a>
                <button className="btn" onClick={() => window.open(WHATS, "_blank", "noopener")}>
                  💬 WhatsApp
                </button>
                <button className="btn" onClick={darLike}>
                  ❤️ Me gusta <span>{likes}</span>
                </button>
              </div>
            </div>

            <div className="hero-media">
              <div>
                <div className="big">Promo destacada</div>
                <div className="sub">Perfecta para impulsar ventas y fidelizar clientes.</div>
              </div>
              <div className="promo" style={{ margin: 0 }}>
                <div className="t">⚡ PROMO $5.00</div>
                <div className="opt">🎁 +1 funda GRATIS</div>
                <div className="opt">🥤 o +2 yogurts GRATIS</div>
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="map-header">
            <div className="map-title">
              📍 Ubicación de la ruta
              <span>{mapSub}</span>
            </div>
            <button className="btn" onClick={repararMapa}>
              🔄 Ajustar mapa
            </button>
          </div>

          <div className="map-box">
            <div ref={mapContainerRef} id="mapa" />
            <div className="map-controls">
              {showLlegar && (
                <button className="btn btn-primary" onClick={abrirMaps}>
                  🧭 Cómo llegar
                </button>
              )}
              <button className="btn" onClick={centrar}>
                🎯 Centrar
              </button>
            </div>
          </div>

          <div className="hint">
            💡 Tip: activa la ruta desde el panel Admin para compartir tu ubicación en tiempo real.
          </div>
        </section>

        {/* Right column */}
        <aside className="side">
          <section className="card price-card">
            <h3>Precios</h3>
            <div className="line">
              <span>🥖 Funda (4 panes)</span>
              <b>$1.00</b>
            </div>
            <div className="line">
              <span>🥤 Yogurt</span>
              <b>$0.75</b>
            </div>
            <div className="line">
              <span>🔥 4 panes + yogurt</span>
              <b>$1.50</b>
            </div>
            <div className="admin-info" style={{ marginTop: 12 }}>
              <b>Confianza:</b> muestra la ruta en vivo cuando está activa. Tus clientes ven un
              estado claro y profesional.
            </div>
          </section>

          <section className="card">
            <div className="mini-actions">
              <button
                className="btn btn-accent"
                onClick={() => showToast("Promo: 5 fundas por $5.00 + eliges regalo 🎁")}
              >
                ⭐ Ver promo
              </button>
              <button
                className="btn"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(WHATS_PEDIDO);
                    showToast("Link de WhatsApp copiado ✅");
                  } catch {
                    showToast("No pude copiar (tu navegador lo bloqueó).");
                  }
                }}
              >
                🔗 Copiar link WhatsApp
              </button>
            </div>
          </section>
        </aside>
      </main>

      <footer>
        © {new Date().getFullYear()} Legítimo Pan de Yuca Manabita — Hecho para vender: confianza,
        claridad y ruta en vivo.
      </footer>

      {/* Admin Drawer */}
      {drawerOpen && (
        <div className="drawer-overlay" onClick={() => setDrawerOpen(false)} />
      )}
      <aside className={`drawer ${drawerOpen ? "open" : ""}`}>
        <div className="drawer-header">
          <b>Panel de Administrador</b>
          <button className="btn" onClick={() => setDrawerOpen(false)}>
            ✕
          </button>
        </div>
        <div className="drawer-body">
          <div className="admin-info">
            <b>Nota:</b> Para activar GPS, abre con <b>https://</b> o en hosting <b>HTTPS</b>.
            <div className="small" style={{ marginTop: 6 }}>
              Estado Firebase:{" "}
              {fbStatus === "ok" ? "conectado ✅" : fbStatus === "error" ? "error ❌" : "conectando…"}
            </div>
          </div>

          <div className="field">
            <label>Clave de administrador</label>
            <input
              type="password"
              placeholder="Ingresa tu clave"
              value={adminPass}
              onChange={(e) => setAdminPass(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <div className="admin-actions">
            <button className="btn btn-success" onClick={iniciarRuta}>
              ✅ Iniciar ruta
            </button>
            <button className="btn btn-danger" onClick={cerrarRuta}>
              ⛔ Cerrar ruta
            </button>
          </div>

          <div className="admin-info">
            <b>Consejo seguridad:</b> la clave en frontend no es 100% segura. Si quieres nivel PRO,
            te configuro Firebase Rules + login real.
          </div>
        </div>
      </aside>

      {/* Toast */}
      <div className={`toast ${toastVisible ? "show" : ""}`}>{toast}</div>
    </div>
  );
}
