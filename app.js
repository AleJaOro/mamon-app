/* =========================================================
   CONFIGURACIÓN — edita aquí el precio por kilo
   ========================================================= */
const PRECIO_POR_KG = 1200;
const DIAS_AVISO_COBRO = 3;

/* =========================================================
   ESTADO EN MEMORIA (se llena vía Firestore en tiempo real)
   ========================================================= */
let pedidos = [];               // caché local, sincronizada con Firestore
let filtroActual = 'todos';     // filtro activo en la vista de pedidos
let filtroStats = null;         // { desde, hasta, estado } o null = sin filtro

/* =========================================================
   CONEXIÓN A FIREBASE / FIRESTORE EN TIEMPO REAL
   ========================================================= */
const estadoConexionEl = document.getElementById('estado-conexion');
const estadoTextoEl = document.getElementById('estado-texto');

function mostrarEstadoConexion(tipo, texto){
  estadoConexionEl.classList.remove('oculto', 'conectado', 'error');
  estadoConexionEl.classList.add(tipo);
  estadoTextoEl.textContent = texto;
  if(tipo === 'conectado'){
    setTimeout(()=> estadoConexionEl.classList.add('oculto'), 2000);
  }
}

mostrarEstadoConexion('', 'Conectando a Firebase...');

db.collection(COLECCION_PEDIDOS)
  .orderBy('fecha', 'desc')
  .onSnapshot(
    (snapshot)=>{
      pedidos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      mostrarEstadoConexion('conectado', 'Conectado');
      renderTodo();
    },
    (error)=>{
      console.error(error);
      mostrarEstadoConexion('error', 'Sin conexión a Firebase');
      mostrarToast('No se pudo conectar a Firebase. Revisa firebase-config.js', 'error');
    }
  );

function renderTodo(){
  const vistaActiva = document.querySelector('.view.active').id;
  if(vistaActiva === 'view-pedidos') renderPedidos();
  if(vistaActiva === 'view-stats') renderStats();
  // Refresca la alerta de fiado si el usuario está escribiendo un nombre
  if(clienteInput.value.trim()) clienteInput.dispatchEvent(new Event('input'));
}

/* =========================================================
   TOASTS (notificaciones)
   ========================================================= */
const toastContainer = document.getElementById('toast-container');

function mostrarToast(mensaje, tipo = 'exito'){
  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  toast.textContent = mensaje;
  toastContainer.appendChild(toast);
  setTimeout(()=>{
    toast.classList.add('saliendo');
    setTimeout(()=> toast.remove(), 300);
  }, 2600);
}

/* =========================================================
   NAVEGACIÓN ENTRE VISTAS
   ========================================================= */
const tabBtns = document.querySelectorAll('.tab-btn');
const views = document.querySelectorAll('.view');

tabBtns.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    tabBtns.forEach(b=>b.classList.remove('active'));
    views.forEach(v=>v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-' + btn.dataset.view).classList.add('active');

    if(btn.dataset.view === 'pedidos') renderPedidos();
    if(btn.dataset.view === 'stats') renderStats();
  });
});

/* =========================================================
   VISTA VENTA (HOME)
   ========================================================= */
const clienteInput = document.getElementById('cliente');
const kgInput = document.getElementById('kg-input');
const btnSumar = document.getElementById('btn-sumar');
const btnRestar = document.getElementById('btn-restar');
const totalPreview = document.getElementById('total-preview');
const alertaFiado = document.getElementById('alerta-fiado');
const formVenta = document.getElementById('form-venta');
const notaVentaInput = document.getElementById('nota-venta');
const metodoPagoVentaEl = document.getElementById('metodo-pago-venta');
let metodoPagoSeleccionado = 'Efectivo';

function formatoColones(monto){
  return '₡' + Math.round(monto).toLocaleString('es-CR');
}

function actualizarTotalPreview(){
  const kg = parseFloat(kgInput.value) || 0;
  totalPreview.textContent = formatoColones(kg * PRECIO_POR_KG);
}

btnSumar.addEventListener('click', ()=>{
  kgInput.value = (parseFloat(kgInput.value || 0) + 0.5).toFixed(1).replace(/\.0$/, '');
  actualizarTotalPreview();
});
btnRestar.addEventListener('click', ()=>{
  const nuevo = Math.max(0.5, parseFloat(kgInput.value || 0) - 0.5);
  kgInput.value = nuevo.toFixed(1).replace(/\.0$/, '');
  actualizarTotalPreview();
});
kgInput.addEventListener('input', actualizarTotalPreview);

