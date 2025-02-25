let clientesRegistrados = [];
let tiempoLimiteQR = 20000; // Tiempo de espera es de 20 seg
let contadorTiempoQR;
let intervaloVerificacion;

function verificarArchivo() {
    // Limpiar la lista de personas no pagadas
    clientesRegistrados = [];

    const inputArchivo = document.getElementById('inputArchivo');
    const archivo = inputArchivo.files[0];

    if (!archivo) {
        alert("No se ha seleccionado ningún archivo.");
        return;
    }

    // Leer el archivo de Excel
    const reader = new FileReader();

    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const libro = XLSX.read(data, { type: 'array' });

            // Seleccionamos la primera hoja del archivo
            const hoja = libro.Sheets[libro.SheetNames[0]];

            // Convertimos la hoja a un formato legible
            const datos = XLSX.utils.sheet_to_json(hoja, { header: 1 });

            document.getElementById('verificarPagosBtn').style.display = 'inline-block';

            // Iteramos sobre las filas de datos (saltamos la fila de encabezado)
            for (let i = 13; i < datos.length; i++) {
                const fila = datos[i];

                // Obtener los valores de las columnas relevantes
                const nombre = fila[4]; // Columna E de Excel
                const telefono = fila[5]; // Columna F de Excel

                // Omitir la fila que tenga el teléfono que es "5555555"
                if (telefono == "5555555") {
                    continue;
                }

                if (nombre && telefono) {
                    clientesRegistrados.push({
                        nombre: nombre,
                        telefono: telefono
                    });
                }
            
            }

            // Mostrar los clientes en la modal
            if (clientesRegistrados.length > 0) {
                mostrarEnModal(clientesRegistrados);

                // Evento para enviar mensajes cuando el usuario haga clic en el botón
                document.getElementById('botonEnviarMensajes').addEventListener('click', function () {
                    enviarMensajes(clientesRegistrados);
                });
            } else {
                Swal.fire({
                    icon: 'info',
                    title: 'Sin resultados',
                    text: 'No hay personas con facturas pendientes.'
                });   
            }

        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un problema al procesar el archivo.'
            });     
        }
    };

    reader.readAsArrayBuffer(archivo);
}

function mostrarEnModal(clientesRegistrados) {
    let modalContenido = '';

    clientesRegistrados.forEach(persona => {
        modalContenido += `
            <tr>
                <td>${persona.nombre}</td>
                <td>${persona.telefono}</td>
            </tr>
        `;
    });

    document.getElementById('tablaModal').innerHTML = modalContenido;
    document.getElementById('modalPersonas').style.display = 'block';
    document.getElementById('botonLeerQR').style.display = 'inline-block';
    document.getElementById('botonEscribirMensaje').style.display = 'none';
    
}

function cerrarModal() {
    document.getElementById('modalPersonas').style.display = 'none';
}

// Función para manejar el clic en el botón "Leer QR"
document.getElementById('botonLeerQR').addEventListener('click', function() {
    // Limpiar la URL del QR anterior
    document.getElementById('codigoQR').src = '';
    document.getElementById('tooltipQR').style.display = 'none';
    clearTimeout(contadorTiempoQR); // Limpiar cualquier temporizador anterior
    clearInterval(intervaloVerificacion); // Limpiar el intervalo de verificación
    
    // Mostrar el "spinner" mientras obtenemos el QR
    document.getElementById('cargando').style.display = 'block';

     // Agregar un parámetro único a la URL para evitar cache
     const timestamp = new Date().getTime();
    fetch(`https://notificaciones-clientes-autosleo.onrender.com/get-qrcode?timestamp=${timestamp}`)
        .then(response => response.json())
        .then(data => {
            console.log("Respuesta del servidor:", data);
            if (data.qrUrl) {
                console.log("URL del QR:", data.qrUrl);
                // Mostrar el QR
                document.getElementById('codigoQR').src = data.qrUrl;
                document.getElementById('tooltipQR').style.display = 'block'; // Mostrar el contenedor
                verificarWhatsappListo();
                // iniciarTemporizadorQR();
                // if (!whatsappListo) {
                //     iniciarTemporizadorQR();
                // }
            } else {
                console.error('No se recibió la URL del QR');
                Swal.fire({
                    icon: 'error',
                    title: 'QR no disponible',
                    text: 'No se recibió correctamente el QR. Por favor, genera un nuevo código QR.'
                });
                document.getElementById('cargando').style.display = 'none';
            }
        })
        .catch(error => {
            console.error('Error al obtener el QR:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error de conexión',
                text: 'Hubo un problema al obtener el código QR. Verifica tu conexión y vuelve a intentarlo.'
            });
            document.getElementById('cargando').style.display = 'none';  // Ocultar spinner
        });
});


