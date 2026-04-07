// Test/integracion.test.js
//
// PRUEBAS DE INTEGRACIÓN — Café & Trigo
// Herramienta: Jest + Supertest
//
// Qué se prueba: los endpoints reales del servidor Express
// Supertest levanta y apaga el servidor automáticamente sin ocupar puertos
// Comando para correr: npm run test:integration
// ─────────────────────────────────────────────────────────────────────────────

const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../index');

// ── Rutas de archivos de prueba (separados de los datos reales) ───────────
const DATA_DIR = path.join(__dirname, '../data');
const GASTOS_TEST = path.join(DATA_DIR, 'gastos.json');
const USUARIOS_TEST = path.join(DATA_DIR, 'usuarios.json');

// ── Datos de prueba que se cargan antes de cada bloque ────────────────────
const usuariosPrueba = {
    usuarios: [
        {
            id: 1, usuario: 'admin', password: 'admin123',
            rol: 'Administrador', nombre: 'Administrador'
        },
        {
            id: 2, usuario: 'trabajador1', password: 'pass123',
            rol: 'Trabajador', nombre: 'Juan López'
        }
    ]
};

const gastosPrueba = {
    gastos: [
        {
            id: 1000, fecha: '1/4/2026', monto: 50000,
            categoria: 'Granos', concepto: 'Café tostado', usuario: 'Administrador'
        },
        {
            id: 2000, fecha: '1/4/2026', monto: 20000,
            categoria: 'Panadería', concepto: 'Harina de trigo', usuario: 'Juan López'
        }
    ],
    presupuesto: 500000,
    categorias: []
};

// ── Antes de TODOS los bloques: restaurar archivos de prueba ──────────────
beforeAll(() => {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
    fs.writeFileSync(USUARIOS_TEST, JSON.stringify(usuariosPrueba, null, 2));
    fs.writeFileSync(GASTOS_TEST, JSON.stringify(gastosPrueba, null, 2));
});

// ── Antes de CADA prueba: restaurar el estado limpio de gastos ────────────
beforeEach(() => {
    fs.writeFileSync(GASTOS_TEST, JSON.stringify(gastosPrueba, null, 2));
});

// ── Después de TODOS los bloques: dejar los archivos limpios ─────────────
afterAll(() => {
    fs.writeFileSync(GASTOS_TEST, JSON.stringify({ gastos: [], presupuesto: 500000, categorias: [] }, null, 2));
});


// ══════════════════════════════════════════════════════════════════════════
//  BLOQUE 1: POST /api/login
//  Qué prueba: que el inicio de sesión funcione correctamente
// ══════════════════════════════════════════════════════════════════════════
describe('POST /api/login', () => {

    // ── PRUEBA 1.1 ─────────────────────────────────────────────────────
    // Situación: credenciales correctas de Administrador
    // Esperado:  HTTP 200 con token, rol y nombre
    test('devuelve token y datos del usuario con credenciales correctas', async () => {
        const respuesta = await request(app)
            .post('/api/login')
            .send({ usuario: 'admin', password: 'admin123' });

        expect(respuesta.status).toBe(200);
        expect(respuesta.body).toHaveProperty('token');   // tiene token
        expect(respuesta.body.rol).toBe('Administrador'); // rol correcto
        expect(respuesta.body.nombre).toBe('Administrador');
    });

    // ── PRUEBA 1.2 ─────────────────────────────────────────────────────
    // Situación: contraseña incorrecta
    // Esperado:  HTTP 401 con mensaje de error
    test('devuelve 401 con contraseña incorrecta', async () => {
        const respuesta = await request(app)
            .post('/api/login')
            .send({ usuario: 'admin', password: 'contraseña_mal' });

        expect(respuesta.status).toBe(401);
        expect(respuesta.body.error).toBe('Usuario o contraseña incorrectos.');
    });

    // ── PRUEBA 1.3 ─────────────────────────────────────────────────────
    // Situación: usuario que no existe en el sistema
    // Esperado:  HTTP 401
    test('devuelve 401 con usuario inexistente', async () => {
        const respuesta = await request(app)
            .post('/api/login')
            .send({ usuario: 'fantasma', password: '1234' });

        expect(respuesta.status).toBe(401);
    });

    // ── PRUEBA 1.4 ─────────────────────────────────────────────────────
    // Situación: login exitoso del Trabajador
    // Esperado:  HTTP 200 con rol Trabajador
    test('devuelve token para el Trabajador con credenciales correctas', async () => {
        const respuesta = await request(app)
            .post('/api/login')
            .send({ usuario: 'trabajador1', password: 'pass123' });

        expect(respuesta.status).toBe(200);
        expect(respuesta.body.rol).toBe('Trabajador');
        expect(respuesta.body.nombre).toBe('Juan López');
    });
});


