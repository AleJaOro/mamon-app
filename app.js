/* =========================================================
   CONFIGURACIÓN — edita aquí el precio por kilo
   ========================================================= */
const PRECIO_POR_KG = 1200;
const DIAS_AVISO_COBRO = 3;
const STORAGE_KEY = 'mamones_pedidos';

/* =========================================================
   ESTADO / ALMACENAMIENTO
   ========================================================= */
function cargarPedidos(){
  try{
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  }catch(e){
    return [];
  }
}
function guardarPedidos(pedidos){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pedidos));
}
let pedidos = cargarPedidos();

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

// Filtro de fiados: al escribir el nombre, avisa si tiene pendientes
clienteInput.addEventListener('input', ()=>{
  const nombre = clienteInput.value.trim().toLowerCase();
  if(!nombre){
    alertaFiado.classList.add('oculto');
    return;
  }
  const tienePendiente = pedidos.some(p =>
    p.cliente.trim().toLowerCase() === nombre && p.estado === 'pendiente'
  );
  alertaFiado.classList.toggle('oculto', !tienePendiente);
});

formVenta.addEventListener('submit', (e)=>{
  e.preventDefault();
  const cliente = clienteInput.value.trim();
  const kg = parseFloat(kgInput.value);
  if(!cliente || !kg || kg <= 0) return;

  const total = kg * PRECIO_POR_KG;
  pedidos.unshift({
    id: Date.now().toString(),
    cliente,
    kg,
    precio: PRECIO_POR_KG,
    total,
    estado: 'pendiente',
    fecha: Date.now()
  });
  guardarPedidos(pedidos);

  // Limpiar formulario instantáneamente para el siguiente pedido
  clienteInput.value = '';
  kgInput.value = 1;
  alertaFiado.classList.add('oculto');
  actualizarTotalPreview();
  clienteInput.focus();
});

actualizarTotalPreview();

/* =========================================================
   MODAL DE CONFIRMACIÓN (reutilizable)
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

function diasDeAntiguedad(fecha){
  return (Date.now() - fecha) / (1000 * 60 * 60 * 24);
}

function formatoFecha(fecha){
  const d = new Date(fecha);
  return d.toLocaleDateString('es-CR', { day:'2-digit', month:'2-digit' }) + ' ' +
         d.toLocaleTimeString('es-CR', { hour:'2-digit', minute:'2-digit' });
}

function renderPedidos(){
  pedidos = cargarPedidos();
  listaPedidosEl.innerHTML = '';

  if(pedidos.length === 0){
    listaPedidosEl.appendChild(pedidosVacioEl);
    pedidosVacioEl.classList.remove('oculto');
    return;
  }
  pedidosVacioEl.classList.add('oculto');

  pedidos.forEach(p=>{
    const card = document.createElement('div');
    card.className = 'pedido-card';

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
      <div class="badges">
        <span class="badge ${p.estado === 'pagado' ? 'badge-pagado' : 'badge-pendiente'}">
          ${p.estado === 'pagado' ? 'Pagado' : 'Pendiente'}
        </span>
        ${esAviso ? '<span class="badge badge-aviso">Aviso: Cobrar</span>' : ''}
      </div>
      <div class="pedido-acciones">
        <button class="btn-mini ${p.estado === 'pagado' ? 'pendiente-btn' : 'pagar'}" data-accion="toggle" data-id="${p.id}">
          ${p.estado === 'pagado' ? 'Marcar pendiente' : 'Marcar pagado'}
        </button>
        <button class="btn-mini borrar" data-accion="borrar" data-id="${p.id}">✕</button>
      </div>
    `;
    listaPedidosEl.appendChild(card);
  });
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

listaPedidosEl.addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-accion]');
  if(!btn) return;
  const id = btn.dataset.id;
  const pedido = pedidos.find(p => p.id === id);
  if(!pedido) return;

  if(btn.dataset.accion === 'toggle'){
    pedirConfirmacion('¿Seguro que deseas modificar este pedido?', ()=>{
      pedido.estado = pedido.estado === 'pagado' ? 'pendiente' : 'pagado';
      guardarPedidos(pedidos);
      renderPedidos();
    });
  }

  if(btn.dataset.accion === 'borrar'){
    pedirConfirmacion('¿Seguro que deseas eliminar este pedido?', ()=>{
      pedidos = pedidos.filter(p => p.id !== id);
      guardarPedidos(pedidos);
      renderPedidos();
    });
  }
});

/* ===== Enviar por WhatsApp ===== */
document.getElementById('btn-whatsapp').addEventListener('click', ()=>{
  pedidos = cargarPedidos();
  if(pedidos.length === 0){
    alert('No hay pedidos para enviar.');
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
  pedidos = cargarPedidos();
  if(pedidos.length === 0){
    alert('No hay pedidos para exportar.');
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
  doc.text('Kg', 90, y);
  doc.text('Total', 120, y);
  doc.text('Estado', 160, y);
  y += 6;
  doc.line(14, y - 4, 196, y - 4);

  pedidos.forEach(p=>{
    if(y > 280){ doc.addPage(); y = 20; }
    doc.text(String(p.cliente).substring(0, 30), 14, y);
    doc.text(String(p.kg), 90, y);
    doc.text(formatoColones(p.total), 120, y);
    doc.text(p.estado === 'pagado' ? 'Pagado' : 'Pendiente', 160, y);
    y += 8;
  });

  doc.save('pedidos-mamones.pdf');
});

/* =========================================================
   VISTA ESTADÍSTICAS
   ========================================================= */
function renderStats(){
  pedidos = cargarPedidos();

  const ganancias = pedidos.filter(p=>p.estado === 'pagado').reduce((a,p)=>a + p.total, 0);
  const faltante = pedidos.filter(p=>p.estado === 'pendiente').reduce((a,p)=>a + p.total, 0);
  const kilos = pedidos.reduce((a,p)=>a + p.kg, 0);

  document.getElementById('stat-ganancias').textContent = formatoColones(ganancias);
  document.getElementById('stat-pendiente').textContent = formatoColones(faltante);
  document.getElementById('stat-kilos').textContent = kilos.toFixed(1).replace(/\.0$/, '') + ' kg';
  document.getElementById('stat-pedidos').textContent = pedidos.length;

  // Ventas por día (últimos 7 días)
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
    const total = pedidos
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

  // Mejores clientes (por total comprado)
  const porCliente = {};
  pedidos.forEach(p=>{
    const key = p.cliente.trim();
    if(!porCliente[key]) porCliente[key] = { kg: 0, total: 0 };
    porCliente[key].kg += p.kg;
    porCliente[key].total += p.total;
  });

  const topClientes = Object.entries(porCliente)
    .sort((a,b)=> b[1].total - a[1].total)
    .slice(0, 5);

  const statsClientesEl = document.getElementById('stats-clientes');
  if(topClientes.length === 0){
    statsClientesEl.innerHTML = '<p class="vacio">Sin datos todavía.</p>';
  }else{
    statsClientesEl.innerHTML = topClientes.map(([nombre, datos])=>`
      <div class="cliente-row">
        <span class="nombre">${escapeHtml(nombre)}</span>
        <span class="info">${datos.kg.toFixed(1).replace(/\.0$/, '')} kg · ${formatoColones(datos.total)}</span>
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
