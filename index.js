require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

const app = express();

// Configuración del token de API
const API_TOKEN = process.env.API_TOKEN
// Middleware para verificar el token de autenticación
const authMiddleware = (req, res, next) => {
    // Rutas que no requieren autenticación
    if (req.path === '/' || req.path === '/weather') {
      return next();
    }
  
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No autorizado',
        message: 'Se requiere un token de autenticación válido'
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    if (token !== API_TOKEN) {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado',
        message: 'Token de autenticación inválido'
      });
    }
    
    next();
  };
  
// Aplicar middleware de autenticación a todas las rutas
app.use(authMiddleware);

const WEATHER_ICONS = {
  '01': '☀️',
  '02': '☁️',
  '03': '☁️',
  '04': '☁️',
  '09': '🌧️',
  '10': '🌧️',
  '11': '⛈️',
  '13': '❄️',
  '50': '🌫️'
};

function formatTime(timestamp) {
  const date = new Date(timestamp * 1000);
  const argentinaTime = new Date(date.getTime() - (3 * 60 * 60 * 1000));
  
  return argentinaTime.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  .replace('a. m.', 'AM')
  .replace('p. m.', 'PM');
}

function formatDate(timestamp) {
  return new Date(timestamp * 1000)
    .toLocaleDateString('es-AR', { weekday: 'long' })
    .replace(/^\w/, c => c.toUpperCase());
}

function capitalizeFirst(str) {
  return str.replace(/^\w/, c => c.toUpperCase());
}

app.get('/weather', async (req, res) => {
  try {
    const response = await axios.get('https://api.openweathermap.org/data/3.0/onecall', {
      params: {
        lat: req.query.lat || process.env.DEFAULT_LAT,
        lon: req.query.lon || process.env.DEFAULT_LON,
        appid: process.env.OPENWEATHER_API_KEY,
        units: 'metric',
        lang: 'es',
        exclude: 'hourly,minutely'
      }
    });

    const current = response.data.current;
    const daily = response.data.daily;

    const weatherData = {
      current: {
        icon: getWeatherIcon(current.weather[0].icon),
        condition: capitalizeFirst(current.weather[0].description),
        temp_min: daily[0].temp.min.toFixed(1),
        temp_max: daily[0].temp.max.toFixed(1),
        humidity: current.humidity,
        wind_speed: current.wind_speed,
        uvi: current.uvi,
        sunrise: formatTime(current.sunrise),
        sunset: formatTime(current.sunset),
        rain: current.rain?.['1h'] || 0
      },
      forecast: [
        {
          day: formatDate(daily[1].dt),
          icon: getWeatherIcon(daily[1].weather[0].icon),
          temp_min: daily[1].temp.min.toFixed(1),
          temp_max: daily[1].temp.max.toFixed(1)
        },
        {
          day: formatDate(daily[2].dt),
          icon: getWeatherIcon(daily[2].weather[0].icon),
          temp_min: daily[2].temp.min.toFixed(1),
          temp_max: daily[2].temp.max.toFixed(1)
        },
        {
          day: formatDate(daily[3].dt),
          icon: getWeatherIcon(daily[3].weather[0].icon),
          temp_min: daily[3].temp.min.toFixed(1),
          temp_max: daily[3].temp.max.toFixed(1)
        },
        {
          day: formatDate(daily[4].dt),
          icon: getWeatherIcon(daily[4].weather[0].icon),
          temp_min: daily[4].temp.min.toFixed(1),
          temp_max: daily[4].temp.max.toFixed(1)
        }
      ],
      formatted_message: `El clima para hoy en tu ubicación es:
• ${getWeatherIcon(current.weather[0].icon)} Condición: ${capitalizeFirst(current.weather[0].description)}
• 🌡️ Temperatura: ${daily[0].temp.min.toFixed(1)} °C - ${daily[0].temp.max.toFixed(1)} °C
• 💧 Humedad: ${current.humidity}%
• 💨 Velocidad viento: ${current.wind_speed} km/h
• ☀️ Indice UV: ${current.uvi}
• 🌅 Amanecer: ${formatTime(current.sunrise)}
• 🌇 Atardecer: ${formatTime(current.sunset)}
${current.rain ? `• 🌧️ Lluvia última hora: ${current.rain['1h']}mm\n` : ''}
Pronóstico de 4 días:
• *${formatDate(daily[1].dt)}*: ${getWeatherIcon(daily[1].weather[0].icon)} ${daily[1].temp.min.toFixed(1)}°C - ${daily[1].temp.max.toFixed(1)}°C
• *${formatDate(daily[2].dt)}*: ${getWeatherIcon(daily[2].weather[0].icon)} ${daily[2].temp.min.toFixed(1)}°C - ${daily[2].temp.max.toFixed(1)}°C
• *${formatDate(daily[3].dt)}*: ${getWeatherIcon(daily[3].weather[0].icon)} ${daily[3].temp.min.toFixed(1)}°C - ${daily[3].temp.max.toFixed(1)}°C
• *${formatDate(daily[4].dt)}*: ${getWeatherIcon(daily[4].weather[0].icon)} ${daily[4].temp.min.toFixed(1)}°C - ${daily[4].temp.max.toFixed(1)}°C`
    };

    res.json(weatherData);
  } catch (error) {
    console.error('Error al obtener datos del clima:', error);
    res.status(500).json({ error: 'Error al obtener datos del clima' });
  }
});

