import axios from 'axios';
import { setCache, getCache } from '../config/redis.js'; // Importamos las funciones

export const getAuth = async (req, res) => {
    try {
        // Hacer la solicitud a la API de OpenDrive para obtener el SessionID
        const response = await axios.post('https://dev.opendrive.com/api/v1/login.json', {
            username: process.env.OPENDRIVE_USER,
            passwd: process.env.OPENDRIVE_PASS
        });

        // Obtener el SessionID de la respuesta
        const sessionID = response.data.SessionID;

        // Guardar el SessionID en Redis con un tiempo de expiración (12 horas por ejemplo)
        await setCache('sessionID', sessionID, 12 * 3600); // 12 horas en segundos

        // Devolver el SessionID como respuesta (o lo que necesites hacer con él)
        res.json({ sessionID });
    } catch (error) {
        console.error('Error al obtener el SessionID:', error);
        res.status(500).send('Error al obtener el SessionID');
    }
};