metodoPagoVentaEl.addEventListener('click', (e)=>{
  const btn = e.target.closest('.metodo-btn');
  if(!btn) return;
  metodoPagoVentaEl.querySelectorAll('.metodo-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  metodoPagoSeleccionado = btn.dataset.metodo;
});

// Filtro de fiados: al escribir el nombre, avisa si tiene pendientes
clienteInput.addEventListener('input', ()=>{
  const nombre = clienteInput.value.trim().toLowerCase();
  if(!nombre){
    alertaFiado.classList.add('oculto');
    return;
  }
  const tienePendiente = pedidos.some(p =>
    (p.cliente || '').trim().toLowerCase() === nombre && p.estado === 'pendiente'
  );
  alertaFiado.classList.toggle('oculto', !tienePendiente);
});

formVenta.addEventListener('submit', (e)=>{
  e.preventDefault();
  const cliente = clienteInput.value.trim();
  const kg = parseFloat(kgInput.value);
  if(!cliente || !kg || kg <= 0) return;

  const total = kg * PRECIO_POR_KG;

  pedirConfirmacion(`Registrar pedido de ${cliente}: ${kg} kg (${formatoColones(total)}). ¿Confirmas?`, async ()=>{
    try{
      await db.collection(COLECCION_PEDIDOS).add({
        cliente,
        kg,
        precio: PRECIO_POR_KG,
        total,
        estado: 'pendiente',
        metodoPago: metodoPagoSeleccionado,
        nota: notaVentaInput.value.trim(),
        fecha: Date.now()
      });

      // Limpiar formulario instantáneamente para el siguiente pedido
      clienteInput.value = '';
      kgInput.value = 1;
      notaVentaInput.value = '';
      metodoPagoVentaEl.querySelectorAll('.metodo-btn').forEach(b=>b.classList.remove('active'));
      metodoPagoVentaEl.querySelector('[data-metodo="Efectivo"]').classList.add('active');
      metodoPagoSeleccionado = 'Efectivo';
      alertaFiado.classList.add('oculto');
      actualizarTotalPreview();
      clienteInput.focus();

      mostrarToast('Pedido registrado con éxito', 'exito');
    }catch(err){
      console.error(err);
      mostrarToast('Error al guardar el pedido', 'error');
    }
  });
});

actualizarTotalPreview();

/* =========================================================
   MODAL DE CONFIRMACIÓN (reutilizable, previene clics accidentales)
   ========================================================= */
const modalOverlay = document.getElementById('modal-confirm');
const modalTexto = document.getElementById('modal-texto');
const modalCancelar = document.getElementById('modal-cancelar');
const modalAceptar = document.getElementById('modal-aceptar');
let accionPendiente = null;

function pedirConfirmacion(texto, callback){
  modalTexto.textContent = texto;
  accionPendiente = callback;
  modalOverlay.classList.remove('oculto');
}
modalCancelar.addEventListener('click', ()=>{
  modalOverlay.classList.add('oculto');
  accionPendiente = null;
});
modalAceptar.addEventListener('click', ()=>{
  if(accionPendiente) accionPendiente();
  modalOverlay.classList.add('oculto');
  accionPendiente = null;
});

/* =========================================================
   VISTA PEDIDOS
   ========================================================= */
const listaPedidosEl = document.getElementById('lista-pedidos');
const pedidosVacioEl = document.getElementById('pedidos-vacio');
const filtroBtns = document.querySelectorAll('.filtro-btn');

filtroBtns.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    filtroBtns.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    filtroActual = btn.dataset.filtro;
    renderPedidos();
  });
});

function diasDeAntiguedad(fecha){
  return (Date.now() - fecha) / (1000 * 60 * 60 * 24);
}

