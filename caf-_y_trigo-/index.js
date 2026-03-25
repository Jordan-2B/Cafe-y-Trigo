const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = './data/gastos.json';

const app = express();
app.use(cors());
app.use(express.json());

// Crear carpeta si no existe
if (!fs.existsSync('./data')) fs.mkdirSync('./data');

// Función para crear un archivo limpio si hay errores
const inicializarArchivo = () => {
    const estructuraInicial = { gastos: [], presupuesto: 500 };
    fs.writeFileSync(path, JSON.stringify(estructuraInicial, null, 2));
    return estructuraInicial;
};

// RUTA: OBTENER DATOS
app.get('/api/data', (req, res) => {
    try {
        if (!fs.existsSync(path)) return res.json(inicializarArchivo());

        const contenido = fs.readFileSync(path, 'utf-8');
        const data = JSON.parse(contenido);

        // AQUÍ ESTABA EL ERROR: Validamos que 'gastos' exista antes de usar reduce
        const listaGastos = data.gastos || [];
        const total = listaGastos.reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0);

        res.json({
            gastos: listaGastos,
            presupuesto: data.presupuesto || 500,
            total: total.toFixed(2)
        });
    } catch (error) {
        console.error("Error al leer, reiniciando archivo...");
        res.json(inicializarArchivo());
    }
});

// RUTA: GUARDAR GASTO
app.post('/api/gastos', (req, res) => {
    try {
        const { monto, categoria, concepto, usuario } = req.body;
        
        let data;
        try {
            data = JSON.parse(fs.readFileSync(path, 'utf-8'));
            if (!data.gastos) data = { gastos: [], presupuesto: 500 };
        } catch (e) {
            data = { gastos: [], presupuesto: 500 };
        }

        const nuevoGasto = {
            id: Date.now(),
            fecha: new Date().toLocaleString(),
            monto: parseFloat(monto),
            categoria,
            concepto,
            usuario: usuario || "Desconocido"
        };

        data.gastos.push(nuevoGasto);
        fs.writeFileSync(path, JSON.stringify(data, null, 2));
        
        console.log(`✅ Registrado: $${monto} por ${usuario}`);
        res.status(201).json(nuevoGasto);
    } catch (error) {
        console.error("Error al guardar:", error);
        res.status(500).json({ error: "No se pudo guardar el gasto" });
    }
});

app.listen(3000, () => {
    console.log("🚀 Servidor corregido y funcionando en el puerto 3000");
});