import { Files } from '../config/mysql.js';


export const getFiles = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Página actual
        const limit = parseInt(req.query.limit) || 20; // Registros por página
        const offset = (page - 1) * limit;


        const { count, rows } = await filesModel.findAndCountAll({
            limit,
            offset,
            order: [['createdAt', 'DESC']], // Ordenar por fecha descendente
        });

        res.json({
            page,
            limit,
            totalItems: count,
            totalPages: Math.ceil(count / limit),
            files: rows,
        });
    } catch (error) {
        console.error('Error al obtener archivos:', error.message);
        res.status(500).json({ error: 'Error al obtener los archivos' });
    }

}