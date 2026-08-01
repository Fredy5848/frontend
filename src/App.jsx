import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Cliente, Ticket, SistemaSoporte } from './models';

function App() {
  // ── ESTADO DE BARRA LATERAL ──
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Estados de autenticación y vista
  const [session, setSession] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');

  // Estado de pestaña Admin ('activos' vs 'archivero')
  const [adminTab, setAdminTab] = useState('activos');

  // Estados del Formulario de Ticket
  const [formData, setFormData] = useState({
    client_name: '',
    client_email: '',
    incident_type: 'Falla Técnica',
    description: ''
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState([]);

  // Estado para el modal de acciones
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    title: '',
    subtitle: '',
    placeholder: '',
    isRequired: false,
    onConfirm: null
  });
  const [modalInputValue, setModalInputValue] = useState('');
  const [modalError, setModalError] = useState('');

  // Verificación de sesión activa en Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Cargar tickets cuando hay sesión
  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('id', { ascending: false });

      if (error) throw error;

      const ticketsInstanciados = (data || []).map(t => {
        const cliente = new Cliente(t.client_name, t.client_email);
        return new Ticket(
          t.id, 
          cliente, 
          t.incident_type, 
          t.description, 
          t.status, 
          t.tecnico_asignado, 
          t.historial
        );
      });

      setTickets(ticketsInstanciados);
    } catch (err) {
      console.error('Error al cargar solicitudes:', err.message);
    }
  };

  useEffect(() => {
    if (session) {
      fetchTickets();
    }
  }, [session]);

  // Manejadores del Formulario de Cliente
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const historialInicial = SistemaSoporte.agregarHistorial('', 'Ticket creado por el usuario');

    try {
      const { error } = await supabase.from('tickets').insert([{
        client_name: formData.client_name,
        client_email: formData.client_email,
        incident_type: formData.incident_type,
        description: formData.description,
        status: 'Nuevo',
        tecnico_asignado: 'Sin Asignar',
        historial: historialInicial
      }]);

      if (error) throw error;

      setMessage('Solicitud registrada correctamente. El equipo técnico revisará el caso.');
      setFormData({ client_name: '', client_email: '', incident_type: 'Falla Técnica', description: '' });
    } catch (error) {
      setMessage(`Error en el registro: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Autenticación Admin
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: loginData.email,
      password: loginData.password,
    });

    setLoading(false);
    if (error) {
      setLoginError('Credenciales inválidas. Verifique el correo y la contraseña.');
    } else {
      setShowLoginModal(false);
      setLoginData({ email: '', password: '' });
      setIsSidebarOpen(false); // Cierra menú al iniciar sesión
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsSidebarOpen(false);
  };

  // Manejo de Modal de Acción
  const openActionModal = ({ title, subtitle, placeholder, isRequired, onConfirm }) => {
    setModalInputValue('');
    setModalError('');
    setActionModal({
      isOpen: true,
      title,
      subtitle,
      placeholder,
      isRequired,
      onConfirm
    });
  };

  const closeActionModal = () => {
    setActionModal({ isOpen: false, title: '', subtitle: '', placeholder: '', isRequired: false, onConfirm: null });
    setModalInputValue('');
    setModalError('');
  };

  const handleModalSubmit = (e) => {
    e.preventDefault();
    if (actionModal.isRequired && !modalInputValue.trim()) {
      setModalError('Este campo es obligatorio para completar la acción.');
      return;
    }
    if (actionModal.onConfirm) {
      actionModal.onConfirm(modalInputValue.trim());
    }
    closeActionModal();
  };

  // Cambiar Estado
  const handleStatusChange = (ticket, newStatus) => {
    const isResuelto = newStatus === 'Resuelto';

    openActionModal({
      title: isResuelto ? 'Resolver Solicitud' : 'Actualizar Estado',
      subtitle: isResuelto 
        ? `Ingrese el detalle de la resolución para el Ticket #${ticket.id}:`
        : `Comentario opcional para el cambio a estado "${newStatus}":`,
      placeholder: isResuelto ? 'Descripción de la solución aplicada...' : 'Notas sobre el cambio de estado...',
      isRequired: isResuelto,
      onConfirm: async (comentario) => {
        const textoHistorial = comentario
          ? `Estado [${newStatus}] -> "${comentario}"` 
          : `Estado actualizado a: ${newStatus}`;

        const nuevoHistorial = SistemaSoporte.agregarHistorial(ticket.historial, textoHistorial);

        try {
          const { error } = await supabase
            .from('tickets')
            .update({ status: newStatus, historial: nuevoHistorial })
            .eq('id', ticket.id);

          if (error) throw error;
          fetchTickets();
        } catch (error) {
          alert(`Error al actualizar el estado: ${error.message}`);
        }
      }
    });
  };

  // Agregar Comentario
  const handleAddComment = (ticket) => {
    openActionModal({
      title: `Agregar Nota - Ticket #${ticket.id}`,
      subtitle: 'Ingrese una observación o actualización interna:',
      placeholder: 'Escriba la nota aquí...',
      isRequired: true,
      onConfirm: async (comentario) => {
        const nuevoHistorial = SistemaSoporte.agregarHistorial(ticket.historial, `Nota: "${comentario}"`);

        try {
          const { error } = await supabase
            .from('tickets')
            .update({ historial: nuevoHistorial })
            .eq('id', ticket.id);

          if (error) throw error;
          fetchTickets();
        } catch (error) {
          alert(`Error al guardar la nota: ${error.message}`);
        }
      }
    });
  };

  // Soft Delete (Archivar)
  const handleSoftDelete = async (ticket) => {
    if (!window.confirm(`¿Mover el Ticket #${ticket.id} al archivero?`)) return;

    const nuevoHistorial = SistemaSoporte.agregarHistorial(ticket.historial, 'Registro movido al archivero');

    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status: 'Eliminado', historial: nuevoHistorial })
        .eq('id', ticket.id);

      if (error) throw error;
      fetchTickets();
    } catch (error) {
      alert(`Error al archivar: ${error.message}`);
    }
  };

  // Restaurar Ticket
  const handleRestore = async (ticket) => {
    const nuevoHistorial = SistemaSoporte.agregarHistorial(ticket.historial, 'Registro restaurado a En Proceso');
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status: 'En Proceso', historial: nuevoHistorial })
        .eq('id', ticket.id);

      if (error) throw error;
      fetchTickets();
    } catch (error) {
      alert(`Error al restaurar: ${error.message}`);
    }
  };

  // Borrado Permanente
  const handlePermanentDelete = async (id) => {
    if (!window.confirm(`¿Confirma la eliminación permanente del Ticket #${id}? Esta acción no se puede deshacer.`)) return;
    try {
      const { error } = await supabase.from('tickets').delete().eq('id', id);
      if (error) throw error;
      fetchTickets();
    } catch (error) {
      alert(`Error al eliminar el registro: ${error.message}`);
    }
  };

  // Asignar Técnico
  const handleTecnicoChange = async (ticket, nuevoTecnico) => {
    const nuevoHistorial = SistemaSoporte.agregarHistorial(ticket.historial, `Técnico asignado: ${nuevoTecnico}`);
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ tecnico_asignado: nuevoTecnico, historial: nuevoHistorial })
        .eq('id', ticket.id);

      if (error) throw error;
      fetchTickets();
    } catch (error) {
      alert(`Error al asignar técnico: ${error.message}`);
    }
  };

  // Filtros
  const ticketsActivos = tickets.filter(t => t.estado !== 'Resuelto' && t.estado !== 'Eliminado');
  const ticketsArchivados = tickets.filter(t => t.estado === 'Resuelto' || t.estado === 'Eliminado');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#121212', color: '#e0e0e0', fontFamily: 'Segoe UI, Helvetica, Arial, sans-serif', position: 'relative' }}>
      
      {/* ── BOTÓN FLOTANTE HAMBURGUESA ── */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        style={{
          position: 'fixed',
          top: '15px',
          left: '15px',
          zIndex: 1100,
          padding: '8px 14px',
          backgroundColor: '#1a1a1a',
          color: '#ffffff',
          border: '1px solid #3d3d3d',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: '500',
          boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}
      >
        {isSidebarOpen ? '✕ Cerrar' : '☰ Menú'}
      </button>

      {/* ── FONDO OSCURO OVERLAY ── */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            zIndex: 999
          }}
        />
      )}

      {/* ── BARRA LATERAL DESLIZABLE ── */}
      <aside 
        style={{ 
          width: '250px', 
          backgroundColor: '#1a1a1a', 
          borderRight: '1px solid #2d2d2d', 
          padding: '70px 20px 25px 20px', 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'space-between',
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 1000,
          transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s ease-in-out',
          boxShadow: isSidebarOpen ? '4px 0 15px rgba(0,0,0,0.5)' : 'none'
        }}
      >
        <div>
          <h2 style={{ color: '#ffffff', fontSize: '18px', fontWeight: '600', margin: '0 0 20px 0', letterSpacing: '0.5px' }}>Soporte Técnico</h2>
          <hr style={{ borderColor: '#2d2d2d', marginBottom: '20px' }} />
          
          <p style={{ color: '#888888', fontSize: '13px', lineHeight: '1.5' }}>
            Portal interno de gestión e incidencias técnicas.
          </p>
        </div>

        <div>
          {!session ? (
            <button
              onClick={() => setShowLoginModal(true)}
              style={{
                width: '100%', padding: '10px', backgroundColor: '#262626', color: '#ffffff',
                border: '1px solid #3d3d3d', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500'
              }}
            >
              Iniciar Sesión Admin
            </button>
          ) : (
            <div>
              <p style={{ fontSize: '12px', color: '#888888', marginBottom: '10px' }}>Usuario activo:<br /><strong style={{ color: '#ffffff' }}>{session.user.email}</strong></p>
              <button
                onClick={handleLogout}
                style={{
                  width: '100%', padding: '8px', backgroundColor: '#8c2525', color: '#ffffff',
                  border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px'
                }}
              >
                Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── CONTENIDO PRINCIPAL ── */}
      <main style={{ flex: 1, padding: '40px', paddingTop: '60px' }}>
        {!session ? (
          /* VISTA PÚBLICA: FORMULARIO */
          <div style={{ maxWidth: '520px', margin: '0 auto', backgroundColor: '#1a1a1a', padding: '30px', borderRadius: '8px', border: '1px solid #2d2d2d' }}>
            <h2 style={{ color: '#ffffff', marginTop: 0, fontSize: '20px', fontWeight: '600' }}>Nueva Solicitud de Soporte</h2>
            <p style={{ color: '#888888', fontSize: '13px', marginBottom: '25px' }}>Complete el formulario para registrar su requerimiento.</p>

            {message && (
              <div style={{ padding: '12px', marginBottom: '20px', backgroundColor: message.includes('correctamente') ? '#18381e' : '#3d1a1d', color: message.includes('correctamente') ? '#a3e0b1' : '#f0a3a8', borderRadius: '4px', fontSize: '13px' }}>
                {message}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#cccccc' }}>Nombre completo:</label>
                <input type="text" name="client_name" value={formData.client_name} onChange={handleChange} required style={{ width: '100%', padding: '9px', borderRadius: '4px', border: '1px solid #333333', backgroundColor: '#121212', color: '#ffffff', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#cccccc' }}>Correo electrónico:</label>
                <input type="email" name="client_email" value={formData.client_email} onChange={handleChange} required style={{ width: '100%', padding: '9px', borderRadius: '4px', border: '1px solid #333333', backgroundColor: '#121212', color: '#ffffff', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#cccccc' }}>Categoría del problema:</label>
                <select name="incident_type" value={formData.incident_type} onChange={handleChange} style={{ width: '100%', padding: '9px', borderRadius: '4px', border: '1px solid #333333', backgroundColor: '#121212', color: '#ffffff', fontSize: '14px', boxSizing: 'border-box' }}>
                  <option value="Falla Técnica">Falla Técnica / Hardware</option>
                  <option value="Solicitud de Software">Solicitud de Software</option>
                  <option value="Problema de Red">Red / Conectividad</option>
                  <option value="Otro">Otro requerimiento</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#cccccc' }}>Descripción detallada:</label>
                <textarea name="description" value={formData.description} onChange={handleChange} required rows="4" style={{ width: '100%', padding: '9px', borderRadius: '4px', border: '1px solid #333333', backgroundColor: '#121212', color: '#ffffff', fontSize: '14px', boxSizing: 'border-box', resize: 'vertical' }} />
              </div>

              <button type="submit" disabled={loading} style={{ width: '100%', padding: '11px', backgroundColor: '#2e6da4', color: '#ffffff', border: 'none', borderRadius: '4px', fontWeight: '500', fontSize: '14px', cursor: 'pointer' }}>
                {loading ? 'Registrando...' : 'Enviar Solicitud'}
              </button>
            </form>
          </div>
        ) : (
          /* VISTA PRIVADA: PANEL ADMIN */
          <div style={{ backgroundColor: '#1a1a1a', padding: '25px', borderRadius: '8px', border: '1px solid #2d2d2d' }}>
            
            {/* Pestañas de Navegación */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #2d2d2d', paddingBottom: '15px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setAdminTab('activos')}
                  style={{
                    padding: '8px 16px', borderRadius: '4px', border: '1px solid',
                    borderColor: adminTab === 'activos' ? '#3b82f6' : '#333333',
                    backgroundColor: adminTab === 'activos' ? '#1e293b' : '#121212',
                    color: adminTab === 'activos' ? '#60a5fa' : '#888888',
                    fontSize: '13px', cursor: 'pointer'
                  }}
                >
                  Tickets Activos ({ticketsActivos.length})
                </button>

                <button
                  onClick={() => setAdminTab('archivero')}
                  style={{
                    padding: '8px 16px', borderRadius: '4px', border: '1px solid',
                    borderColor: adminTab === 'archivero' ? '#3b82f6' : '#333333',
                    backgroundColor: adminTab === 'archivero' ? '#1e293b' : '#121212',
                    color: adminTab === 'archivero' ? '#60a5fa' : '#888888',
                    fontSize: '13px', cursor: 'pointer'
                  }}
                >
                  Archivero ({ticketsArchivados.length})
                </button>
              </div>

              <button onClick={fetchTickets} style={{ backgroundColor: '#262626', color: '#cccccc', border: '1px solid #333333', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Actualizar</button>
            </div>

            {/* TABLA: ACTIVOS */}
            {adminTab === 'activos' && (
              <div>
                {ticketsActivos.length === 0 ? (
                  <p style={{ color: '#888888', textAlign: 'center', padding: '30px 0', fontSize: '14px' }}>No hay registros pendientes por atender.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #333333', color: '#888888' }}>
                        <th style={{ padding: '10px' }}>ID</th>
                        <th style={{ padding: '10px' }}>Usuario</th>
                        <th style={{ padding: '10px' }}>Categoría / Detalle</th>
                        <th style={{ padding: '10px' }}>Técnico</th>
                        <th style={{ padding: '10px' }}>Estado</th>
                        <th style={{ padding: '10px' }}>Historial</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ticketsActivos.map((t) => (
                        <tr key={t.id} style={{ borderBottom: '1px solid #262626' }}>
                          <td style={{ padding: '10px', color: '#60a5fa', fontWeight: '600' }}>#{t.id}</td>
                          <td style={{ padding: '10px' }}><strong>{t.cliente.nombre}</strong><br /><span style={{ color: '#777777', fontSize: '11px' }}>{t.cliente.email}</span></td>
                          <td style={{ padding: '10px' }}><strong>{t.tipo}</strong><br /><span style={{ color: '#aaaaaa' }}>{t.descripcion}</span></td>
                          <td style={{ padding: '10px' }}>
                            <select value={t.tecnico || 'Sin Asignar'} onChange={(e) => handleTecnicoChange(t, e.target.value)} style={{ backgroundColor: '#121212', color: '#ffffff', padding: '5px', borderRadius: '4px', border: '1px solid #333333', fontSize: '12px' }}>
                              <option value="Sin Asignar">Sin Asignar</option>
                              <option value="Carlos Pérez">Carlos Pérez</option>
                              <option value="Ana Gómez">Ana Gómez</option>
                              <option value="Roberto Díaz">Roberto Díaz</option>
                            </select>
                          </td>
                          <td style={{ padding: '10px' }}>
                            <select value={t.estado || 'Nuevo'} onChange={(e) => handleStatusChange(t, e.target.value)} style={{ backgroundColor: '#121212', color: '#ffffff', padding: '5px', borderRadius: '4px', border: '1px solid #333333', fontSize: '12px' }}>
                              <option value="Nuevo">Nuevo</option>
                              <option value="En Proceso">En Proceso</option>
                              <option value="Resuelto">Resuelto</option>
                            </select>
                          </td>
                          <td style={{ padding: '10px', fontSize: '11px', color: '#999999', maxWidth: '200px', lineHeight: '1.4' }}>{t.historial}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <button onClick={() => handleAddComment(t)} style={{ backgroundColor: '#262626', color: '#cccccc', border: '1px solid #333333', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>Nota</button>
                              <button onClick={() => handleSoftDelete(t)} style={{ backgroundColor: '#3d1a1d', color: '#f0a3a8', border: '1px solid #5c282c', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>Archivar</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* TABLA: ARCHIVERO */}
            {adminTab === 'archivero' && (
              <div>
                {ticketsArchivados.length === 0 ? (
                  <p style={{ color: '#888888', textAlign: 'center', padding: '30px 0', fontSize: '14px' }}>El archivero no contiene registros.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #333333', color: '#888888' }}>
                        <th style={{ padding: '10px' }}>ID</th>
                        <th style={{ padding: '10px' }}>Usuario</th>
                        <th style={{ padding: '10px' }}>Detalle</th>
                        <th style={{ padding: '10px' }}>Estado Final</th>
                        <th style={{ padding: '10px' }}>Historial / Registro</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ticketsArchivados.map((t) => {
                        const isEliminado = t.estado === 'Eliminado';
                        return (
                          <tr key={t.id} style={{ borderBottom: '1px solid #262626', backgroundColor: '#141414' }}>
                            <td style={{ padding: '10px', color: '#666666', fontWeight: '600' }}>#{t.id}</td>
                            <td style={{ padding: '10px' }}><strong>{t.cliente.nombre}</strong><br /><span style={{ color: '#777777', fontSize: '11px' }}>{t.cliente.email}</span></td>
                            <td style={{ padding: '10px', color: '#888888' }}><strong>{t.tipo}</strong><br />{t.descripcion}</td>
                            <td style={{ padding: '10px' }}>
                              <span style={{ 
                                padding: '3px 7px', borderRadius: '3px', fontSize: '11px', fontWeight: '500',
                                backgroundColor: isEliminado ? '#3d1a1d' : '#18381e',
                                color: isEliminado ? '#f0a3a8' : '#a3e0b1'
                              }}>
                                {isEliminado ? 'Eliminado' : 'Resuelto'}
                              </span>
                            </td>
                            <td style={{ padding: '10px', fontSize: '11px', color: '#888888', maxWidth: '220px', lineHeight: '1.4' }}>{t.historial}</td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                <button 
                                  onClick={() => handleRestore(t)} 
                                  style={{ backgroundColor: '#262626', color: '#cccccc', border: '1px solid #333333', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                                >
                                  Restaurar
                                </button>
                                <button 
                                  onClick={() => handlePermanentDelete(t.id)} 
                                  style={{ backgroundColor: '#5c1d24', color: '#ffffff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                                >
                                  Eliminar
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

          </div>
        )}
      </main>

      {/* ── MODAL DE ACCIONES Y NOTAS ── */}
      {actionModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
          <div style={{ backgroundColor: '#1a1a1a', padding: '24px', borderRadius: '8px', border: '1px solid #333333', width: '420px', position: 'relative' }}>
            <button onClick={closeActionModal} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#888888', fontSize: '16px', cursor: 'pointer' }}>✕</button>
            
            <h3 style={{ color: '#ffffff', marginTop: 0, marginBottom: '8px', fontSize: '16px', fontWeight: '600' }}>{actionModal.title}</h3>
            <p style={{ color: '#888888', fontSize: '13px', lineHeight: '1.4', marginBottom: '16px' }}>{actionModal.subtitle}</p>

            {modalError && (
              <div style={{ padding: '8px 10px', backgroundColor: '#3d1a1d', color: '#f0a3a8', borderRadius: '4px', marginBottom: '12px', fontSize: '12px' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleModalSubmit}>
              <textarea
                autoFocus
                rows="4"
                value={modalInputValue}
                onChange={(e) => setModalInputValue(e.target.value)}
                placeholder={actionModal.placeholder}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '4px',
                  border: '1px solid #333333',
                  backgroundColor: '#121212',
                  color: '#ffffff',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  marginBottom: '16px',
                  outline: 'none'
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={closeActionModal}
                  style={{ padding: '8px 14px', backgroundColor: '#262626', color: '#cccccc', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 14px', backgroundColor: '#2e6da4', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL DE AUTENTICACIÓN ── */}
      {showLoginModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: '#1a1a1a', padding: '25px', borderRadius: '8px', border: '1px solid #333333', width: '360px', position: 'relative' }}>
            <button onClick={() => setShowLoginModal(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#888888', fontSize: '16px', cursor: 'pointer' }}>✕</button>
            
            <h3 style={{ color: '#ffffff', marginTop: 0, textAlign: 'center', fontSize: '16px', fontWeight: '600' }}>Autenticación de Administrador</h3>
            <p style={{ color: '#888888', fontSize: '12px', textAlign: 'center', marginBottom: '20px' }}>Ingrese sus credenciales para acceder al sistema</p>

            {loginError && (
              <div style={{ padding: '8px 10px', backgroundColor: '#3d1a1d', color: '#f0a3a8', borderRadius: '4px', marginBottom: '12px', fontSize: '12px', textAlign: 'center' }}>
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#cccccc' }}>Correo electrónico:</label>
                <input type="email" required value={loginData.email} onChange={(e) => setLoginData({ ...loginData, email: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #333333', backgroundColor: '#121212', color: '#ffffff', fontSize: '13px', boxSizing: 'border-box' }} placeholder="admin@empresa.com" />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#cccccc' }}>Contraseña:</label>
                <input type="password" required value={loginData.password} onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #333333', backgroundColor: '#121212', color: '#ffffff', fontSize: '13px', boxSizing: 'border-box' }} placeholder="••••••••" />
              </div>

              <button type="submit" disabled={loading} style={{ width: '100%', padding: '10px', backgroundColor: '#2e6da4', color: '#ffffff', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
                {loading ? 'Autenticando...' : 'Iniciar Sesión'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;