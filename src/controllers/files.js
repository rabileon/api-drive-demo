import { Files } from '../config/mysql.js';


export const getFiles = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const extensionFiles = req.query.extension; // 'Video' o 'Audio'
        const whereClause = extensionFiles ? { extension: extensionFiles } : {}; // Filtro condicional

        const { count, rows } = await Files.findAndCountAll({
            where: whereClause,
            limit,
            offset,
            order: [['dateModifiedFile', 'DESC']],
            attributes: { exclude: ['downloadLink', 'folderId'] } // 👈 Aquí excluyes el campo
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
};