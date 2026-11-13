const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Inicializar SQLite
const db = new sqlite3.Database(path.join(__dirname, 'pokedex.db'), (err) => {
  if (err) {
    console.error('Error al conectar con SQLite:', err.message);
  } else {
    console.log('⚡ Conectado a la base de datos SQLite (pokedex.db)');
    initDatabase();
  }
});

// Crear tabla y auto-seed si está vacía
function initDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS pokemons (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      types TEXT NOT NULL,
      hp INTEGER DEFAULT 50,
      attack INTEGER DEFAULT 50,
      defense INTEGER DEFAULT 50,
      speed INTEGER DEFAULT 50,
      height REAL DEFAULT 1.0,
      weight REAL DEFAULT 10.0,
      image TEXT NOT NULL,
      sprite TEXT
    )
  `, (err) => {
    if (err) return console.error('Error creando tabla:', err.message);

    // Verificar si ya tiene datos
    db.get('SELECT COUNT(*) as count FROM pokemons', async (err, row) => {
      if (!err && row.count === 0) {
        console.log('🌱 Base de datos vacía. Sembrando los 100 pokémons desde PokeAPI...');
        await seedFromPokeAPI();
      } else {
        console.log(`✅ Base de datos lista con ${row.count} pokémons.`);
      }
    });
  });
}

// Seeder usando la API solicitada
async function seedFromPokeAPI() {
  const API_URL = 'https://pokeapi.co/api/v2/pokemon/?offset=20&limit=100';
  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    const pokemonList = data.results;

    console.log(`Descargando detalles de ${pokemonList.length} pokémons...`);

    const insertStmt = db.prepare(`
      INSERT INTO pokemons (id, name, types, hp, attack, defense, speed, height, weight, image, sprite)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Procesar en tandas
    for (const item of pokemonList) {
      try {
        const detailRes = await fetch(item.url);
        const p = await detailRes.json();

        const types = JSON.stringify(p.types.map(t => t.type.name));
        const hp = p.stats.find(s => s.stat.name === 'hp')?.base_stat || 50;
        const attack = p.stats.find(s => s.stat.name === 'attack')?.base_stat || 50;
        const defense = p.stats.find(s => s.stat.name === 'defense')?.base_stat || 50;
        const speed = p.stats.find(s => s.stat.name === 'speed')?.base_stat || 50;
        const height = p.height / 10; // metros
        const weight = p.weight / 10; // kg
        const image = p.sprites.other['official-artwork'].front_default || p.sprites.front_default;
        const sprite = p.sprites.other?.showdown?.front_default || p.sprites.front_default;

        insertStmt.run(p.id, p.name, types, hp, attack, defense, speed, height, weight, image, sprite);
      } catch (err) {
        console.error(`Error procesando ${item.name}:`, err.message);
      }
    }

    insertStmt.finalize();
    console.log('🎉 ¡100 Pokémons cargados exitosamente en la base de datos!');
  } catch (error) {
    console.error('Error al sembrar datos desde PokeAPI:', error);
  }
}

// ==========================================
// RUTAS DE LA API (RESTful y Alias directos)
// ==========================================

// 1. GET - Obtener todos los pokémons (con filtros opcionales de búsqueda y tipo)
app.get(['/api/pokemon', '/get'], (req, res) => {
  const { search, type, sort } = req.query;
  let query = 'SELECT * FROM pokemons WHERE 1=1';
  const params = [];

  if (search) {
    query += ' AND (name LIKE ? OR id = ?)';
    params.push(`%${search.toLowerCase()}%`, parseInt(search) || -1);
  }

  if (type && type !== 'all') {
    query += ' AND types LIKE ?';
    params.push(`%"${type.toLowerCase()}"%`);
  }

  // Ordenamiento
  if (sort === 'name') query += ' ORDER BY name ASC';
  else if (sort === 'attack') query += ' ORDER BY attack DESC';
  else if (sort === 'hp') query += ' ORDER BY hp DESC';
  else query += ' ORDER BY id ASC';

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const formatted = rows.map(r => ({ ...r, types: JSON.parse(r.types) }));
    res.json(formatted);
  });
});

// GET por ID
app.get(['/api/pokemon/:id', '/get/:id'], (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM pokemons WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Pokémon no encontrado' });
    res.json({ ...row, types: JSON.parse(row.types) });
  });
});

// 2. POST - Crear nuevo pokémon
app.post(['/api/pokemon', '/post'], (req, res) => {
  const { name, types, hp, attack, defense, speed, height, weight, image, sprite } = req.body;

  if (!name || !image) {
    return res.status(400).json({ error: 'Nombre e imagen son obligatorios' });
  }

  // Obtener el siguiente ID disponible
  db.get('SELECT MAX(id) as maxId FROM pokemons', (err, row) => {
    const nextId = (row?.maxId || 0) + 1;
    const typesJson = JSON.stringify(Array.isArray(types) ? types : [types || 'normal']);

    const query = `
      INSERT INTO pokemons (id, name, types, hp, attack, defense, speed, height, weight, image, sprite)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(query, [
      nextId,
      name.toLowerCase().trim(),
      typesJson,
      hp || 50,
      attack || 50,
      defense || 50,
      speed || 50,
      height || 1.0,
      weight || 10.0,
      image,
      sprite || image
    ], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({
        message: 'Pokémon creado con éxito',
        pokemon: {
          id: nextId,
          name,
          types: JSON.parse(typesJson),
          hp, attack, defense, speed, height, weight, image, sprite: sprite || image
        }
      });
    });
  });
});

// 3. PUT - Actualizar un pokémon existente
app.put(['/api/pokemon/:id', '/put/:id'], (req, res) => {
  const id = req.params.id;
  const { name, types, hp, attack, defense, speed, height, weight, image, sprite } = req.body;

  const typesJson = JSON.stringify(Array.isArray(types) ? types : [types || 'normal']);

  const query = `
    UPDATE pokemons
    SET name = COALESCE(?, name),
        types = COALESCE(?, types),
        hp = COALESCE(?, hp),
        attack = COALESCE(?, attack),
        defense = COALESCE(?, defense),
        speed = COALESCE(?, speed),
        height = COALESCE(?, height),
        weight = COALESCE(?, weight),
        image = COALESCE(?, image),
        sprite = COALESCE(?, sprite)
    WHERE id = ?
  `;

  db.run(query, [
    name ? name.toLowerCase().trim() : null,
    types ? typesJson : null,
    hp, attack, defense, speed, height, weight, image, sprite,
    id
  ], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Pokémon no encontrado' });
    res.json({ message: 'Pokémon actualizado con éxito', id });
  });
});

// 4. DELETE - Eliminar un pokémon
app.delete(['/api/pokemon/:id', '/delete/:id'], (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM pokemons WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Pokémon no encontrado' });
    res.json({ message: `Pokémon #${id} eliminado correctamente` });
  });
});

// Ruta para reiniciar la base de datos a los 100 originales
app.post('/api/reset', async (req, res) => {
  db.run('DELETE FROM pokemons', async (err) => {
    if (err) return res.status(500).json({ error: err.message });
    await seedFromPokeAPI();
    res.json({ message: 'Base de datos reiniciada con los 100 pokémons de PokeAPI' });
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en: http://localhost:${PORT}`);
});
