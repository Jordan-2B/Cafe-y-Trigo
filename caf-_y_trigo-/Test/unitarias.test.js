// __tests__/unitarias.test.js
//
// PRUEBAS UNITARIAS — Café & Trigo
// Herramienta: Jest
// Qué se prueba: cada función por separado, sin tocar archivos reales ni el servidor
// Comando para correr: npm run test:unit
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. Indicamos a Jest que simule el módulo 'fs' ─────────────────────────
//    Esto significa que ninguna prueba leerá ni escribirá archivos reales
jest.mock('fs');
const fs = require('fs');

// ── 2. Importamos las funciones que vamos a probar ────────────────────────
const {
    leerJSON,
    guardarJSON,
    verificarToken,
    soloAdmin,
    sesiones,
    CATS_DEFAULT
} = require('../helpers');


// ══════════════════════════════════════════════════════════════════════════
//  BLOQUE 1: leerJSON
//  Qué hace: lee un archivo JSON del disco y lo convierte en objeto JS.
//  Si algo falla, devuelve el valor por defecto que le pasamos.
// ══════════════════════════════════════════════════════════════════════════
describe('leerJSON()', () => {

    // Antes de cada prueba limpiamos los mocks para que no se mezclen
    beforeEach(() => jest.clearAllMocks());

    // ── PRUEBA 1.1 ─────────────────────────────────────────────────────
    // Situación: el archivo NO existe
    // Esperado:  que devuelva el objeto por defecto sin lanzar error
    test('devuelve el valor por defecto si el archivo no existe', () => {
        fs.existsSync.mockReturnValue(false); // simulamos que el archivo no existe

        const resultado = leerJSON('./data/gastos.json', { gastos: [] });

        expect(resultado).toEqual({ gastos: [] });
    });

    // ── PRUEBA 1.2 ─────────────────────────────────────────────────────
    // Situación: el archivo existe y tiene JSON válido
    // Esperado:  que devuelva el objeto correctamente deserializado
    test('devuelve el objeto correcto si el archivo tiene JSON válido', () => {
        const contenidoFalso = JSON.stringify({ gastos: [{ id: 1, monto: 5000 }] });
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue(contenidoFalso); // simulamos que el archivo tiene este contenido

        const resultado = leerJSON('./data/gastos.json', { gastos: [] });

        expect(resultado.gastos).toHaveLength(1);
        expect(resultado.gastos[0].monto).toBe(5000);
    });

    // ── PRUEBA 1.3 ─────────────────────────────────────────────────────
    // Situación: el archivo existe pero está dañado (no es JSON válido)
    // Esperado:  que devuelva el objeto por defecto SIN crashear el servidor
    test('devuelve el valor por defecto si el JSON está dañado o corrupto', () => {
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue('{ esto no es json válido @@##'); // archivo dañado

        const resultado = leerJSON('./data/gastos.json', { gastos: [] });

        expect(resultado).toEqual({ gastos: [] });
    });
});


// ══════════════════════════════════════════════════════════════════════════
//  BLOQUE 2: guardarJSON
//  Qué hace: convierte un objeto JS a texto JSON y lo guarda en un archivo
// ══════════════════════════════════════════════════════════════════════════
describe('guardarJSON()', () => {

    beforeEach(() => jest.clearAllMocks());

    // ── PRUEBA 2.1 ─────────────────────────────────────────────────────
    // Situación: guardamos un objeto con datos
    // Esperado:  que writeFileSync sea llamado con el JSON correcto
    test('llama a writeFileSync con el contenido JSON serializado', () => {
        const datos = { gastos: [{ id: 1, concepto: 'Café' }] };

        guardarJSON('./data/gastos.json', datos);

        // Verificamos que SÍ se intentó escribir el archivo
        expect(fs.writeFileSync).toHaveBeenCalledTimes(1);

        // Verificamos que el contenido escrito es el JSON correcto
        const contenidoEscrito = fs.writeFileSync.mock.calls[0][1];
        const objetoRecuperado = JSON.parse(contenidoEscrito);
        expect(objetoRecuperado.gastos[0].concepto).toBe('Café');
    });

    // ── PRUEBA 2.2 ─────────────────────────────────────────────────────
    // Situación: guardamos con la ruta correcta
    // Esperado:  que use exactamente la ruta que le pasamos
    test('guarda en la ruta indicada', () => {
        guardarJSON('./data/usuarios.json', { usuarios: [] });

        const rutaUsada = fs.writeFileSync.mock.calls[0][0];
        expect(rutaUsada).toBe('./data/usuarios.json');
    });
});


