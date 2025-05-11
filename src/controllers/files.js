import { Files } from '../config/mysql.js';


export const getFiles = async (req, res) => {
    try {
        const files = await filesModel.findAll();
        res.status(200).json(files);
    } catch (error) {
        console.error('Error al obtener archivos:', error.message);
        res.status(500).json({ error: 'Error al obtener los archivos' });
    }

}