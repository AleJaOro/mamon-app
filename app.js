'use strict';

/* =========================================================
   CONFIGURACIÓN — edita estos valores según tu negocio
   ========================================================= */
const PRECIO_KG    = 1200;   // colones por kilo
const STOCK_INICIAL = 30;    // kg disponibles hoy
const DIAS_AVISO   = 3;      // días para marcar "Aviso: Cobrar"
const STORAGE_KEY  = 'mamones_pedidos_v1';

/* =========================================================
   ALMACENAMIENTO (localStorage)
   ========================================================= */
function loadPedidos(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){
    console.error('Error leyendo pedidos', e);
    return [];
  }
}
function savePedidos(pedidos){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pedidos));
}

/* =========================================================
   UTILIDADES
   ========================================================= */
function formatoColones(monto){
  return '₡' + Math.round(monto).toLocaleString('es-CR');
}
function formatoFecha(ts){
  return new Date(ts).toLocaleString('es-CR', {
    day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'
  });
}
function normalizarNombre(nombre){
  return nombre.trim().toLowerCase();
}
function stockDisponible(pedidos, excluirId){
  const vendido = pedidos
    .filter(p => p.id !== excluirId)
    .reduce((sum, p) => sum + p.kg, 0);
  return Math.round((STOCK_INICIAL - vendido) * 100) / 100;
}
function mostrarToast(mensaje){
  const toast = document.getElementById('toast');
  toast.textContent = mensaje;
  toast.classList.remove('hidden');
  clearTimeout(mostrarToast._t);
  mostrarToast._t = setTimeout(() => toast.classList.add('hidden'), 2200);
}

/* =========================================================
   MODAL DE CONFIRMACIÓN GENÉRICO
   ========================================================= */
const modalOverlay = document.getElementById('modalOverlay');
const modalText    = document.getElementById('modalText');
const modalConfirm = document.getElementById('modalConfirm');
const modalCancel  = document.getElementById('modalCancel');
let modalOnConfirm = null;

function pedirConfirmacion(texto, onConfirm){
  modalText.textContent = texto;
  modalOnConfirm = onConfirm;
  modalOverlay.classList.remove('hidden');
}
function cerrarModal(){
  modalOverlay.classList.add('hidden');
  modalOnConfirm = null;
}
modalConfirm.addEventListener('click', () => {
  const fn = modalOnConfirm;
  cerrarModal();
  if (fn) fn();
});
modalCancel.addEventListener('click', cerrarModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) cerrarModal();
});

/* =========================================================
   NAVEGACIÓN ENTRE PESTAÑAS
   ========================================================= */
const views = {
  vender:  document.getElementById('viewVender'),
  pedidos: document.getElementById('viewPedidos'),
};
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    Object.entries(views).forEach(([key, el]) => {
      el.classList.toggle('hidden', key !== btn.dataset.view);
    });
    if (btn.dataset.view === 'pedidos') renderPedidos();
  });
});

/* =========================================================
   VISTA: VENDER
   ========================================================= */
const clienteInput  = document.getElementById('clienteInput');
const fiadoAlert    = document.getElementById('fiadoAlert');
const kgInput       = document.getElementById('kgInput');
const btnMinus      = document.getElementById('btnMinus');
const btnPlus       = document.getElementById('btnPlus');
const totalDisplay  = document.getElementById('totalDisplay');
const btnRegistrar  = document.getElementById('btnRegistrar');
const stockPill     = document.getElementById('stockPill');

const PASO_KG = 0.5;
const KG_MIN  = 0.5;

function getKg(){
  const v = parseFloat(kgInput.value);
  return isNaN(v) || v < 0 ? 0 : v;
}
function setKg(valor){
  const v = Math.max(0, Math.round(valor * 100) / 100);
  kgInput.value = v;
  actualizarTotal();
}
function actualizarTotal(){
  totalDisplay.textContent = formatoColones(getKg() * PRECIO_KG);
  btnMinus.disabled = getKg() <= KG_MIN;
}
btnMinus.addEventListener('click', () => setKg(getKg() - PASO_KG));
btnPlus.addEventListener('click',  () => setKg(getKg() + PASO_KG));
kgInput.addEventListener('input', actualizarTotal);
kgInput.addEventListener('blur', () => {
  if (getKg() < KG_MIN) setKg(KG_MIN);
});

function actualizarStockPill(){
  const pedidos = loadPedidos();
  const disponible = stockDisponible(pedidos);
  stockPill.textContent = `Stock: ${disponible} kg`;
  stockPill.classList.toggle('low', disponible <= 5);
}

/* --- Filtro de fiados en vivo --- */
clienteInput.addEventListener('input', () => {
  const nombre = clienteInput.value;
  if (!nombre.trim()){
    fiadoAlert.classList.add('hidden');
    return;
  }
  const pedidos = loadPedidos();
  const pendientes = pedidos.filter(p =>
    !p.pagado && normalizarNombre(p.cliente) === normalizarNombre(nombre)
  );
  if (pendientes.length > 0){
    const totalDebe = pendientes.reduce((s, p) => s + p.total, 0);
    fiadoAlert.textContent =
      `⚠️ ${nombre.trim()} tiene ${pendientes.length} pedido(s) pendiente(s) por ${formatoColones(totalDebe)}.`;
    fiadoAlert.classList.remove('hidden');
  } else {
    fiadoAlert.classList.add('hidden');
  }
});