let whatsappListo = false;

// Función para verificar que WhatsApp este listo
async function verificarWhatsappListo() {
    // Mostrar el "spinner" cuando comience la verificación
    document.getElementById('cargando').style.display = 'block';

    intervaloVerificacion = setInterval(async () => {
        try {
            const response = await fetch('https://notificaciones-clientes-autosleo.onrender.com/whatsapp-ready');
            const data = await response.json();
            if (data.ready) {
                console.log('WhatsApp Web está listo');
                whatsappListo = true;

                // Detener el temporizador si WhatsApp está listo
                clearTimeout(contadorTiempoQR);
                clearInterval(intervaloVerificacion);

                document.getElementById('cargando').style.display = 'none';
                // Habilitar el botón "botonEscribirMensaje" solo cuando WhatsApp esté listo
                document.getElementById('botonEscribirMensaje').style.display = 'inline-block';
                // Cerrar el tooltip QR una vez que WhatsApp esté listo
                cerrarTooltipQR();

                mostrarEditorMensaje();
            } else {
                console.log('WhatsApp Web no está listo');
            }
        } catch (error) {
            console.error('Error al verificar estado de WhatsApp:', error);
        }
    }, 10000); // Verificar cada 10 segundos

     // Iniciar el temporizador para caducidad del QR si WhatsApp no está listo
     contadorTiempoQR = setTimeout(() => {
        // Solo mostrar el mensaje de caducidad si WhatsApp no está listo
        if (!whatsappListo) {
            Swal.fire({
                icon: 'warning',
                title: 'Tiempo caducado',
                text: 'El tiempo para escanear el código QR ha caducado. Por favor, genera un nuevo código QR y escanéalo lo más pronto posible.'
            });

            document.getElementById('cargando').style.display = 'none'; 
            cerrarTooltipQR();
            document.getElementById('botonEscribirMensaje').style.display = 'none';
            document.getElementById('codigoQR').src = ''; // Limpiar el QR
            // Detener la verificación de WhatsApp si el QR caduca
            clearInterval(intervaloVerificacion);
        }
    }, 120000); // 2 minutos
}

// function iniciarTemporizadorQR() {
//     // Si WhatsApp ya está listo, no ejecutar el temporizador de caducidad
//     if (whatsappListo) {
//         console.log('WhatsApp ya está listo, no se inicia el temporizador de caducidad.');
//         return;
//     }

//     clearTimeout(contadorTiempoQR); // Limpiamos cualquier temporizador anterior
//     // clearInterval(intervaloVerificacion); // Limpiar el intervalo de verificación

//     // Iniciar el temporizador para caducidad del QR
//     contadorTiempoQR = setTimeout(() => {
//         // Solo mostrar el mensaje de caducidad si WhatsApp no está listo
//         if (!whatsappListo) {
//             Swal.fire({
//                 icon: 'warning',
//                 title: 'Tiempo caducado',
//                 text: 'El tiempo para escanear el código QR ha caducado. Por favor, genera un nuevo código QR y escanéalo lo más pronto posible.'
//             });

//             document.getElementById('cargando').style.display = 'none'; 
//             cerrarTooltipQR();
//             document.getElementById('botonEscribirMensaje').style.display = 'none';
//             document.getElementById('codigoQR').src = ''; // Limpiar el QR
//         }
//     }, 25000); // 25 segundos
// }


function cerrarTooltipQR() {
    document.getElementById('tooltipQR').style.display = 'none';

}

// Función para mostrar el editor de mensaje y el botón de enviar
function mostrarEditorMensaje() {

    // Mostrar el textarea y el botón "Enviar Mensajes"
    document.getElementById("editorMensaje").style.display = 'block';
    document.getElementById("botonEnviarMensajes").style.display = 'inline-block';
}

