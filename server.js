require('dotenv').config(); // Cargar variables de entorno desde el archivo .env
const express = require('express');
const cors = require('cors'); // Importa CORS
const { Client } = require('whatsapp-web.js');
// const qrcode = require('qrcode-terminal');
const qrcode = require('qrcode');
const app = express();

const corsOptions = {
    origin: process.env.NODE_ENV === 'production' ? 'https://notificaciones-clientes-autosleo.onrender.com' : 'http://localhost:3000',
    methods: ['GET', 'POST'],
};
app.use(cors(corsOptions));

// Usar CORS para permitir solicitudes del frontend
// app.use(cors());

app.use(express.json());
// Archivos estáticos
app.use(express.static(__dirname));

// Inicializamos el cliente de WhatsApp
const client = new Client();

let whatsappListo = false;
let qrData = null; // Almacenar el último QR generado
let qrEsperando = false; // Indica si se está esperando que el QR sea escaneado
let qrTiempoEspera = null; // Variable para controlar el tiempo de espera del QR

// Solo generamos el QR cuando el cliente haga clic en el boton de WhatsApp
client.on('qr', (qr) => {
    console.log('QR generado:', qr);  // Este es el QR crudo de WhatsApp Web.
    qrData = qr;

    // Si es la primera vez que se genera el QR, empezar a esperar
    if (!qrEsperando) {
        qrEsperando = true; // Indicamos que estamos esperando que se escanee el QR
        // Configurar un tiempo de espera para el Qr
        clearTimeout(qrTiempoEspera);
        qrTiempoEspera = setTimeout(() => {
            console.log('Tiempo de espera del QR ha expirado');
            qrEsperando = false;
        }, 120000); // 2 minutos
    }
});

// Ruta para obtener el QR
app.get('/get-qrcode', (req, res) => {
    console.log('Solicitud recibida para obtener el QR');

    // Verifica si hay un QR disponible
    if (!qrEsperando || !qrData) {
        return res.status(400).json({ error: 'El tiempo para escanear el código QR ha caducado. Por favor, genera un nuevo código QR y escanéalo lo más pronto posible.' });
    }

    // Generar URL base64 del QR más reciente
    qrcode.toDataURL(qrData, (err, url) => {
        if (err) {
            console.error('Error al generar el QR:', err);
            return res.status(500).json({ error: 'Error al generar el QR' });
        }

        // Enviar la URL del QR generado en base64 al frontend
        res.json({ qrUrl: url });
    });
});

client.on('ready', () => {
    console.log('WhatsApp Web está listo');
    whatsappListo = true; // Marcar que WhatsApp Web está listo
    qrEsperando = false; // Detener la espera del QR cuando ya está listo
});

client.initialize();

// Ruta para verificar si WhatsApp Web está listo
app.get('/whatsapp-ready', (req, res) => {
    // Verificamos solo si no estamos esperando el QR
    if (!qrEsperando && whatsappListo) {
        console.log('WhatsApp Web está listo:', whatsappListo);
        return res.json({ ready: whatsappListo });
    }

    console.log('Aún esperando el QR...');
    res.json({ ready: false });
});

// Función para formatear el número de teléfono
function formatearTelefono(telefono) {

    const telefonoString = telefono.toString();

    // Elimina cualquier caracter no numérico (como guiones o espacios)
    const telefonoFormateado = telefonoString.replace(/[^\d]/g, '');

    // Verifica si ya tiene el código de país +57 al inicio
    if (!telefonoFormateado.startsWith('57')) {
        // Si no lo tiene, añade el código de país (+57)
        return '57' + telefonoFormateado;  // Para Colombia
    }

    return telefonoFormateado;  // Ya tiene el código de país, lo dejamos como está
}

// Recibe los datos del frontend
app.post('/enviar-mensaje', async (req, res) => {
    const { telefono, mensaje } = req.body;

    // Formatear el número de teléfono
    const telefonoFormateado = formatearTelefono(telefono);

    console.log(`Recibiendo mensaje para enviar a ${telefonoFormateado}: ${mensaje}`);

    try {
        // Enviar el mensaje al chat correspondiente
        const chat = await client.getChatById(`${telefonoFormateado}@c.us`);
        await chat.sendMessage(mensaje);
        console.log('Mensaje enviado:', mensaje);
        res.status(200).json({ message: 'Mensaje enviado' });
    } catch (error) {
        console.error('Error al enviar el mensaje:', error);
        res.status(500).json({ error: 'Error al enviar el mensaje' });
    }
});

// Ruta para cerrar sesión
app.post('/cerrar-sesion', (req, res) => {
    if (client) {
        // Intentar cerrar la sesión y destruir el cliente
        client.logout().then(() => {
            console.log("Sesión cerrada exitosamente.");
            whatsappListo = false; // Restablecer estado 'listo'
            client.destroy(); // Asegurarse de destruir el cliente
            console.log("Cliente destruido.");

            // Reiniciar el cliente para generar nuevo QR
            client.initialize().then(() => {
                console.log("Cliente reiniciado correctamente.");
                res.status(200).json({ message: 'Sesión cerrada y cliente reiniciado' });
            }).catch(err => {
                console.error("Error al reiniciar el cliente:", err);
                res.status(500).json({ error: 'Error al reiniciar el cliente' });
            });
        }).catch(err => {
            console.error("Error al cerrar sesión:", err);
            res.status(500).json({ error: 'Error al cerrar sesión' });
        });
    } else {
        res.status(400).json({ error: 'No se ha iniciado sesión' });
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});