// Ruta para obtener todos los precios de pizarra de la BCR
app.get('/precios', async (req, res) => {
  try {
    // URL de la página a scrapear
    const url = 'https://www.cac.bcr.com.ar/es/precios-de-pizarra';
    
    // Hacer la petición HTTP para obtener el HTML
    const response = await axios.get(url);
    
    // Cargar el HTML en cheerio
    const $ = cheerio.load(response.data);
    
    // Array para almacenar los resultados
    const precios = [];
    
    // Extraer la fecha de los precios
    const fechaTexto = $('.paragraph--type--prices-board h3').text().trim();
    const fechaMatch = fechaTexto.match(/Precios Pizarra del día (\d{2}\/\d{2}\/\d{4})/);
    const fecha = fechaMatch ? fechaMatch[1] : 'Fecha no disponible';
    
    // Extraer información de cada tablero de precios (board)
    $('.board').each((index, element) => {
      const producto = $(element).find('h3').text().trim();
      const precioTexto = $(element).find('.price').text().trim();
      const precio = precioTexto !== 'S/C' ? precioTexto : 'Sin cotización';
      
      // Extraer información adicional
      const diferenciaPrecio = $(element).find('.bottom .cell:nth-child(2)').text().trim();
      const diferenciaPorcentaje = $(element).find('.bottom .cell:nth-child(4)').text().trim();
      
      // Determinar tendencia
      let tendencia = 'Sin cambios';
      if ($(element).find('.fa-arrow-up').length > 0) {
        tendencia = 'Sube';
      } else if ($(element).find('.fa-arrow-down').length > 0) {
        tendencia = 'Baja';
      }
      
      // Verificar si hay precio estimativo
      let precioEstimativo = null;
      const precioSCText = $(element).find('.price-sc').text().trim();
      if (precioSCText) {
        const precioEstMatch = precioSCText.match(/\(Estimativo\) (.+)/);
        precioEstimativo = precioEstMatch ? precioEstMatch[1] : precioSCText;
      }
      
      precios.push({
        fecha,
        producto,
        precio,
        diferencia_precio: diferenciaPrecio,
        diferencia_porcentaje: diferenciaPorcentaje,
        tendencia,
        precio_estimativo: precioEstimativo
      });
    });
    
    // Extraer información del pie de página
    const footerText = $('.price-board-footer div:nth-child(2)').text().trim();
    const horaMatch = footerText.match(/Hora: (\d{2}:\d{2})/);
    const hora = horaMatch ? horaMatch[1] : 'Hora no disponible';
    
    // Devolver los resultados como JSON
    res.json({
      success: true,
      fecha_actualizacion: fecha,
      hora_actualizacion: hora,
      data: precios,
      total: precios.length
    });
    
  } catch (error) {
    console.error('Error al hacer scraping:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener los datos',
      message: error.message
    });
  }
});

