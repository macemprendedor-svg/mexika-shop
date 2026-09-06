export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: "60px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1>Sistema de pedidos COD — mexika-shop</h1>
      <p>Panel interno del sistema de confirmación de pedidos, filtro antifraude y detección de rechazos falsos.</p>
      <ul>
        <li>
          <a href="/panel">Panel de zonas bloqueadas y configuración</a>
        </li>
        <li>
          <a href="/api/shopify/health">Estado de la conexión con Shopify</a>
        </li>
      </ul>
    </main>
  );
}