// ══════════════════════════════════════════════════════════════════════════
//  BLOQUE 2: GET /api/data
//  Qué prueba: que la consulta de datos respete los roles
// ══════════════════════════════════════════════════════════════════════════
describe('GET /api/data', () => {

    let tokenAdmin, tokenTrabajador;

    // Antes de este bloque hacemos login para obtener los tokens
    beforeAll(async () => {
        const loginAdmin = await request(app)
            .post('/api/login')
            .send({ usuario: 'admin', password: 'admin123' });
        tokenAdmin = loginAdmin.body.token;

        const loginTrabajador = await request(app)
            .post('/api/login')
            .send({ usuario: 'trabajador1', password: 'pass123' });
        tokenTrabajador = loginTrabajador.body.token;
    });

    // ── PRUEBA 2.1 ─────────────────────────────────────────────────────
    // Situación: petición sin token
    // Esperado:  HTTP 401
    test('devuelve 401 sin token', async () => {
        const respuesta = await request(app).get('/api/data');
        expect(respuesta.status).toBe(401);
    });

    // ── PRUEBA 2.2 ─────────────────────────────────────────────────────
    // Situación: Administrador consulta los datos
    // Esperado:  HTTP 200 con TODOS los gastos (2 gastos de prueba)
    test('el Administrador ve todos los gastos', async () => {
        const respuesta = await request(app)
            .get('/api/data')
            .set('x-token', tokenAdmin);

        expect(respuesta.status).toBe(200);
        expect(respuesta.body.gastos).toHaveLength(2); // ve los 2 gastos
        expect(respuesta.body).toHaveProperty('total');
        expect(respuesta.body).toHaveProperty('categorias');
    });

    // ── PRUEBA 2.3 ─────────────────────────────────────────────────────
    // Situación: Trabajador consulta los datos
    // Esperado:  solo ve SUS gastos (1 gasto de Juan López)
    test('el Trabajador solo ve sus propios gastos', async () => {
        const respuesta = await request(app)
            .get('/api/data')
            .set('x-token', tokenTrabajador);

        expect(respuesta.status).toBe(200);
        expect(respuesta.body.gastos).toHaveLength(1); // solo 1 gasto suyo
        expect(respuesta.body.gastos[0].usuario).toBe('Juan López');
    });

    // ── PRUEBA 2.4 ─────────────────────────────────────────────────────
    // Situación: verificar que las categorías predeterminadas están siempre
    // Esperado:  array de categorías incluye las 5 por defecto
    test('la respuesta incluye las categorías predeterminadas', async () => {
        const respuesta = await request(app)
            .get('/api/data')
            .set('x-token', tokenAdmin);

        expect(respuesta.body.categorias).toContain('Granos');
        expect(respuesta.body.categorias).toContain('Panadería');
        expect(respuesta.body.categorias).toContain('Lácteos');
    });
});