/* --- Registrar pedido --- */
btnRegistrar.addEventListener('click', () => {
  const cliente = clienteInput.value.trim();
  const kg = getKg();

  if (!cliente){
    mostrarToast('Escribe el nombre del cliente');
    clienteInput.focus();
    return;
  }
  if (kg < KG_MIN){
    mostrarToast(`La cantidad mínima es ${KG_MIN} kg`);
    return;
  }
  const pedidos = loadPedidos();
  const disponible = stockDisponible(pedidos);
  if (kg > disponible){
    mostrarToast(`Solo quedan ${disponible} kg en stock`);
    return;
  }

  const nuevoPedido = {
    id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    cliente,
    kg,
    total: kg * PRECIO_KG,
    pagado: false,
    fecha: Date.now(),
  };
  pedidos.push(nuevoPedido);
  savePedidos(pedidos);

  // Limpieza instantánea para el siguiente pedido
  clienteInput.value = '';
  fiadoAlert.classList.add('hidden');
  setKg(1);
  actualizarStockPill();
  mostrarToast('Pedido registrado ✓');
  clienteInput.focus();
});

/* =========================================================
   VISTA: PEDIDOS
   ========================================================= */
const pedidosList = document.getElementById('pedidosList');
const emptyState  = document.getElementById('emptyState');
const template    = document.getElementById('pedidoCardTemplate');
let filtroActual  = 'todos';

document.getElementById('filterChips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  filtroActual = chip.dataset.filter;
  renderPedidos();
});

function diasDesde(ts){
  return (Date.now() - ts) / (1000 * 60 * 60 * 24);
}

function renderPedidos(){
  const pedidos = loadPedidos()
    .slice()
    .sort((a, b) => b.fecha - a.fecha)
    .filter(p => {
      if (filtroActual === 'pendiente') return !p.pagado;
      if (filtroActual === 'pagado') return p.pagado;
      return true;
    });

  pedidosList.innerHTML = '';
  emptyState.classList.toggle('hidden', pedidos.length > 0);

  pedidos.forEach(p => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.id = p.id;

    node.querySelector('.pedido-cliente').textContent = p.cliente;
    node.querySelector('.pedido-detalle').textContent =
      `${p.kg} kg · ${formatoColones(p.total)}`;
    node.querySelector('.pedido-fecha').textContent = formatoFecha(p.fecha);

    const avisoTag = node.querySelector('.badge.aviso');
    const esAviso = !p.pagado && diasDesde(p.fecha) > DIAS_AVISO;
    avisoTag.classList.toggle('hidden', !esAviso);

    const estadoBtn = node.querySelector('.badge-estado');
    estadoBtn.textContent = p.pagado ? 'Pagado' : 'Pendiente';
    estadoBtn.classList.add(p.pagado ? 'pagado' : 'pendiente');

    // Prellenar formulario de edición (oculto por defecto)
    node.querySelector('.edit-cliente').value = p.cliente;
    node.querySelector('.edit-kg-input').value = p.kg;

    pedidosList.appendChild(node);
  });
}

/* --- Delegación de eventos para tarjetas de pedidos --- */
pedidosList.addEventListener('click', (e) => {
  const card = e.target.closest('.pedido-card');
  if (!card) return;
  const id = card.dataset.id;
  const accion = e.target.closest('[data-action]')?.dataset.action;
  if (!accion) return;

  const pedidos = loadPedidos();
  const pedido = pedidos.find(p => p.id === id);
  if (!pedido) return;

  if (accion === 'toggle-pago'){
    pedido.pagado = !pedido.pagado;
    savePedidos(pedidos);
    renderPedidos();
    actualizarStockPill();
    mostrarToast(pedido.pagado ? 'Marcado como pagado' : 'Marcado como pendiente');
  }

  if (accion === 'edit'){
    card.querySelector('.edit-form').classList.remove('hidden');
    card.querySelector('.btn-edit').classList.add('hidden');
  }

  if (accion === 'cancel-edit'){
    card.querySelector('.edit-form').classList.add('hidden');
    card.querySelector('.btn-edit').classList.remove('hidden');
    // Restaurar valores originales
    card.querySelector('.edit-cliente').value = pedido.cliente;
    card.querySelector('.edit-kg-input').value = pedido.kg;
  }

  if (accion === 'edit-minus' || accion === 'edit-plus'){
    const kgField = card.querySelector('.edit-kg-input');
    let v = parseFloat(kgField.value) || 0;
    v += accion === 'edit-minus' ? -PASO_KG : PASO_KG;
    kgField.value = Math.max(KG_MIN, Math.round(v * 100) / 100);
  }

  if (accion === 'save-edit'){
    const nuevoCliente = card.querySelector('.edit-cliente').value.trim();
    const nuevoKg = parseFloat(card.querySelector('.edit-kg-input').value);

    if (!nuevoCliente){
      mostrarToast('El nombre no puede estar vacío');
      return;
    }
    if (isNaN(nuevoKg) || nuevoKg < KG_MIN){
      mostrarToast(`La cantidad mínima es ${KG_MIN} kg`);
      return;
    }
    const disponible = stockDisponible(pedidos, pedido.id);
    if (nuevoKg > disponible){
      mostrarToast(`Solo quedan ${disponible} kg de stock disponibles`);
      return;
    }

    pedirConfirmacion('¿Seguro que deseas modificar este pedido?', () => {
      pedido.cliente = nuevoCliente;
      pedido.kg = nuevoKg;
      pedido.total = nuevoKg * PRECIO_KG;
      savePedidos(pedidos);
      renderPedidos();
      actualizarStockPill();
      mostrarToast('Pedido actualizado ✓');
    });
  }
});

/* =========================================================
   INICIALIZACIÓN
   ========================================================= */
setKg(1);
actualizarStockPill();

/* Service worker (funciona en local sirviendo por http/https) */
if ('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* si falla, la app sigue funcionando sin modo offline */
    });
  });
}
