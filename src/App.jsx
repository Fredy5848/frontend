import { useState } from 'react';

function App() {
  // Estado para controlar si el sidebar está abierto (true) o cerrado (false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative' }}>
      
      {/* 1. BOTÓN PARA ABRIR / CERRAR */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        style={{
          position: 'fixed',
          top: '15px',
          left: isSidebarOpen ? '260px' : '15px', // Se mueve junto con la barra
          zIndex: 1000,
          backgroundColor: '#2a2a2a',
          color: '#ffffff',
          border: '1px solid #444',
          borderRadius: '6px',
          padding: '8px 12px',
          cursor: 'pointer',
          transition: 'left 0.3s ease', // Animación suave del botón
        }}
      >
        {isSidebarOpen ? '◀' : '☰'}
      </button>

      {/* 2. TU BARRA LATERAL (SIDEBAR) */}
      <aside
        style={{
          width: '250px',
          height: '100vh',
          backgroundColor: '#181818',
          position: 'fixed',
          top: 0,
          left: 0,
          padding: '20px',
          boxSizing: 'border-box',
          zIndex: 999,
          // ANIMACIÓN CLAVE:
          transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s ease-in-out', // Hace que se deslice suavemente
        }}
      >
        <h2>Soporte Técnico</h2>
        <hr style={{ borderColor: '#333' }} />
        <p style={{ color: '#888', fontSize: '14px' }}>
          Portal interno de gestión e incidencias técnicas.
        </p>

        {/* Botón inferior */}
        <div style={{ position: 'absolute', bottom: '20px', left: '20px', right: '20px' }}>
          <button style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#2a2a2a',
            color: '#fff',
            border: '1px solid #444',
            borderRadius: '6px'
          }}>
            Iniciar Sesión Admin
          </button>
        </div>
      </aside>

      {/* 3. CONTENIDO PRINCIPAL */}
      <main
        style={{
          flex: 1,
          marginLeft: isSidebarOpen ? '250px' : '0px', // Ajusta el espacio si la barra está abierta
          transition: 'margin-left 0.3s ease-in-out',
          padding: '20px',
        }}
      >
        {/* Aquí va el formulario o contenido de tu app */}
      </main>

    </div>
  );
}