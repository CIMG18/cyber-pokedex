// Colores por tipo de Pokémon
const TYPE_COLORS = {
  normal: '#A8A878',
  fire: '#F08030',
  water: '#6890F0',
  grass: '#78C850',
  electric: '#F8D030',
  ice: '#98D8D8',
  fighting: '#C03028',
  poison: '#A040A0',
  ground: '#E0C068',
  flying: '#A890F0',
  psychic: '#F85888',
  bug: '#A8B820',
  rock: '#B8A038',
  ghost: '#705898',
  dragon: '#7038F8',
  steel: '#B8B8D0',
  fairy: '#EE99AC'
};

const ALL_TYPES = Object.keys(TYPE_COLORS);

// Estado de la aplicación
let pokemons = [];
let currentFilterType = 'all';
let currentSearch = '';
let currentSort = 'id';
let selectedPokemon = null;

// Elementos del DOM
const grid = document.getElementById('pokemon-grid');
const countEl = document.getElementById('pokemon-count');
const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');
const sortSelect = document.getElementById('sort-select');
const typeChipsContainer = document.getElementById('type-chips');
const emptyState = document.getElementById('empty-state');
const toast = document.getElementById('toast');

// Modales
const detailModal = document.getElementById('detail-modal');
const formModal = document.getElementById('form-modal');
const pokemonForm = document.getElementById('pokemon-form');

// ==========================================
// 1. CARGA INICIAL Y API CONSUMERS
// ==========================================

// Iniciar aplicación
document.addEventListener('DOMContentLoaded', () => {
  renderTypeChips();
  renderFormTypePickers();
  fetchPokemons();
  setupEventListeners();
});

// GET: Obtener Pokémon desde el backend
async function fetchPokemons() {
  try {
    const params = new URLSearchParams();
    if (currentSearch) params.append('search', currentSearch);
    if (currentFilterType !== 'all') params.append('type', currentFilterType);
    if (currentSort) params.append('sort', currentSort);

    const res = await fetch(`/api/pokemon?${params.toString()}`);
    if (!res.ok) throw new Error('Error al cargar pokémons');
    
    pokemons = await res.json();
    countEl.textContent = `${pokemons.length} POKÉMONS`;
    renderGrid(pokemons);
  } catch (error) {
    showToast('Error cargando pokémons: ' + error.message, true);
  }
}

// ==========================================
// 2. RENDERIZADO VISUAL
// ==========================================

