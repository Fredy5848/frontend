// 1. Clase Cliente (Representa a la persona que reporta el problema)
export class Cliente {
  constructor(nombre, email) {
    this.nombre = nombre;
    this.email = email;
  }
}

// 2. Clase Tecnico (Representa al personal de soporte técnico)
export class Tecnico {
  constructor(nombre, especialidad = 'Soporte General') {
    this.nombre = nombre;
    this.especialidad = especialidad;
  }
}

// 3. Clase Ticket (Entidad principal de la solicitud)
export class Ticket {
  constructor(id, cliente, tipo, descripcion, estado = 'Nuevo', tecnico = 'Sin Asignar', historial = '') {
    this.id = id;
    this.cliente = cliente;
    this.tipo = tipo;
    this.descripcion = descripcion;
    this.estado = estado;
    this.tecnico = tecnico;
    this.historial = historial;
  }

  asignarTecnico(nombreTecnico) {
    this.tecnico = nombreTecnico;
  }

  cambiarEstado(nuevoEstado) {
    this.estado = nuevoEstado;
  }
}

// 4. Clase SistemaSoporte (Clase estática para administrar lógica e historial)
export class SistemaSoporte {
  static agregarHistorial(historialPrevio, accion) {
    const fecha = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const nuevaEntrada = `[${fecha}] ${accion}`;
    return historialPrevio ? `${historialPrevio} | ${nuevaEntrada}` : nuevaEntrada;
  }
}