function cerrarEditorMensaje() {
    const editorMensaje = document.getElementById('editorMensaje');

    // Verificar si el editor de mensaje existe
    if (editorMensaje) {
        editorMensaje.style.display = 'none';
    }

    document.getElementById("botonEnviarMensajes").style.display = 'none';
}

function enviarMensajes(clientesRegistrados) {

    // Obtener el mensaje del textarea
    const mensajeUsuario = document.getElementById("mensajeUsuario").value;

    // Contadores para manejar el estado de envío
    let mensajesEnviados = 0;
    let mensajesError = 0;

    // Mostrar el "loading" mientras se envían los mensajes
    const loading = document.getElementById('cargando');
    const mensajeElement = loading.querySelector('p');
    if (loading && mensajeElement) {
        loading.style.display = 'block';
        mensajeElement.textContent = 'Enviando mensajes...';
    }

    // Deshabilitar los botones para evitar envíos múltiples
    document.getElementById('botonEscribirMensaje').disabled = true;
    document.getElementById('botonEnviarMensajes').disabled = true;

    // Iterar sobre cada persona que tiene pagos pendientes y enviar el mensaje
    clientesRegistrados.forEach(persona => {
        const mensajeBase = "Estimado(a) *" + persona.nombre + "*.\n\n";
        const mensajeFinal = mensajeBase + mensajeUsuario;  // Combina la parte fija con el mensaje del usuario

        // Enviar mensaje a la persona
        fetch('https://notificaciones-clientes-autosleo.onrender.com/enviar-mensaje', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telefono: persona.telefono, mensaje: mensajeFinal })
        })
        .then(response => response.json())
        .then(data => {
            mensajesEnviados++;  // Incrementar el contador de mensajes enviados
            console.log('Mensaje enviado a:', persona.telefono);

            // Si todos los mensajes han sido enviados, ocultar el "loading" y habilitar los botones
            if (mensajesEnviados === clientesRegistrados.length) {
                ocultarSpinnerYBotones(true);

                setTimeout(cerrarSesionWhatsapp, 120000); // A los 2 minutos se cierra la sesión de WhastApp
            }
        })
        .catch(error => {
            mensajesError++;  // Incrementar el contador de mensajes con error
            console.error('Error al enviar el mensaje:', error);

            // Si todos los mensajes han fallado, ocultar el "loading" y habilitar los botones
            if (mensajesError === clientesRegistrados.length) {
                ocultarSpinnerYBotones(false);
            }
        });
    });
}

function ocultarSpinnerYBotones(exito) {
    const loading = document.getElementById('cargando');
    if (loading) {
        loading.style.display = 'none';  // Ocultar el spinner
    }

    // Los botones se ocultan después de enviar los mensajes
    document.getElementById('botonLeerQR').style.display = 'none';
    document.getElementById('botonEscribirMensaje').style.display = 'none';
    document.getElementById('editorMensaje').style.display = 'none';

    // Mostrar mensaje de éxito o error al usuario
    if (exito) {
        Swal.fire({
            icon: 'success',
            title: 'Éxito',
            text: 'Los mensajes fueron enviados exitosamente.'
        });
          
    } else {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Hubo un error al enviar los mensajes.'
        });
          
    }
}

function cerrarSesionWhatsapp() {
    // Aquí se llama a la ruta para cerrar sesión
    fetch('https://notificaciones-clientes-autosleo.onrender.com/cerrar-sesion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => response.json())
    .then(data => {
        console.log("Sesión cerrada correctamente:", data.message);

        Swal.fire({
            icon: 'success',
            title: 'Sesión cerrada',
            text: 'La sesión de WhatsApp se cerró correctamente. Si no se desvincula automáticamente en tu teléfono, ve a WhatsApp y desvincula la sesión manualmente.',
        }).then(() => {
            //Limpiar la URL del QR y refrescar la página
            document.getElementById('codigoQR').src = '';
            document.getElementById('tooltipQR').style.display = 'none';

            //Recargar la página
            location.reload();
        });  
    })
    .catch(error => {
        console.error("Error al cerrar sesión:", error);

        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Hubo un problema al cerrar la sesión de WhatsApp.',
        });
    });
}