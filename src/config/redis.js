import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

// Crear una instancia de Redis con la configuración de entorno
const redis = new Redis({
    host: process.env.REDIS_HOST,
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    port: process.env.REDIS_PORT,
    lazyConnect: true, // Conexión perezosa
    keepAlive: 1000,
});

// Función para establecer un valor en el caché
const setCache = async (key, value, expiration = 3600) => {
    try {
        await redis.set(key, JSON.stringify(value), 'EX', expiration); // Guarda el valor con tiempo de expiración
    } catch (error) {
        console.error('Error al establecer el cache:', error);
    }
};

// Función para obtener un valor del caché
const getCache = async (key) => {
    try {
        const data = await redis.get(key);
        return data ? JSON.parse(data) : null; // Devuelve el valor parseado si existe
    } catch (error) {
        console.error('Error al obtener el cache:', error);
        return null;
    }
};

// Exportar la instancia de Redis y las funciones
export { redis, setCache, getCache };