// ══════════════════════════════════════════════════════════════════════════
//  BLOQUE 3: POST /api/gastos
//  Qué prueba: que se puedan registrar gastos correctamente
// ══════════════════════════════════════════════════════════════════════════
describe('POST /api/gastos', () => {

    let tokenAdmin, tokenTrabajador;

    beforeAll(async () => {
        const r1 = await request(app).post('/api/login').send({ usuario: 'admin', password: 'admin123' });
        tokenAdmin = r1.body.token;

        const r2 = await request(app).post('/api/login').send({ usuario: 'trabajador1', password: 'pass123' });
        tokenTrabajador = r2.body.token;
    });

    // ── PRUEBA 3.1 ─────────────────────────────────────────────────────
    // Situación: registro de gasto con todos los datos correctos
    // Esperado:  HTTP 201 y el gasto creado con los datos enviados
    test('registra un gasto correctamente con datos válidos', async () => {
        const respuesta = await request(app)
            .post('/api/gastos')
            .set('x-token', tokenAdmin)
            .send({ monto: 75000, categoria: 'Granos', concepto: 'Café especial' });

        expect(respuesta.status).toBe(201);
        expect(respuesta.body.monto).toBe(75000);
        expect(respuesta.body.categoria).toBe('Granos');
        expect(respuesta.body.concepto).toBe('Café especial');
        expect(respuesta.body.usuario).toBe('Administrador'); // usa el nombre de la sesión
        expect(respuesta.body).toHaveProperty('id');
        expect(respuesta.body).toHaveProperty('fecha');
    });

    // ── PRUEBA 3.2 ─────────────────────────────────────────────────────
    // Situación: registro sin concepto (campo obligatorio)
    // Esperado:  HTTP 400 con mensaje de error
    test('devuelve 400 si falta el concepto', async () => {
        const respuesta = await request(app)
            .post('/api/gastos')
            .set('x-token', tokenAdmin)
            .send({ monto: 30000, categoria: 'Lácteos' }); // sin concepto

        expect(respuesta.status).toBe(400);
        expect(respuesta.body.error).toBe('Monto y concepto son requeridos.');
    });

    // ── PRUEBA 3.3 ─────────────────────────────────────────────────────
    // Situación: el Trabajador registra un gasto
    // Esperado:  el gasto queda a nombre de Juan López (no de admin)
    test('el gasto queda asociado al nombre del trabajador que lo registra', async () => {
        const respuesta = await request(app)
            .post('/api/gastos')
            .set('x-token', tokenTrabajador)
            .send({ monto: 15000, categoria: 'Panadería', concepto: 'Levadura' });

        expect(respuesta.status).toBe(201);
        expect(respuesta.body.usuario).toBe('Juan López');
    });

    // ── PRUEBA 3.4 ─────────────────────────────────────────────────────
    // Situación: registrar sin token
    // Esperado:  HTTP 401
    test('devuelve 401 si no hay token', async () => {
        const respuesta = await request(app)
            .post('/api/gastos')
            .send({ monto: 10000, categoria: 'Granos', concepto: 'Prueba' });

        expect(respuesta.status).toBe(401);
    });
});


// ══════════════════════════════════════════════════════════════════════════
//  BLOQUE 4: DELETE /api/gastos/:id
//  Qué prueba: que solo el admin pueda eliminar gastos
// ══════════════════════════════════════════════════════════════════════════
describe('DELETE /api/gastos/:id', () => {

    let tokenAdmin, tokenTrabajador;

    beforeAll(async () => {
        const r1 = await request(app).post('/api/login').send({ usuario: 'admin', password: 'admin123' });
        tokenAdmin = r1.body.token;

        const r2 = await request(app).post('/api/login').send({ usuario: 'trabajador1', password: 'pass123' });
        tokenTrabajador = r2.body.token;
    });

    // ── PRUEBA 4.1 ─────────────────────────────────────────────────────
    // Situación: el Admin elimina un gasto que existe
    // Esperado:  HTTP 200 con ok: true
    test('el Administrador puede eliminar un gasto existente', async () => {
        const respuesta = await request(app)
            .delete('/api/gastos/1000') // ID del gasto de prueba
            .set('x-token', tokenAdmin);

        expect(respuesta.status).toBe(200);
        expect(respuesta.body.ok).toBe(true);
    });

    // ── PRUEBA 4.2 ─────────────────────────────────────────────────────
    // Situación: el Trabajador intenta eliminar un gasto
    // Esperado:  HTTP 403 bloqueado
    test('el Trabajador NO puede eliminar gastos', async () => {
        const respuesta = await request(app)
            .delete('/api/gastos/1000')
            .set('x-token', tokenTrabajador);

        expect(respuesta.status).toBe(403);
        expect(respuesta.body.error).toBe('Solo el administrador puede realizar esta acción.');
    });

    // ── PRUEBA 4.3 ─────────────────────────────────────────────────────
    // Situación: el Admin intenta eliminar un ID que no existe
    // Esperado:  HTTP 404
    test('devuelve 404 si el gasto no existe', async () => {
        const respuesta = await request(app)
            .delete('/api/gastos/9999999') // ID que no existe
            .set('x-token', tokenAdmin);

        expect(respuesta.status).toBe(404);
        expect(respuesta.body.error).toBe('Registro no encontrado.');
    });
});