// ══════════════════════════════════════════════════════════════════════════
//  BLOQUE 3: verificarToken (Middleware)
//  Qué hace: revisa si la petición tiene un token válido en el header x-token
//  Si no lo tiene → responde 401 (no autorizado)
//  Si lo tiene   → deja pasar la petición y adjunta la sesión
// ══════════════════════════════════════════════════════════════════════════
describe('verificarToken()', () => {

    // Antes de cada prueba limpiamos las sesiones activas
    beforeEach(() => sesiones.clear());

    // ── PRUEBA 3.1 ─────────────────────────────────────────────────────
    // Situación: la petición llega SIN el header x-token
    // Esperado:  que responda 401 y NO llame a next()
    test('responde 401 si la petición no trae token', () => {
        // Simulamos el objeto req (petición) sin header x-token
        const req = { headers: {} };
        // Simulamos el objeto res (respuesta) con funciones de Jest
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        verificarToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'No autorizado. Inicia sesión.' });
        expect(next).not.toHaveBeenCalled(); // next() NO debe ejecutarse
    });

    // ── PRUEBA 3.2 ─────────────────────────────────────────────────────
    // Situación: la petición llega con un token que NO existe en sesiones
    // Esperado:  que responda 401
    test('responde 401 si el token no corresponde a ninguna sesión activa', () => {
        const req = { headers: { 'x-token': 'token-inventado-que-no-existe' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        verificarToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    // ── PRUEBA 3.3 ─────────────────────────────────────────────────────
    // Situación: la petición llega con un token VÁLIDO que sí existe
    // Esperado:  que llame a next() y adjunte la sesión a req.sesion
    test('llama a next() y adjunta la sesión si el token es válido', () => {
        // Primero registramos una sesión activa
        sesiones.set('token-valido-123', {
            usuario: 'admin',
            rol: 'Administrador',
            nombre: 'Administrador'
        });

        const req = { headers: { 'x-token': 'token-valido-123' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        verificarToken(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);    // next() SÍ debe ejecutarse
        expect(req.sesion.rol).toBe('Administrador'); // la sesión queda en req
        expect(res.status).not.toHaveBeenCalled(); // NO debe haber error
    });
});


// ══════════════════════════════════════════════════════════════════════════
//  BLOQUE 4: soloAdmin (Middleware)
//  Qué hace: después de verificarToken, verifica que el usuario sea Admin
//  Si no es admin → responde 403 (prohibido)
//  Si es admin    → deja pasar
// ══════════════════════════════════════════════════════════════════════════
describe('soloAdmin()', () => {

    // ── PRUEBA 4.1 ─────────────────────────────────────────────────────
    // Situación: el usuario tiene rol Trabajador
    // Esperado:  que responda 403 y NO llame a next()
    test('responde 403 si el usuario es Trabajador', () => {
        const req = { sesion: { rol: 'Trabajador', nombre: 'Juan López' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        soloAdmin(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Solo el administrador puede realizar esta acción.'
        });
        expect(next).not.toHaveBeenCalled();
    });

    // ── PRUEBA 4.2 ─────────────────────────────────────────────────────
    // Situación: el usuario tiene rol Administrador
    // Esperado:  que llame a next() sin responder error
    test('llama a next() si el usuario es Administrador', () => {
        const req = { sesion: { rol: 'Administrador', nombre: 'Administrador' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        soloAdmin(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });
});


// ══════════════════════════════════════════════════════════════════════════
//  BLOQUE 5: CATS_DEFAULT (constante)
//  Verificamos que las categorías predeterminadas sean las correctas
// ══════════════════════════════════════════════════════════════════════════
describe('CATS_DEFAULT', () => {

    // ── PRUEBA 5.1 ─────────────────────────────────────────────────────
    test('contiene exactamente las 5 categorías predeterminadas del sistema', () => {
        expect(CATS_DEFAULT).toHaveLength(5);
        expect(CATS_DEFAULT).toContain('Granos');
        expect(CATS_DEFAULT).toContain('Panadería');
        expect(CATS_DEFAULT).toContain('Lácteos');
        expect(CATS_DEFAULT).toContain('Mantenimiento');
        expect(CATS_DEFAULT).toContain('Servicios');
    });

    // ── PRUEBA 5.2 ─────────────────────────────────────────────────────
    test('no contiene categorías no definidas', () => {
        expect(CATS_DEFAULT).not.toContain('Empaques');
        expect(CATS_DEFAULT).not.toContain('Transporte');
    });
});