// Ruta para obtener precios de un producto específico
app.get('/precios/:producto', async (req, res) => {
  try {
    const productoQuery = req.params.producto.toLowerCase();
    const url = 'https://www.cac.bcr.com.ar/es/precios-de-pizarra';
    
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    
    // Extraer la fecha de los precios
    const fechaTexto = $('.paragraph--type--prices-board h3').text().trim();
    const fechaMatch = fechaTexto.match(/Precios Pizarra del día (\d{2}\/\d{2}\/\d{4})/);
    const fecha = fechaMatch ? fechaMatch[1] : 'Fecha no disponible';
    
    // Array para almacenar los resultados filtrados
    const precios = [];
    
    // Extraer información de cada tablero de precios (board)
    $('.board').each((index, element) => {
      const producto = $(element).find('h3').text().trim();
      
      // Filtrar por producto (case insensitive)
      if (producto.toLowerCase().includes(productoQuery)) {
        const precioTexto = $(element).find('.price').text().trim();
        const precio = precioTexto !== 'S/C' ? precioTexto : 'Sin cotización';
        
        // Extraer información adicional
        const diferenciaPrecio = $(element).find('.bottom .cell:nth-child(2)').text().trim();
        const diferenciaPorcentaje = $(element).find('.bottom .cell:nth-child(4)').text().trim();
        
        // Determinar tendencia
        let tendencia = 'Sin cambios';
        if ($(element).find('.fa-arrow-up').length > 0) {
          tendencia = 'Sube';
        } else if ($(element).find('.fa-arrow-down').length > 0) {
          tendencia = 'Baja';
        }
        
        // Verificar si hay precio estimativo
        let precioEstimativo = null;
        const precioSCText = $(element).find('.price-sc').text().trim();
        if (precioSCText) {
          const precioEstMatch = precioSCText.match(/\(Estimativo\) (.+)/);
          precioEstimativo = precioEstMatch ? precioEstMatch[1] : precioSCText;
        }
        
        precios.push({
          fecha,
          producto,
          precio,
          diferencia_precio: diferenciaPrecio,
          diferencia_porcentaje: diferenciaPorcentaje,
          tendencia,
          precio_estimativo: precioEstimativo
        });
      }
    });
    
    // Extraer información del pie de página
    const footerText = $('.price-board-footer div:nth-child(2)').text().trim();
    const horaMatch = footerText.match(/Hora: (\d{2}:\d{2})/);
    const hora = horaMatch ? horaMatch[1] : 'Hora no disponible';
    
    res.json({
      success: true,
      producto: productoQuery,
      fecha_actualizacion: fecha,
      hora_actualizacion: hora,
      data: precios,
      total: precios.length
    });
    
  } catch (error) {
    console.error('Error al hacer scraping:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener los datos',
      message: error.message
    });
  }
});


