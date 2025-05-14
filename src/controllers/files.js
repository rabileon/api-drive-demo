import { Op, Sequelize } from 'sequelize';
import { Files, Genres } from '../config/mysql.js';


export const getFiles = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const genre = req.query.genre === 'ALL' ? '' : req.query.genre;; // solo se usa si está definido

        const whereClause = {}; // Inicializa objeto vacío

        if (genre) {
            whereClause.genre = genre; // Agrega filtro solo si viene
        }

        const { count, rows } = await Files.findAndCountAll({
            where: whereClause,
            limit,
            offset,
            order: [['dateModifiedFile', 'DESC']],
            attributes: {
                exclude: ['downloadLink', 'folderId'],
            },
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


export const extractGenres = async (req, res) => {
    try {
        const files = await Files.findAll({ attributes: ['genre'] });

        const genresSet = new Set();

        for (const file of files) {
            const genres = Array.isArray(file.genre)
                ? file.genre
                : file.genre?.split(',').map(g => g.trim().toUpperCase());

            genres?.forEach(g => {
                if (g) genresSet.add(g);
            });
        }

        const genresArray = Array.from(genresSet);

        for (const name of genresArray) {
            await Genres.findOrCreate({ where: { name } });
        }

        res.status(201).json({
            message: 'Géneros extraídos y registrados',
            total: genresArray.length // ✅ corrección aquí
        });
    } catch (error) {
        console.error('Error al extraer y registrar géneros:', error);
        res.status(500).json({ error: 'Error al registrar géneros en la base de datos' });
    }
}

export const getGenres = async (req, res) => {
    try {
        const generos = await Genres.findAll({
            attributes: ['id', 'name'], // Solo devolvemos lo necesario
            order: [
                [Sequelize.literal(`CASE WHEN name = 'ALL' THEN 0 ELSE 1 END`), 'ASC'],
                ['name', 'ASC'] // opcional: orden alfabético para el resto
            ],
        });

        res.json({ generos });
    } catch (error) {
        console.error('Error al obtener géneros:', error.message);
        res.status(500).json({ error: 'Error al obtener los géneros' });
    }
};

export const searchFiles = async (req, res) => {
    try {
        const { query = '', page, limit } = req.query;

        // Validar que query no esté vacío
        if (!query.trim()) {
            return res.status(400).json({ error: 'Se requiere una consulta de búsqueda.' });
        }

        // Asumir que vienen definidos pero validar su conversión
        const pageInt = parseInt(page);
        const limitInt = parseInt(limit);

        if (isNaN(pageInt) || pageInt < 1 || isNaN(limitInt) || limitInt < 1) {
            return res.status(400).json({ error: 'Parámetros de paginación inválidos.' });
        }

        const offset = (pageInt - 1) * limitInt;

        const { count, rows } = await Files.findAndCountAll({
            where: {
                [Op.or]: [
                    { name: { [Op.like]: `%${query}%` } },
                    { genre: { [Op.like]: `%${query}%` } }
                ]
            },
            order: [['dateModifiedFile', 'DESC']],
            limit: limitInt,
            offset,
            attributes: {
                exclude: ['downloadLink', 'folderId'],
            },
        });

        res.json({
            page: pageInt,
            limit: limitInt,
            totalItems: count,
            totalPages: Math.ceil(count / limitInt),
            files: rows,
        });
    } catch (error) {
        console.error('Error en búsqueda:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};