function formatoFecha(fecha){
  const d = new Date(fecha);
  return d.toLocaleDateString('es-CR', { day:'2-digit', month:'2-digit' }) + ' ' +
         d.toLocaleTimeString('es-CR', { hour:'2-digit', minute:'2-digit' });
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function renderPedidos(){
  const filtrados = pedidos.filter(p => filtroActual === 'todos' ? true : p.estado === filtroActual);

  listaPedidosEl.innerHTML = '';

  if(filtrados.length === 0){
    listaPedidosEl.appendChild(pedidosVacioEl);
    pedidosVacioEl.textContent = pedidos.length === 0
      ? 'Aún no hay pedidos registrados.'
      : 'No hay pedidos en este filtro.';
    pedidosVacioEl.classList.remove('oculto');
    return;
  }
  pedidosVacioEl.classList.add('oculto');

  filtrados.forEach((p, i)=>{
    const card = document.createElement('div');
    card.className = 'pedido-card';
    card.style.animationDelay = (i * 0.03) + 's';

    const esAviso = p.estado === 'pendiente' && diasDeAntiguedad(p.fecha) > DIAS_AVISO_COBRO;

    card.innerHTML = `
      <div class="pedido-top">
        <div>
          <div class="pedido-cliente">${escapeHtml(p.cliente)}</div>
          <div class="pedido-fecha">${formatoFecha(p.fecha)}</div>
        </div>
        <div class="pedido-total">${formatoColones(p.total)}</div>
      </div>
      <div class="pedido-detalle">${p.kg} kg × ${formatoColones(p.precio)}</div>
      ${p.nota ? `<div class="pedido-nota">📝 ${escapeHtml(p.nota)}</div>` : ''}
      <div class="badges">
        <span class="badge ${p.estado === 'pagado' ? 'badge-pagado' : 'badge-pendiente'}">
          ${p.estado === 'pagado' ? 'Pagado' : 'Pendiente'}
        </span>
        <span class="badge badge-metodo">${p.metodoPago === 'SinpeMovil' ? 'Sinpe Móvil' : 'Efectivo'}</span>
        ${esAviso ? '<span class="badge badge-aviso">Aviso: Cobrar</span>' : ''}
      </div>
      <div class="pedido-acciones">
        <button class="btn-mini ${p.estado === 'pagado' ? 'pendiente-btn' : 'pagar'}" data-accion="toggle" data-id="${p.id}">
          ${p.estado === 'pagado' ? 'Marcar pendiente' : 'Marcar pagado'}
        </button>
        <button class="btn-mini borrar" data-accion="borrar" data-id="${p.id}">✕</button>
      </div>
    `;

    // Tocar la tarjeta (fuera de los botones) abre el detalle/edición
    card.addEventListener('click', (e)=>{
      if(e.target.closest('button')) return;
      abrirDetalle(p.id);
    });

    listaPedidosEl.appendChild(card);
  });
}

listaPedidosEl.addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-accion]');
  if(!btn) return;
  const id = btn.dataset.id;
  const pedido = pedidos.find(p => p.id === id);
  if(!pedido) return;

  if(btn.dataset.accion === 'toggle'){
    const nuevoEstado = pedido.estado === 'pagado' ? 'pendiente' : 'pagado';
    pedirConfirmacion(`¿Marcar el pedido de ${pedido.cliente} como "${nuevoEstado}"?`, async ()=>{
      try{
        await db.collection(COLECCION_PEDIDOS).doc(id).update({ estado: nuevoEstado });
        mostrarToast('Pedido actualizado', 'exito');
      }catch(err){
        console.error(err);
        mostrarToast('Error al actualizar el pedido', 'error');
      }
    });
  }

  if(btn.dataset.accion === 'borrar'){
    pedirConfirmacion(`¿Seguro que deseas eliminar el pedido de ${pedido.cliente}? Esta acción no se puede deshacer.`, async ()=>{
      try{
        await db.collection(COLECCION_PEDIDOS).doc(id).delete();
        mostrarToast('Pedido eliminado', 'exito');
      }catch(err){
        console.error(err);
        mostrarToast('Error al eliminar el pedido', 'error');
      }
    });
  }
});

/* ===== Modal de Detalle / Edición de pedido ===== */
const modalDetalle = document.getElementById('modal-detalle');
const detCliente = document.getElementById('det-cliente');
const detKg = document.getElementById('det-kg');
const detNota = document.getElementById('det-nota');
const detBtnSumar = document.getElementById('det-btn-sumar');
const detBtnRestar = document.getElementById('det-btn-restar');
const metodoPagoDetalleEl = document.getElementById('metodo-pago-detalle');
const estadoDetalleEl = document.getElementById('estado-detalle');
const detInfoExtra = document.getElementById('det-info-extra');
const detCancelar = document.getElementById('det-cancelar');
const detGuardar = document.getElementById('det-guardar');
let idPedidoEditando = null;

function abrirDetalle(id){
  const p = pedidos.find(x => x.id === id);
  if(!p) return;
  idPedidoEditando = id;

  detCliente.value = p.cliente;
  detKg.value = p.kg;
  detNota.value = p.nota || '';

  metodoPagoDetalleEl.querySelectorAll('.metodo-btn').forEach(b=>
    b.classList.toggle('active', b.dataset.metodo === (p.metodoPago || 'Efectivo'))
  );
  estadoDetalleEl.querySelectorAll('.metodo-btn').forEach(b=>
    b.classList.toggle('active', b.dataset.estado === p.estado)
  );

  detInfoExtra.textContent = `Registrado el ${formatoFecha(p.fecha)} · Total actual: ${formatoColones(p.total)}`;

  modalDetalle.classList.remove('oculto');
}