// Ruta para la página de inicio que muestra los endpoints disponibles
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>API de Clima y Precios BCR</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #2c3e50; }
          h2 { color: #3498db; }
          code { background-color: #f8f8f8; padding: 2px 5px; border-radius: 3px; }
          pre { background-color: #f8f8f8; padding: 10px; border-radius: 5px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <h1>API de Clima y Precios BCR</h1>
        <p>Esta API proporciona datos del clima y precios de la Bolsa de Comercio de Rosario.</p>
        
        <h2>Endpoints de Clima:</h2>
        <ul>
          <li><code>GET /weather</code> - Obtiene datos del clima actual y pronóstico para 4 días</li>
        </ul>
        
        <h2>Endpoints de Precios BCR:</h2>
        <ul>
          <li><code>GET /precios</code> - Obtiene todos los precios de pizarra</li>
          <li><code>GET /precios/:producto</code> - Filtra los precios por producto (ej: /precios/soja)</li>
        </ul>
        
        <h2>Ejemplo de respuesta de precios:</h2>
        <pre>{
  "success": true,
  "fecha_actualizacion": "15/04/2025",
  "hora_actualizacion": "10:12",
  "data": [
    {
      "fecha": "15/04/2025",
      "producto": "Trigo",
      "precio": "$248.000,00",
      "diferencia_precio": "8.000,00",
      "diferencia_porcentaje": "3,333",
      "tendencia": "Sube",
      "precio_estimativo": null
    },
    ...
  ],
  "total": 5
}</pre>
      </body>
    </html>
  `);
});

// Ruta para obtener la Tasa Activa del BNA
app.get('/tasaactivabna', async (req, res) => {
  try {
    // URL de la página a scrapear
    const url = 'https://www.bna.com.ar/Home/InformacionAlUsuarioFinanciero';
    
    // Hacer la petición HTTP para obtener el HTML
    const response = await axios.get(url);
    
    // Cargar el HTML en cheerio
    const $ = cheerio.load(response.data);
    
    // Extraer la fecha de vigencia de la tasa
    let fechaVigencia = '';
    let tasaNominalAnual = '';
    
    // Buscar el texto que contiene "Tasa Activa Cartera General Diversas vigente desde el"
    $('body').find('p, div, span, h1, h2, h3, h4, h5, h6').each((index, element) => {
      const texto = $(element).text().trim();
      
      // Buscar la fecha de vigencia
      const fechaMatch = texto.match(/Tasa Activa Cartera General Diversas vigente desde el (\d{1,2}\/\d{1,2}\/\d{4})/);
      if (fechaMatch) {
        fechaVigencia = fechaMatch[1];
      }
      
      // Buscar la tasa nominal anual
      const tasaMatch = texto.match(/Tasa Nominal Anual Vencida con capitalización cada 30 días = T\.N\.A\. \(30 días\) = (\d+,\d+)%/);
      if (tasaMatch) {
        tasaNominalAnual = tasaMatch[1];
      }
    });
    
    // Verificar si se encontraron los datos
    if (!fechaVigencia || !tasaNominalAnual) {
      return res.status(404).json({
        success: false,
        error: 'No se pudieron encontrar los datos solicitados',
        message: 'La estructura de la página puede haber cambiado'
      });
    }
    
    // Devolver los resultados como JSON
    res.json({
      success: true,
      fecha_vigencia: fechaVigencia,
      tasa_nominal_anual: tasaNominalAnual + '%',
      fecha_consulta: new Date().toLocaleDateString('es-AR')
    });
    
  } catch (error) {
    console.error('Error al hacer scraping de la tasa activa BNA:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener los datos',
      message: error.message
    });
  }
});

// Ruta para obtener cotizaciones de divisas del BNA
// app.get('/divisasbna', async (req, res) => {
//   try {
//     // URL de la página a scrapear
//     const url = 'https://www.bna.com.ar/Personas';
    
//     // Hacer la petición HTTP para obtener el HTML
//     const response = await axios.get(url);
    
//     // Cargar el HTML en cheerio
//     const $ = cheerio.load(response.data);
    
//     // Arrays para almacenar los resultados
//     const billetes = [];
//     const divisas = [];
    
//     // Extraer fecha de actualización
//     let fechaActualizacion = '';
//     let horaActualizacion = '';
    
//     // Extraer información de billetes
//     $('#billetes table.cotizacion tbody tr').each((index, element) => {
//       const moneda = $(element).find('td.tit').text().trim();
//       const compra = $(element).find('td').eq(1).text().trim();
//       const venta = $(element).find('td').eq(2).text().trim();
      
//       if (moneda && compra && venta) {
//         billetes.push({
//           moneda: moneda,
//           compra: parseFloat(compra.replace(',', '.')),
//           venta: parseFloat(venta.replace(',', '.')),
//           compra_texto: compra,
//           venta_texto: venta
//         });
//       }
//     });
    
//     // Extraer fecha de billetes
//     const fechaBilletes = $('#billetes table.cotizacion thead th.fechaCot').text().trim();
//     if (fechaBilletes) {
//       fechaActualizacion = fechaBilletes;
//     }
    
//     // Extraer hora de actualización de billetes
//     const horaBilletes = $('#billetes .legal').first().text().trim();
//     const horaMatch = horaBilletes.match(/Hora Actualización: (\d{2}:\d{2})/);
//     if (horaMatch) {
//       horaActualizacion = horaMatch[1];
//     }
    
//     // Extraer información de divisas
//     $('#divisas table.cotizacion tbody tr').each((index, element) => {
//       const moneda = $(element).find('td.tit').text().trim();
//       const compra = $(element).find('td').eq(1).text().trim();
//       const venta = $(element).find('td').eq(2).text().trim();
      
//       if (moneda && compra && venta) {
//         divisas.push({
//           moneda: moneda,
//           compra: parseFloat(compra.replace(',', '.')),
//           venta: parseFloat(venta.replace(',', '.')),
//           compra_texto: compra,
//           venta_texto: venta
//         });
//       }
//     });
    
//     // Si no se extrajo fecha de billetes, intentar con divisas
//     if (!fechaActualizacion) {
//       const fechaDivisas = $('#divisas table.cotizacion thead th.fechaCot').text().trim();
//       if (fechaDivisas) {
//         fechaActualizacion = fechaDivisas;
//       }
//     }
    
//     // Devolver los resultados como JSON
//     res.json({
//       success: true,
//       fecha_actualizacion: fechaActualizacion,
//       hora_actualizacion: horaActualizacion,
//       billetes: billetes,
//       divisas: divisas,
//       total_billetes: billetes.length,
//       total_divisas: divisas.length
//     });
    
//   } catch (error) {
//     console.error('Error al hacer scraping de divisas BNA:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Error al obtener los datos de divisas',
//       message: error.message
//     });
//   }
// });

// // Ruta para obtener cotización de una divisa específica
// app.get('/divisasbna/:moneda', async (req, res) => {
//   try {
//     const monedaQuery = req.params.moneda.toLowerCase();
//     const url = 'https://www.bna.com.ar/Personas';
    
//     const response = await axios.get(url);
//     const $ = cheerio.load(response.data);
    
//     let resultado = null;
//     let fechaActualizacion = '';
//     let horaActualizacion = '';
//     let tipoEncontrado = '';
    
//     // Buscar en billetes
//     $('#billetes table.cotizacion tbody tr').each((index, element) => {
//       const moneda = $(element).find('td.tit').text().trim();
      
//       if (moneda.toLowerCase().includes(monedaQuery)) {
//         const compra = $(element).find('td').eq(1).text().trim();
//         const venta = $(element).find('td').eq(2).text().trim();
        
//         resultado = {
//           moneda: moneda,
//           compra: parseFloat(compra.replace(',', '.')),
//           venta: parseFloat(venta.replace(',', '.')),
//           compra_texto: compra,
//           venta_texto: venta
//         };
//         tipoEncontrado = 'billetes';
        
//         // Extraer fecha y hora para billetes
//         const fechaBilletes = $('#billetes table.cotizacion thead th.fechaCot').text().trim();
//         if (fechaBilletes) {
//           fechaActualizacion = fechaBilletes;
//         }
        
//         const horaBilletes = $('#billetes .legal').first().text().trim();
//         const horaMatch = horaBilletes.match(/Hora Actualización: (\d{2}:\d{2})/);
//         if (horaMatch) {
//           horaActualizacion = horaMatch[1];
//         }
        
//         return false; // Salir del each
//       }
//     });
    
//     // Si no se encontró en billetes, buscar en divisas
//     if (!resultado) {
//       $('#divisas table.cotizacion tbody tr').each((index, element) => {
//         const moneda = $(element).find('td.tit').text().trim();
        
//         if (moneda.toLowerCase().includes(monedaQuery)) {
//           const compra = $(element).find('td').eq(1).text().trim();
//           const venta = $(element).find('td').eq(2).text().trim();
          
//           resultado = {
//             moneda: moneda,
//             compra: parseFloat(compra.replace(',', '.')),
//             venta: parseFloat(venta.replace(',', '.')),
//             compra_texto: compra,
//             venta_texto: venta
//           };
//           tipoEncontrado = 'divisas';
          
//           // Extraer fecha para divisas
//           const fechaDivisas = $('#divisas table.cotizacion thead th.fechaCot').text().trim();
//           if (fechaDivisas) {
//             fechaActualizacion = fechaDivisas;
//           }
          
//           return false; // Salir del each
//         }
//       });
//     }
    
//     if (!resultado) {
//       return res.status(404).json({
//         success: false,
//         error: 'Moneda no encontrada',
//         message: `No se encontraron datos para: ${req.params.moneda}`
//       });
//     }
    
//     res.json({
//       success: true,
//       moneda_buscada: req.params.moneda,
//       tipo: tipoEncontrado,
//       fecha_actualizacion: fechaActualizacion,
//       hora_actualizacion: horaActualizacion,
//       data: resultado
//     });
    
//   } catch (error) {
//     console.error('Error al buscar divisa específica:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Error al obtener los datos',
//       message: error.message
//     });
//   }
// });

// Función auxiliar para extraer datos de BNA
async function extraerDatosBNA() {
  const url = 'https://www.bna.com.ar/Personas';
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);
  
  const billetes = [];
  const divisas = [];
  let fechaActualizacion = '';
  let horaActualizacion = '';
  
  // Extraer información de billetes
  $('#billetes table.cotizacion tbody tr').each((index, element) => {
    const moneda = $(element).find('td.tit').text().trim();
    const compra = $(element).find('td').eq(1).text().trim();
    const venta = $(element).find('td').eq(2).text().trim();
    
    if (moneda && compra && venta) {
      billetes.push({
        moneda: moneda,
        compra: parseFloat(compra.replace(',', '.')),
        venta: parseFloat(venta.replace(',', '.')),
        compra_texto: compra,
        venta_texto: venta
      });
    }
  });
  
  // Extraer información de divisas
  $('#divisas table.cotizacion tbody tr').each((index, element) => {
    const moneda = $(element).find('td.tit').text().trim();
    const compra = $(element).find('td').eq(1).text().trim();
    const venta = $(element).find('td').eq(2).text().trim();
    
    if (moneda && compra && venta) {
      divisas.push({
        moneda: moneda,
        compra: parseFloat(compra.replace(',', '.')),
        venta: parseFloat(venta.replace(',', '.')),
        compra_texto: compra,
        venta_texto: venta
      });
    }
  });
  
  // Extraer fecha y hora
  const fechaBilletes = $('#billetes table.cotizacion thead th.fechaCot').text().trim();
  const fechaDivisas = $('#divisas table.cotizacion thead th.fechaCot').text().trim();
  fechaActualizacion = fechaBilletes || fechaDivisas;
  
  const horaBilletes = $('#billetes .legal').first().text().trim();
  const horaMatch = horaBilletes.match(/Hora Actualización: (\d{2}:\d{2})/);
  if (horaMatch) {
    horaActualizacion = horaMatch[1];
  }
  
  return { billetes, divisas, fechaActualizacion, horaActualizacion };
}

// Ruta para obtener todas las cotizaciones de divisas y billetes
app.get('/cotizacionesbna', async (req, res) => {
  try {
    const datos = await extraerDatosBNA();
    
    res.json({
      success: true,
      fecha_actualizacion: datos.fechaActualizacion,
      hora_actualizacion: datos.horaActualizacion,
      billetes: datos.billetes,
      divisas: datos.divisas,
      total_billetes: datos.billetes.length,
      total_divisas: datos.divisas.length
    });
    
  } catch (error) {
    console.error('Error al hacer scraping de cotizaciones BNA:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener los datos de cotizaciones',
      message: error.message
    });
  }
});

// Ruta para obtener solo billetes
app.get('/billetes', async (req, res) => {
  try {
    const datos = await extraerDatosBNA();
    
    res.json({
      success: true,
      tipo: 'billetes',
      fecha_actualizacion: datos.fechaActualizacion,
      hora_actualizacion: datos.horaActualizacion,
      data: datos.billetes,
      total: datos.billetes.length
    });
    
  } catch (error) {
    console.error('Error al obtener billetes BNA:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener los datos de billetes',
      message: error.message
    });
  }
});

// Ruta para obtener solo divisas
app.get('/divisas', async (req, res) => {
  try {
    const datos = await extraerDatosBNA();
    
    res.json({
      success: true,
      tipo: 'divisas',
      fecha_actualizacion: datos.fechaActualizacion,
      hora_actualizacion: datos.horaActualizacion,
      data: datos.divisas,
      total: datos.divisas.length
    });
    
  } catch (error) {
    console.error('Error al obtener divisas BNA:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener los datos de divisas',
      message: error.message
    });
  }
});

// Ruta para obtener billete específico
app.get('/billetes/:moneda', async (req, res) => {
  try {
    const monedaQuery = req.params.moneda.toLowerCase();
    const datos = await extraerDatosBNA();
    
    const resultado = datos.billetes.find(item => 
      item.moneda.toLowerCase().includes(monedaQuery)
    );
    
    if (!resultado) {
      return res.status(404).json({
        success: false,
        error: 'Billete no encontrado',
        message: `No se encontraron datos de billetes para: ${req.params.moneda}`
      });
    }
    
    res.json({
      success: true,
      tipo: 'billetes',
      moneda_buscada: req.params.moneda,
      fecha_actualizacion: datos.fechaActualizacion,
      hora_actualizacion: datos.horaActualizacion,
      data: resultado
    });
    
  } catch (error) {
    console.error('Error al buscar billete específico:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener los datos',
      message: error.message
    });
  }
});

// Ruta para obtener divisa específica
app.get('/divisas/:moneda', async (req, res) => {
  try {
    const monedaQuery = req.params.moneda.toLowerCase();
    const datos = await extraerDatosBNA();
    
    const resultado = datos.divisas.find(item => 
      item.moneda.toLowerCase().includes(monedaQuery)
    );
    
    if (!resultado) {
      return res.status(404).json({
        success: false,
        error: 'Divisa no encontrada',
        message: `No se encontraron datos de divisas para: ${req.params.moneda}`
      });
    }
    
    res.json({
      success: true,
      tipo: 'divisas',
      moneda_buscada: req.params.moneda,
      fecha_actualizacion: datos.fechaActualizacion,
      hora_actualizacion: datos.horaActualizacion,
      data: resultado
    });
    
  } catch (error) {
    console.error('Error al buscar divisa específica:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener los datos',
      message: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

function getWeatherIcon(iconCode) {
  const iconPrefix = iconCode.slice(0, 2);
  return WEATHER_ICONS[iconPrefix] || '❓';
}