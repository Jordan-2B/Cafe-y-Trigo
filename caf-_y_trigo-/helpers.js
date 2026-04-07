// helpers.js
// Funciones utilitarias separadas de index.js para poder probarlas con Jest
const fs = require('fs');

// ── Sesiones en memoria ────────────────────────────────────────────────────
const sesiones = new Map();

// ── Categorías predeterminadas ─────────────────────────────────────────────
const CATS_DEFAULT = ['Granos', 'Panadería', 'Lácteos', 'Mantenimiento', 'Servicios'];

// ── leerJSON: lee un archivo JSON, si falla devuelve el valor por defecto ──
const leerJSON = (ruta, defecto) => {
    try {
        if (!fs.existsSync(ruta)) return defecto;
        return JSON.parse(fs.readFileSync(ruta, 'utf-8'));
    } catch {
        return defecto;
    }
};

// ── guardarJSON: guarda un objeto como JSON en disco ───────────────────────
const guardarJSON = (ruta, data) =>
    fs.writeFileSync(ruta, JSON.stringify(data, null, 2));

// ── verificarToken: middleware que valida el token de sesión ───────────────
const verificarToken = (req, res, next) => {
    const token = req.headers['x-token'];
    if (!token || !sesiones.has(token))
        return res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
    req.sesion = sesiones.get(token);
    next();
};

// ── soloAdmin: middleware que bloquea a los no administradores ─────────────
const soloAdmin = (req, res, next) => {
    if (req.sesion.rol !== 'Administrador')
        return res.status(403).json({ error: 'Solo el administrador puede realizar esta acción.' });
    next();
};

module.exports = { leerJSON, guardarJSON, verificarToken, soloAdmin, sesiones, CATS_DEFAULT };