detBtnSumar.addEventListener('click', ()=>{
  detKg.value = (parseFloat(detKg.value || 0) + 0.5).toFixed(1).replace(/\.0$/, '');
});
detBtnRestar.addEventListener('click', ()=>{
  detKg.value = Math.max(0.5, parseFloat(detKg.value || 0) - 0.5).toFixed(1).replace(/\.0$/, '');
});

metodoPagoDetalleEl.addEventListener('click', (e)=>{
  const btn = e.target.closest('.metodo-btn');
  if(!btn) return;
  metodoPagoDetalleEl.querySelectorAll('.metodo-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
});

estadoDetalleEl.addEventListener('click', (e)=>{
  const btn = e.target.closest('.metodo-btn');
  if(!btn) return;
  estadoDetalleEl.querySelectorAll('.metodo-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
});

detCancelar.addEventListener('click', ()=>{
  modalDetalle.classList.add('oculto');
  idPedidoEditando = null;
});

detGuardar.addEventListener('click', ()=>{
  const cliente = detCliente.value.trim();
  const kg = parseFloat(detKg.value);
  if(!cliente || !kg || kg <= 0){
    mostrarToast('Revisa el cliente y los kilos', 'error');
    return;
  }
  const metodoPago = metodoPagoDetalleEl.querySelector('.metodo-btn.active')?.dataset.metodo || 'Efectivo';
  const estado = estadoDetalleEl.querySelector('.metodo-btn.active')?.dataset.estado || 'pendiente';
  const nota = detNota.value.trim();
  const total = kg * PRECIO_POR_KG;

  pedirConfirmacion('¿Seguro que deseas modificar este pedido?', async ()=>{
    try{
      await db.collection(COLECCION_PEDIDOS).doc(idPedidoEditando).update({
        cliente, kg, total, precio: PRECIO_POR_KG, metodoPago, estado, nota
      });
      modalDetalle.classList.add('oculto');
      idPedidoEditando = null;
      mostrarToast('Pedido actualizado', 'exito');
    }catch(err){
      console.error(err);
      mostrarToast('Error al guardar los cambios', 'error');
    }
  });
});

/* ===== Enviar por WhatsApp ===== */
document.getElementById('btn-whatsapp').addEventListener('click', ()=>{
  if(pedidos.length === 0){
    mostrarToast('No hay pedidos para enviar', 'error');
    return;
  }
  let texto = '*Lista de pedidos - Mamones*%0a%0a';
  pedidos.forEach(p=>{
    texto += `${p.cliente} - ${p.kg}kg - ${formatoColones(p.total)} - ${p.estado === 'pagado' ? 'Pagado' : 'Pendiente'}%0a`;
  });
  const url = `https://api.whatsapp.com/send?text=${texto}`;
  window.open(url, '_blank');
});

/* ===== Exportar PDF ===== */
document.getElementById('btn-pdf').addEventListener('click', ()=>{
  if(pedidos.length === 0){
    mostrarToast('No hay pedidos para exportar', 'error');
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text('Lista de Pedidos - Mamones', 14, 16);
  doc.setFontSize(10);
  doc.text(new Date().toLocaleDateString('es-CR'), 14, 22);

  let y = 32;
  doc.setFontSize(11);
  doc.text('Cliente', 14, y);
  doc.text('Kg', 80, y);
  doc.text('Total', 105, y);
  doc.text('Pago', 140, y);
  doc.text('Estado', 170, y);
  y += 6;
  doc.line(14, y - 4, 196, y - 4);

  pedidos.forEach(p=>{
    if(y > 280){ doc.addPage(); y = 20; }
    doc.text(String(p.cliente).substring(0, 26), 14, y);
    doc.text(String(p.kg), 80, y);
    doc.text(formatoColones(p.total), 105, y);
    doc.text(p.metodoPago === 'SinpeMovil' ? 'Sinpe' : 'Efectivo', 140, y);
    doc.text(p.estado === 'pagado' ? 'Pagado' : 'Pendiente', 170, y);
    y += 8;
  });

  doc.save('pedidos-mamones.pdf');
  mostrarToast('PDF generado', 'exito');
});

/* =========================================================
   VISTA ESTADÍSTICAS (con filtros por fecha y estado)
   ========================================================= */
const statsDesde = document.getElementById('stats-desde');
const statsHasta = document.getElementById('stats-hasta');
const statsEstado = document.getElementById('stats-estado');

document.getElementById('stats-aplicar').addEventListener('click', ()=>{
  filtroStats = {
    desde: statsDesde.value ? new Date(statsDesde.value + 'T00:00:00').getTime() : null,
    hasta: statsHasta.value ? new Date(statsHasta.value + 'T23:59:59').getTime() : null,
    estado: statsEstado.value
  };
  renderStats();
  mostrarToast('Filtro aplicado', 'exito');
});

document.getElementById('stats-limpiar').addEventListener('click', ()=>{
  filtroStats = null;
  statsDesde.value = '';
  statsHasta.value = '';
  statsEstado.value = 'todos';
  renderStats();
});

function obtenerPedidosFiltradosParaStats(){
  if(!filtroStats) return pedidos;
  return pedidos.filter(p=>{
    if(filtroStats.desde && p.fecha < filtroStats.desde) return false;
    if(filtroStats.hasta && p.fecha > filtroStats.hasta) return false;
    if(filtroStats.estado !== 'todos' && p.estado !== filtroStats.estado) return false;
    return true;
  });
}

function renderStats(){
  const datos = obtenerPedidosFiltradosParaStats();

  const ganancias = datos.filter(p=>p.estado === 'pagado').reduce((a,p)=>a + p.total, 0);
  const faltante = datos.filter(p=>p.estado === 'pendiente').reduce((a,p)=>a + p.total, 0);
  const kilos = datos.reduce((a,p)=>a + p.kg, 0);

  document.getElementById('stat-ganancias').textContent = formatoColones(ganancias);
  document.getElementById('stat-pendiente').textContent = formatoColones(faltante);
  document.getElementById('stat-kilos').textContent = kilos.toFixed(1).replace(/\.0$/, '') + ' kg';
  document.getElementById('stat-pedidos').textContent = datos.length;

  // Ventas por día (últimos 7 días, respetando el filtro de estado si aplica)
  const dias = [];
  for(let i = 6; i >= 0; i--){
    const fecha = new Date();
    fecha.setHours(0,0,0,0);
    fecha.setDate(fecha.getDate() - i);
    dias.push(fecha);
  }

  const totalesPorDia = dias.map(fecha=>{
    const siguiente = new Date(fecha);
    siguiente.setDate(siguiente.getDate() + 1);
    const total = datos
      .filter(p => p.fecha >= fecha.getTime() && p.fecha < siguiente.getTime())
      .reduce((a,p)=>a + p.total, 0);
    return { fecha, total };
  });

  const maxDia = Math.max(1, ...totalesPorDia.map(d=>d.total));
  const statsDiasEl = document.getElementById('stats-dias');
  statsDiasEl.innerHTML = totalesPorDia.map(d=>{
    const pct = Math.round((d.total / maxDia) * 100);
    const label = d.fecha.toLocaleDateString('es-CR', { weekday: 'short' });
    return `
      <div class="dia-row">
        <div class="dia-label">${label}</div>
        <div class="dia-barra-fondo"><div class="dia-barra" style="width:${pct}%"></div></div>
        <div class="dia-monto">${formatoColones(d.total)}</div>
      </div>
    `;
  }).join('');

  // Mejores clientes (por total comprado, dentro del filtro activo)
  const porCliente = {};
  datos.forEach(p=>{
    const key = (p.cliente || '').trim();
    if(!porCliente[key]) porCliente[key] = { kg: 0, total: 0 };
    porCliente[key].kg += p.kg;
    porCliente[key].total += p.total;
  });

  const topClientes = Object.entries(porCliente)
    .sort((a,b)=> b[1].total - a[1].total)
    .slice(0, 5);

  const statsClientesEl = document.getElementById('stats-clientes');
  if(topClientes.length === 0){
    statsClientesEl.innerHTML = '<p class="vacio">Sin datos para este filtro.</p>';
  }else{
    statsClientesEl.innerHTML = topClientes.map(([nombre, datosCliente])=>`
      <div class="cliente-row">
        <span class="nombre">${escapeHtml(nombre)}</span>
        <span class="info">${datosCliente.kg.toFixed(1).replace(/\.0$/, '')} kg · ${formatoColones(datosCliente.total)}</span>
      </div>
    `).join('');
  }
}

/* =========================================================
   REGISTRO DEL SERVICE WORKER (para instalación como app)
   ========================================================= */
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  });
}