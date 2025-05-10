import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

// Obtener __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PATH_ROUTES = __dirname;

const removeExtension = (filename) => filename.split('.').shift();

fs.readdirSync(PATH_ROUTES).filter((file) => {
    const name = removeExtension(file);

    if (name !== 'index') {
        console.log(`Adding route /${name}`);
        import(`./${file}`).then((module) => {
            router.use(`/${name}`, module.default);
        }).catch((err) => {
            console.error(`Error al importar la ruta ${file}:`, err);
        });
    }
});

export default router;