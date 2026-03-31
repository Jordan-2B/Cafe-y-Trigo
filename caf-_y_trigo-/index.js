const express = require('express');
const cors = require('cors');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// ── Servir archivos estáticos (HTML, CSS del frontend) ─────────────────────
app.use(express.static(__dirname));

// ── Rutas de datos ─────────────────────────────────────────────────────────
const GASTOS_PATH = './data/gastos.json';
const USUARIOS_PATH = './data/usuarios.json';

if (!fs.existsSync('./data')) fs.mkdirSync('./data');

// ── Sesiones en memoria: token → { usuario, rol, nombre } ─────────────────
const sesiones = new Map();

// ── Categorías predeterminadas (no se pueden eliminar) ─────────────────────
const CATS_DEFAULT = ['Granos', 'Panadería', 'Lácteos', 'Mantenimiento', 'Servicios'];

// ── Helpers ────────────────────────────────────────────────────────────────
function leerJSON(ruta, defecto) {
    try {
        if (!fs.existsSync(ruta)) return defecto;
        return JSON.parse(fs.readFileSync(ruta, 'utf-8'));
    } catch { return defecto; }
}
function guardarJSON(ruta, data) {
    fs.writeFileSync(ruta, JSON.stringify(data, null, 2));
}

// ── Middleware: verifica que el token sea válido ────────────────────────────
function verificarToken(req, res, next) {
    const token = req.headers['x-token'];
    if (!token || !sesiones.has(token))
        return res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
    req.sesion = sesiones.get(token);
    next();
}

// ── Middleware: solo permite al Administrador ──────────────────────────────
function soloAdmin(req, res, next) {
    if (req.sesion.rol !== 'Administrador')
        return res.status(403).json({ error: 'Solo el administrador puede realizar esta acción.' });
    next();
}

// ══════════════════════════════════════════════════════════════════════════
//  RUTAS API
// ══════════════════════════════════════════════════════════════════════════

// ── POST /api/login ────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
    const { usuario, password } = req.body;
    const { usuarios } = leerJSON(USUARIOS_PATH, { usuarios: [] });

    const user = usuarios.find(u => u.usuario === usuario && u.password === password);
    if (!user) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });

    const token = crypto.randomBytes(20).toString('hex');
    sesiones.set(token, { usuario: user.usuario, rol: user.rol, nombre: user.nombre });

    console.log(`✅ Login: ${user.nombre} (${user.rol})`);
    res.json({ token, rol: user.rol, nombre: user.nombre, usuario: user.usuario });
});

// ── POST /api/logout ───────────────────────────────────────────────────────
app.post('/api/logout', verificarToken, (req, res) => {
    sesiones.delete(req.headers['x-token']);
    res.json({ ok: true });
});

// ── GET /api/data ──────────────────────────────────────────────────────────
// Admin: ve todos los gastos. Trabajador: solo los suyos.
app.get('/api/data', verificarToken, (req, res) => {
    const data = leerJSON(GASTOS_PATH, { gastos: [], presupuesto: 500, categorias: [] });
    let gastos = data.gastos || [];

    if (req.sesion.rol === 'Trabajador')
        gastos = gastos.filter(g => g.usuario === req.sesion.nombre);

    const total = gastos.reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0);
    const categoriasExtra = data.categorias || [];
    const todasCategorias = [...new Set([...CATS_DEFAULT, ...categoriasExtra])];

    res.json({
        gastos,
        presupuesto: data.presupuesto || 500,
        total: total.toFixed(2),
        categorias: todasCategorias,
        categoriasCustom: categoriasExtra
    });
});

