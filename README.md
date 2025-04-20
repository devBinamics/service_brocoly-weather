# API de Clima y Precios BCR

Esta aplicación proporciona una API con dos funcionalidades principales:

1. Obtener datos del clima actual y pronóstico para 4 días
2. Realizar scraping de precios de pizarra de la Bolsa de Comercio de Rosario (BCR)

## Instalación

1. Clona este repositorio
2. Instala las dependencias:

```
npm install
```

3. Crea un archivo `.env` basado en `.env.example` y configura tu API key de OpenWeatherMap
4. Inicia el servidor:

```
npm start
```

El servidor estará disponible en `http://localhost:3000`.

## Endpoints

### Clima

```
GET /weather
```

Parámetros opcionales:

* `lat`: Latitud (por defecto usa la configurada en .env)
* `lon`: Longitud (por defecto usa la configurada en .env)

### Precios BCR

```
GET /precios
```

Devuelve todos los precios de pizarra disponibles.

```
GET /precios/:producto
```

Devuelve los precios filtrados por el nombre del producto.

Ejemplo: `http://localhost:3000/precios/soja`

## Ejemplos de respuesta

### Clima

```json
{
  "current": {
    "icon": "☀️",
    "condition": "Cielo despejado",
    "temp_min": "15.6",
    "temp_max": "28.3",
    "humidity": 45,
    "wind_speed": 3.5,
    "uvi": 6.2,
    "sunrise": "07:12",
    "sunset": "18:45",
    "rain": 0
  },
  "forecast": [
    {
      "day": "Domingo",
      "icon": "☁️",
      "temp_min": "16.2",
      "temp_max": "26.8"
    },
    ...
  ],
  "formatted_message": "El clima para hoy en tu ubicación es:..."
}
```

### Precios BCR

```json
{
  "success": true,
  "data": [
    {
      "fecha": "18/04/2025",
      "producto": "SOJA",
      "precio": "$123.000"
    },
    ...
  ],
  "total": 10
}
```

## Notas importantes

* La funcionalidad de scraping de precios depende de la estructura HTML del sitio web de la BCR.  [https://www.cac.bcr.com.ar/es/precios-de-pizarra](https://www.cac.bcr.com.ar/es/precios-de-pizarra)