function renderGrid(list) {
  grid.innerHTML = '';
  if (list.length === 0) {
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  list.forEach(p => {
    const mainType = p.types[0] || 'normal';
    const cardColor = TYPE_COLORS[mainType] || '#00f0ff';

    const card = document.createElement('div');
    card.className = 'poke-card';
    card.style.setProperty('--card-color', cardColor);
    card.style.setProperty('--card-glow', `${cardColor}44`);

    card.innerHTML = `
      <span class="card-number">#${String(p.id).padStart(3, '0')}</span>
      <div class="card-img-container">
        <div class="card-aura"></div>
        <img class="card-art" src="${p.image}" alt="${p.name}" loading="lazy" 
             onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png'">
      </div>
      <div class="card-info">
        <h3 class="card-name">${p.name}</h3>
        <div class="card-types">
          ${p.types.map(t => `
            <span class="type-badge" style="background-color: ${TYPE_COLORS[t] || '#666'}">${t}</span>
          `).join('')}
        </div>
        <div class="mini-stats">
          <div>HP<b>${p.hp}</b></div>
          <div>ATK<b>${p.attack}</b></div>
          <div>DEF<b>${p.defense}</b></div>
          <div>SPD<b>${p.speed}</b></div>
        </div>
      </div>
    `;

    card.addEventListener('click', () => openDetailModal(p));
    grid.appendChild(card);
  });
}

// Chips de filtro superior
function renderTypeChips() {
  typeChipsContainer.innerHTML = `
    <button class="type-chip active" data-type="all">TODOS</button>
  `;
  ALL_TYPES.forEach(t => {
    const chip = document.createElement('button');
    chip.className = 'type-chip';
    chip.dataset.type = t;
    chip.textContent = t;
    chip.style.borderColor = `${TYPE_COLORS[t]}55`;
    chip.addEventListener('click', () => {
      document.querySelectorAll('.type-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilterType = t;
      fetchPokemons();
    });
    typeChipsContainer.appendChild(chip);
  });

  document.querySelector('.type-chip[data-type="all"]').addEventListener('click', (e) => {
    document.querySelectorAll('.type-chip').forEach(c => c.classList.remove('active'));
    e.target.classList.add('active');
    currentFilterType = 'all';
    fetchPokemons();
  });
}

// Selectores de tipos en el formulario
function renderFormTypePickers() {
  const container = document.getElementById('form-types-picker');
  container.innerHTML = '';
  ALL_TYPES.forEach(t => {
    const label = document.createElement('label');
    label.className = 'type-chip';
    label.style.borderColor = `${TYPE_COLORS[t]}66`;
    label.innerHTML = `
      <input type="checkbox" name="types" value="${t}" style="display:none;">
      <span>${t}</span>
    `;
    label.querySelector('input').addEventListener('change', (e) => {
      const checkedCount = container.querySelectorAll('input:checked').length;
      if (checkedCount > 2) {
        e.target.checked = false;
        showToast('Máximo 2 tipos por Pokémon', true);
        return;
      }
      label.classList.toggle('active', e.target.checked);
      if (e.target.checked) label.style.backgroundColor = TYPE_COLORS[t];
      else label.style.backgroundColor = 'transparent';
    });
    container.appendChild(label);
  });
}

// ==========================================
// 3. MODAL DE DETALLE Y AUDIO CRY
// ==========================================

function openDetailModal(p) {
  selectedPokemon = p;
  const mainType = p.types[0] || 'normal';
  const color = TYPE_COLORS[mainType] || '#00f0ff';

  document.getElementById('detail-id').textContent = `#${String(p.id).padStart(3, '0')}`;
  document.getElementById('detail-name').textContent = p.name;
  document.getElementById('detail-image').src = p.image;
  document.getElementById('detail-height').textContent = `${p.height} m`;
  document.getElementById('detail-weight').textContent = `${p.weight} kg`;

  // Tipos
  const typesBox = document.getElementById('detail-types');
  typesBox.innerHTML = p.types.map(t => `
    <span class="type-badge" style="background-color: ${TYPE_COLORS[t] || '#666'}; font-size: 0.9rem; padding: 0.4rem 0.8rem;">${t}</span>
  `).join('');

  // Estadísticas (Barra máxima 200)
  setStatBar('stat-hp', 'stat-hp-val', p.hp);
  setStatBar('stat-atk', 'stat-atk-val', p.attack);
  setStatBar('stat-def', 'stat-def-val', p.defense);
  setStatBar('stat-spd', 'stat-spd-val', p.speed);

  // Botón para reproducir grito oficial
  const cryBtn = document.getElementById('btn-play-cry');
  cryBtn.onclick = () => {
    const audio = new Audio(`https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${p.id}.ogg`);
    audio.play().catch(() => showToast('Audio no disponible para este Pokémon', true));
  };

  detailModal.classList.add('open');
}

function setStatBar(barId, valId, val) {
  document.getElementById(valId).textContent = val;
  const pct = Math.min((val / 180) * 100, 100);
  document.getElementById(barId).style.width = `${pct}%`;
}

// ==========================================
// 4. FORMULARIO: POST (Crear) y PUT (Editar)
// ==========================================

function openCreateModal() {
  document.getElementById('form-title').textContent = 'REGISTRAR NUEVO POKÉMON';
  document.getElementById('form-id').value = '';
  pokemonForm.reset();
  clearTypeSelection();

  // Valores predeterminados
  document.getElementById('slider-hp').value = 60;
  document.getElementById('slider-atk').value = 70;
  document.getElementById('slider-def').value = 50;
  document.getElementById('slider-spd').value = 80;
  updateSliderNumbers();

  document.getElementById('form-preview-img').src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png';
  document.getElementById('form-preview-name').textContent = 'Pikachu';

  formModal.classList.add('open');
}

function openEditModal(p) {
  detailModal.classList.remove('open');
  document.getElementById('form-title').textContent = `EDITAR POKÉMON #${p.id}`;
  document.getElementById('form-id').value = p.id;
  document.getElementById('form-name').value = p.name;
  document.getElementById('form-image').value = p.image;
  document.getElementById('form-height').value = p.height;
  document.getElementById('form-weight').value = p.weight;

  // Sliders
  document.getElementById('slider-hp').value = p.hp;
  document.getElementById('slider-atk').value = p.attack;
  document.getElementById('slider-def').value = p.defense;
  document.getElementById('slider-spd').value = p.speed;
  updateSliderNumbers();

  // Tipos
  clearTypeSelection();
  p.types.forEach(t => {
    const input = document.querySelector(`#form-types-picker input[value="${t}"]`);
    if (input) {
      input.checked = true;
      input.parentElement.classList.add('active');
      input.parentElement.style.backgroundColor = TYPE_COLORS[t];
    }
  });

  document.getElementById('form-preview-img').src = p.image;
  document.getElementById('form-preview-name').textContent = p.name;

  formModal.classList.add('open');
}

function clearTypeSelection() {
  document.querySelectorAll('#form-types-picker label').forEach(l => {
    l.classList.remove('active');
    l.style.backgroundColor = 'transparent';
    l.querySelector('input').checked = false;
  });
}

// Envío del Formulario (POST o PUT)
pokemonForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('form-id').value;
  const name = document.getElementById('form-name').value.trim();
  const image = document.getElementById('form-image').value.trim();
  const height = parseFloat(document.getElementById('form-height').value) || 1.0;
  const weight = parseFloat(document.getElementById('form-weight').value) || 10.0;

  const selectedTypes = Array.from(document.querySelectorAll('#form-types-picker input:checked')).map(i => i.value);
  if (selectedTypes.length === 0) selectedTypes.push('normal');

  const payload = {
    name,
    image,
    types: selectedTypes,
    height,
    weight,
    hp: parseInt(document.getElementById('slider-hp').value),
    attack: parseInt(document.getElementById('slider-atk').value),
    defense: parseInt(document.getElementById('slider-def').value),
    speed: parseInt(document.getElementById('slider-spd').value)
  };

  try {
    let res;
    if (id) {
      // PUT: Actualizar
      res = await fetch(`/api/pokemon/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      // POST: Crear nuevo
      res = await fetch('/api/pokemon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    if (!res.ok) throw new Error('Error al guardar datos');
    
    showToast(id ? 'Pokémon actualizado con éxito' : '¡Nuevo Pokémon registrado!');
    formModal.classList.remove('open');
    fetchPokemons();
  } catch (error) {
    showToast(error.message, true);
  }
});

// ==========================================
// 5. DELETE: Eliminar Pokémon
// ==========================================

async function deletePokemon(id) {
  if (!confirm(`¿Estás seguro de que deseas liberar al Pokémon #${id}?`)) return;

  try {
    const res = await fetch(`/api/pokemon/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Error al eliminar Pokémon');

    showToast(`Pokémon #${id} liberado`);
    detailModal.classList.remove('open');
    fetchPokemons();
  } catch (error) {
    showToast(error.message, true);
  }
}

// ==========================================
// 6. EVENT LISTENERS Y CONTROLES
// ==========================================

function setupEventListeners() {
  // Búsqueda en tiempo real
  searchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value.trim();
    searchClear.style.display = currentSearch ? 'block' : 'none';
    fetchPokemons();
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    currentSearch = '';
    searchClear.style.display = 'none';
    fetchPokemons();
  });

  // Ordenamiento
  sortSelect.addEventListener('change', (e) => {
    currentSort = e.target.value;
    fetchPokemons();
  });

  // Botón abrir creación
  document.getElementById('btn-open-create').addEventListener('click', openCreateModal);

  // Botón sincronizar PokeAPI
  document.getElementById('btn-reset').addEventListener('click', async () => {
    if (!confirm('¿Deseas restablecer la Pokédex a los 100 pokémons iniciales de PokeAPI?')) return;
    showToast('Sincronizando con PokeAPI...');
    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      if (!res.ok) throw new Error('Error al resetear');
      showToast('¡Pokédex sincronizada con éxito!');
      fetchPokemons();
    } catch (e) {
      showToast(e.message, true);
    }
  });

  // Cierres de Modales
  document.getElementById('detail-close').onclick = () => detailModal.classList.remove('open');
  document.getElementById('form-close').onclick = () => formModal.classList.remove('open');
  document.getElementById('form-cancel').onclick = () => formModal.classList.remove('open');

  // Acciones en modal detalle
  document.getElementById('btn-edit-current').onclick = () => openEditModal(selectedPokemon);
  document.getElementById('btn-delete-current').onclick = () => deletePokemon(selectedPokemon.id);

  // Sliders reactivos
  ['hp', 'atk', 'def', 'spd'].forEach(stat => {
    const slider = document.getElementById(`slider-${stat}`);
    slider.addEventListener('input', (e) => {
      document.getElementById(`val-${stat}`).textContent = e.target.value;
    });
  });

  // Live preview de imagen
  document.getElementById('form-image').addEventListener('input', (e) => {
    if (e.target.value) {
      document.getElementById('form-preview-img').src = e.target.value;
    }
  });
  document.getElementById('form-name').addEventListener('input', (e) => {
    document.getElementById('form-preview-name').textContent = e.target.value || 'Pokémon';
  });
}

function updateSliderNumbers() {
  ['hp', 'atk', 'def', 'spd'].forEach(stat => {
    const val = document.getElementById(`slider-${stat}`).value;
    document.getElementById(`val-${stat}`).textContent = val;
  });
}

function showToast(msg, isError = false) {
  toast.textContent = msg;
  toast.style.background = isError ? '#ff0055' : '#00f0ff';
  toast.style.color = isError ? '#fff' : '#000';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}