// ── POST /api/gastos ───────────────────────────────────────────────────────
app.post('/api/gastos', verificarToken, (req, res) => {
    const { monto, categoria, concepto } = req.body;
    if (!monto || !concepto)
        return res.status(400).json({ error: 'Monto y concepto son requeridos.' });

    const data = leerJSON(GASTOS_PATH, { gastos: [], presupuesto: 500, categorias: [] });
    if (!data.gastos) data.gastos = [];

    const nuevo = {
        id: Date.now(),
        fecha: new Date().toLocaleString('es-CO'),
        monto: parseFloat(monto),
        categoria,
        concepto,
        usuario: req.sesion.nombre
    };

    data.gastos.push(nuevo);
    guardarJSON(GASTOS_PATH, data);
    console.log(`📌 Gasto: $${monto} | ${categoria} | por ${req.sesion.nombre}`);
    res.status(201).json(nuevo);
});

// ── DELETE /api/gastos/:id  (solo admin) ───────────────────────────────────
app.delete('/api/gastos/:id', verificarToken, soloAdmin, (req, res) => {
    const data = leerJSON(GASTOS_PATH, { gastos: [] });
    const id = parseInt(req.params.id);
    const prev = data.gastos.length;

    data.gastos = data.gastos.filter(g => g.id !== id);
    if (data.gastos.length === prev)
        return res.status(404).json({ error: 'Registro no encontrado.' });

    guardarJSON(GASTOS_PATH, data);
    console.log(`🗑️  Gasto #${id} eliminado por ${req.sesion.nombre}`);
    res.json({ ok: true });
});

// ── GET /api/stats  (solo admin) ───────────────────────────────────────────
app.get('/api/stats', verificarToken, soloAdmin, (req, res) => {
    const data = leerJSON(GASTOS_PATH, { gastos: [] });
    const gastos = data.gastos || [];

    const porCategoria = {};
    const porUsuario = {};
    gastos.forEach(g => {
        porCategoria[g.categoria] = (porCategoria[g.categoria] || 0) + parseFloat(g.monto);
        porUsuario[g.usuario] = (porUsuario[g.usuario] || 0) + parseFloat(g.monto);
    });

    res.json({
        porCategoria,
        porUsuario,
        total: gastos.reduce((a, g) => a + parseFloat(g.monto), 0).toFixed(2),
        totalRegistros: gastos.length,
        presupuesto: data.presupuesto || 500
    });
});

// ── GET /api/categorias  (solo admin) ─────────────────────────────────────
app.get('/api/categorias', verificarToken, soloAdmin, (req, res) => {
    const data = leerJSON(GASTOS_PATH, { categorias: [] });
    res.json({ categorias: data.categorias || [] });
});

// ── POST /api/categorias  (solo admin) ────────────────────────────────────
app.post('/api/categorias', verificarToken, soloAdmin, (req, res) => {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido.' });

    const data = leerJSON(GASTOS_PATH, { gastos: [], presupuesto: 500, categorias: [] });
    if (!data.categorias) data.categorias = [];

    if (CATS_DEFAULT.includes(nombre) || data.categorias.includes(nombre))
        return res.status(400).json({ error: 'Esa categoría ya existe.' });

    data.categorias.push(nombre);
    guardarJSON(GASTOS_PATH, data);
    res.json({ categorias: data.categorias });
});

// ── DELETE /api/categorias/:nombre  (solo admin) ──────────────────────────
app.delete('/api/categorias/:nombre', verificarToken, soloAdmin, (req, res) => {
    const nombre = decodeURIComponent(req.params.nombre);

    if (CATS_DEFAULT.includes(nombre))
        return res.status(400).json({ error: 'No puedes eliminar una categoría predeterminada.' });

    const data = leerJSON(GASTOS_PATH, { gastos: [], presupuesto: 500, categorias: [] });
    data.categorias = (data.categorias || []).filter(c => c !== nombre);
    guardarJSON(GASTOS_PATH, data);
    res.json({ categorias: data.categorias });
});

// ──────────────────────────────────────────────────────────────────────────
app.listen(3000, () => {
    console.log('🚀 Café & Trigo corriendo en http://localhost:3000');
    console.log('👤 admin/admin123  |  trabajador1/pass123');
});