// ══════════════════════════════════════════════════════════════════════════
//  BLOQUE 5: POST y DELETE /api/categorias
//  Qué prueba: gestión de categorías personalizadas (solo admin)
// ══════════════════════════════════════════════════════════════════════════
describe('Gestión de /api/categorias', () => {

    let tokenAdmin, tokenTrabajador;

    beforeAll(async () => {
        const r1 = await request(app).post('/api/login').send({ usuario: 'admin', password: 'admin123' });
        tokenAdmin = r1.body.token;

        const r2 = await request(app).post('/api/login').send({ usuario: 'trabajador1', password: 'pass123' });
        tokenTrabajador = r2.body.token;
    });

    // ── PRUEBA 5.1 ─────────────────────────────────────────────────────
    // Situación: crear una categoría nueva
    // Esperado:  HTTP 200 y la categoría aparece en la lista
    test('el Admin crea una categoría nueva correctamente', async () => {
        const respuesta = await request(app)
            .post('/api/categorias')
            .set('x-token', tokenAdmin)
            .send({ nombre: 'Empaques' });

        expect(respuesta.status).toBe(200);
        expect(respuesta.body.categorias).toContain('Empaques');
    });

    // ── PRUEBA 5.2 ─────────────────────────────────────────────────────
    // Situación: crear una categoría que ya existe
    // Esperado:  HTTP 400 con mensaje de error
    test('devuelve 400 al intentar crear una categoría duplicada', async () => {
        // Primero la creamos
        await request(app)
            .post('/api/categorias')
            .set('x-token', tokenAdmin)
            .send({ nombre: 'Utensilios' });

        // La intentamos crear de nuevo
        const respuesta = await request(app)
            .post('/api/categorias')
            .set('x-token', tokenAdmin)
            .send({ nombre: 'Utensilios' });

        expect(respuesta.status).toBe(400);
        expect(respuesta.body.error).toBe('Esa categoría ya existe.');
    });

    // ── PRUEBA 5.3 ─────────────────────────────────────────────────────
    // Situación: intentar eliminar una categoría predeterminada
    // Esperado:  HTTP 400 bloqueado
    test('NO se puede eliminar una categoría predeterminada', async () => {
        const respuesta = await request(app)
            .delete('/api/categorias/Granos')
            .set('x-token', tokenAdmin);

        expect(respuesta.status).toBe(400);
        expect(respuesta.body.error).toBe('No puedes eliminar una categoría predeterminada.');
    });

    // ── PRUEBA 5.4 ─────────────────────────────────────────────────────
    // Situación: el Trabajador intenta crear una categoría
    // Esperado:  HTTP 403 bloqueado
    test('el Trabajador NO puede crear categorías', async () => {
        const respuesta = await request(app)
            .post('/api/categorias')
            .set('x-token', tokenTrabajador)
            .send({ nombre: 'Bebidas' });

        expect(respuesta.status).toBe(403);
    });
});


// ══════════════════════════════════════════════════════════════════════════
//  BLOQUE 6: GET /api/stats
//  Qué prueba: que las estadísticas solo las vea el admin
// ══════════════════════════════════════════════════════════════════════════
describe('GET /api/stats', () => {

    let tokenAdmin, tokenTrabajador;

    beforeAll(async () => {
        const r1 = await request(app).post('/api/login').send({ usuario: 'admin', password: 'admin123' });
        tokenAdmin = r1.body.token;

        const r2 = await request(app).post('/api/login').send({ usuario: 'trabajador1', password: 'pass123' });
        tokenTrabajador = r2.body.token;
    });

    // ── PRUEBA 6.1 ─────────────────────────────────────────────────────
    // Situación: Admin consulta las estadísticas
    // Esperado:  HTTP 200 con datos completos
    test('el Administrador puede ver las estadísticas', async () => {
        const respuesta = await request(app)
            .get('/api/stats')
            .set('x-token', tokenAdmin);

        expect(respuesta.status).toBe(200);
        expect(respuesta.body).toHaveProperty('porCategoria');
        expect(respuesta.body).toHaveProperty('porUsuario');
        expect(respuesta.body).toHaveProperty('total');
        expect(respuesta.body).toHaveProperty('totalRegistros');
    });

    // ── PRUEBA 6.2 ─────────────────────────────────────────────────────
    // Situación: Trabajador intenta ver las estadísticas
    // Esperado:  HTTP 403 bloqueado
    test('el Trabajador NO puede ver las estadísticas', async () => {
        const respuesta = await request(app)
            .get('/api/stats')
            .set('x-token', tokenTrabajador);

        expect(respuesta.status).toBe(403);
    });

    // ── PRUEBA 6.3 ─────────────────────────────────────────────────────
    // Situación: el total debe coincidir con la suma de los gastos de prueba
    // Esperado:  total = 50000 + 20000 = 70000
    test('el total refleja la suma correcta de todos los gastos', async () => {
        const respuesta = await request(app)
            .get('/api/stats')
            .set('x-token', tokenAdmin);

        expect(parseFloat(respuesta.body.total)).toBe(70000);
        expect(respuesta.body.totalRegistros).toBe(2);
    });
});