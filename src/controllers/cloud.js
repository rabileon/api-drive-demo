import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { Files } from '../config/mysql.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URI
);


// Construye la ruta del archivo creds.json
const credPath = path.resolve(new URL(import.meta.url).pathname, '../../../creds.json');
const tempPath = path.resolve(new URL(import.meta.url).pathname, '../../tempFiles');
const drive = google.drive({ version: 'v3', auth: oauth2Client });

try {
    const creds = fs.readFileSync(credPath);  // Asegúrate de leer correctamente el archivo

    oauth2Client.setCredentials(JSON.parse(creds));

} catch (err) {
    console.log("No creds found");
    // Aquí podrías lanzar el flujo de autorización si no tienes los creds.json
}

export const getAuth = (req, res) => {
    const url = oauth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: 'consent', // Fuerza a que Google entregue el refresh_token
        scope: [
            "https://www.googleapis.com/auth/userinfo.profile",
            "https://www.googleapis.com/auth/drive",

        ],
    });
    res.redirect(url);
};

export const getRedirect = async (req, res) => {
    const { code } = req.query;
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        fs.writeFileSync("creds.json", JSON.stringify(tokens));
        res.send("Authentication successful! You can close this tab.");
    } catch (error) {
        console.error("Error retrieving access token", error);
        res.status(500).send("Authentication failed");
    }
};

export const getFolderItems = async (req, res) => {
    try {
        const folderId = req.params.folderId; // Obtener el folderId de la URL

        // Crear una instancia de la API de Google Drive
        // const drive = google.drive({ version: 'v3', auth: oauth2Client });

        // Realizar la consulta para obtener los archivos de la carpeta especificada
        const response = await drive.files.list({
            q: `'${folderId}' in parents and trashed = false`,
            fields: 'nextPageToken, files(id, name, mimeType)',
            pageSize: 1000, // Ajusta el tamaño según lo necesites
        });

        // Filtrar y devolver los archivos de la carpeta
        const files = response.data.files.map(file => ({
            id: file.id,
            name: file.name,
            type: file.mimeType === 'application/vnd.google-apps.folder'
                ? 'folder'
                : file.mimeType.startsWith('video') ? 'video'
                    : file.mimeType.startsWith('audio') ? 'audio'
                        : 'other',
        }));

        res.json(files); // Devolver la lista de archivos
    } catch (error) {
        console.error('Error al obtener archivos:', error.message);
        res.status(500).send('Error al obtener archivos');
    }
};

export const getSearchItems = async (req, res) => {
    try {
        const { query = '', folderId } = req.query;

        // const drive = google.drive({ version: 'v3', auth: oauth2Client });

        // 1. Obtener todas las carpetas (para construir rutas)
        const getAllFolders = async () => {
            let folders = [];
            let pageToken = null;

            do {
                const response = await drive.files.list({
                    q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
                    fields: 'nextPageToken, files(id, name, parents)',
                    pageSize: 1000,
                    pageToken,
                });

                folders.push(...response.data.files);
                pageToken = response.data.nextPageToken;
            } while (pageToken);

            return folders.reduce((map, folder) => {
                map[folder.id] = {
                    name: folder.name,
                    parents: folder.parents || [],
                };
                return map;
            }, {});
        };

        // 2. Buscar archivos por query y opcional folderId
        let searchQuery = `name contains '${query}' and trashed = false`;
        if (folderId) {
            searchQuery += ` and '${folderId}' in parents`;
        }

        const fileResponse = await drive.files.list({
            q: searchQuery,
            fields: 'files(id, name, mimeType, parents)',
            pageSize: 1000,
        });

        // 3. Filtrar solo audio y video
        const audioVideoFiles = fileResponse.data.files.filter(file =>
            file.mimeType.startsWith('audio') || file.mimeType.startsWith('video')
        );

        const foldersMap = await getAllFolders();

        const getFolderPath = async (file) => {
            let path = [file.name];
            let currentParents = file.parents;

            while (currentParents && currentParents.length > 0) {
                const parentId = currentParents[0];
                const parent = foldersMap[parentId];
                if (parent) {
                    path.unshift(parent.name);
                    currentParents = parent.parents;
                } else {
                    break;
                }
            }

            return path.join(' / ');
        };

        const results = await Promise.all(audioVideoFiles.map(async (file) => ({
            id: file.id,
            name: file.name,
            type: file.mimeType.startsWith('video') ? 'video' : 'audio',
            path: await getFolderPath(file),
        })));

        res.json(results);

    } catch (error) {
        console.error('Error en /api/search:', error.message);
        res.status(500).send('Error al realizar la búsqueda');
    }
};

export const getPreview = async (req, res) => {
    const fileId = req.params.id;

    try {
        // const drive = google.drive({ version: 'v3', auth: oauth2Client });

        // Obtener metadata del archivo
        const { data: file } = await drive.files.get({
            fileId,
            fields: 'name, mimeType'
        });

        const mime = file.mimeType;
        const isVideo = mime.startsWith('video');
        const isAudio = mime.startsWith('audio');

        if (!isVideo && !isAudio) {
            return res.status(400).send('Archivo no compatible');
        }

        const outputFormat = isVideo ? 'mp4' : 'mp3';
        res.setHeader('Content-Type', isVideo ? 'video/mp4' : 'audio/mpeg');

        const response = await drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'stream' }
        );

        if (isAudio) {
            // Procesar directamente desde stream
            const ffmpegStream = ffmpeg(response.data)
                .setStartTime(0)
                .duration(30)
                .outputOptions([
                    '-vf scale=320:180',
                    '-b:v 250k',
                    '-b:a 64k',
                    '-preset ultrafast',
                    '-movflags +faststart+frag_keyframe+empty_moov',
                ])
                .format(outputFormat);

            res.on('close', () => {
                try {
                    ffmpegStream.kill('SIGKILL');
                } catch (err) {
                    console.warn('No se pudo detener FFmpeg:', err.message);
                }
            });

            ffmpegStream
                .on('start', cmd => console.log('FFmpeg:', cmd))
                .on('error', err => {
                    console.error('FFmpeg error:', err.message);
                    if (!res.headersSent) {
                        res.status(500).send('Error al procesar el preview');
                    }
                })
                .pipe(res, { end: true });
        } else {
            // Guardar archivo temporal antes de procesar
            const tempFile = path.join(tempPath, `video_${Date.now()}.mp4`);
            const writer = fs.createWriteStream(tempFile);

            response.data.pipe(writer);

            writer.on('finish', () => {
                const ffmpegStream = ffmpeg(tempFile)
                    .setStartTime(0)
                    .duration(30)
                    .outputOptions([
                        '-c:v libx264',
                        '-c:a aac',
                        '-crf 28',
                        '-preset fast',
                        '-movflags frag_keyframe+empty_moov'
                    ])
                    .format(outputFormat);

                res.on('close', () => {
                    try {
                        ffmpegStream.kill('SIGKILL');
                    } catch (err) {
                        console.warn('No se pudo detener FFmpeg:', err.message);
                    }
                    fs.unlink(tempFile, () => { }); // eliminar archivo temporal
                });

                ffmpegStream
                    .on('start', cmd => console.log('FFmpeg:', cmd))
                    .on('error', err => {
                        console.error('FFmpeg error:', err.message);
                        if (!res.headersSent) {
                            res.status(500).send('Error al procesar el preview');
                        }
                        fs.unlink(tempFile, () => { });
                    })
                    .pipe(res, { end: true });
            });

            writer.on('error', err => {
                console.error('Error escribiendo archivo temporal:', err.message);
                res.status(500).send('Error escribiendo archivo temporal');
            });
        }

    } catch (error) {
        console.error('Error general:', error.message);
        if (!res.headersSent) {
            res.status(500).send('Error: ' + error.message);
        }
    }
};


export const getFolderAllItems = async (req, res) => {
    try {
        const folderId = req.params.folderId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const startIndex = (page - 1) * limit;

        // const drive = google.drive({ version: 'v3', auth: oauth2Client });

        // Recorrer subcarpetas recursivamente
        const getAllSubfolderIds = async (parentId) => {
            let folderIds = [parentId];
            let queue = [parentId];

            while (queue.length > 0) {
                const currentId = queue.shift();
                const response = await drive.files.list({
                    q: `'${currentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
                    fields: 'files(id)',
                    pageSize: 1000
                });

                for (const folder of response.data.files) {
                    folderIds.push(folder.id);
                    queue.push(folder.id);
                }
            }

            return folderIds;
        };

        const folderIds = await getAllSubfolderIds(folderId);

        // Preparar chunks de 10 folderIds por petición para no saturar la API
        const chunkSize = 10;
        const allFiles = [];

        for (let i = 0; i < folderIds.length; i += chunkSize) {
            const chunk = folderIds.slice(i, i + chunkSize);
            const queryParts = chunk.map(id => `'${id}' in parents`).join(' or ');
            const fullQuery = `(${queryParts}) and trashed = false and (mimeType contains 'audio' or mimeType contains 'video')`;

            const response = await drive.files.list({
                q: fullQuery,
                fields: 'files(id, name, mimeType, createdTime, modifiedTime)',
                pageSize: 1000,
            });

            allFiles.push(...response.data.files);
        }

        // Ordenar por fecha de modificación o creación
        allFiles.sort((a, b) => {
            const dateA = new Date(a.modifiedTime || a.createdTime);
            const dateB = new Date(b.modifiedTime || b.createdTime);
            return dateB - dateA;
        });

        // Paginar
        const paginatedFiles = allFiles.slice(startIndex, startIndex + limit);

        const formattedFiles = paginatedFiles.map(file => ({
            id: file.id,
            name: file.name,
            type: file.mimeType.startsWith('video') ? 'video' : 'audio',
            createdTime: file.createdTime,
            modifiedTime: file.modifiedTime
        }));

        res.json({
            page,
            limit,
            total: allFiles.length,
            files: formattedFiles
        });

    } catch (error) {
        console.error('Error al obtener archivos:', error.message);
        res.status(500).send('Error al obtener archivos');
    }
};


const getFilesFromFolder = async (folderId) => {
    try {
        let allFiles = [];
        let pageToken = null;
        // const drive = google.drive({ version: 'v3', auth: oauth2Client });

        do {
            const response = await drive.files.list({
                q: `'${folderId}' in parents and trashed = false`,
                fields: 'nextPageToken, files(id, name, mimeType, parents)',
                pageSize: 1000,
                pageToken,
            });


            allFiles.push(...response.data.files);
            pageToken = response.data.nextPageToken;
        } while (pageToken);


        return allFiles;
    } catch (error) {
        console.error('Error al obtener archivos:', error);
        throw new Error('Error al obtener archivos');
    }
};

// Obtener subcarpetas
const getAllSubfolders = async (parentId) => {
    // const drive = google.drive({ version: 'v3', auth: oauth2Client });
    let subfolders = [];
    let pageToken = null;

    do {
        const response = await drive.files.list({
            q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'nextPageToken, files(id, name)',
            pageSize: 1000,
            pageToken,
        });

        subfolders.push(...response.data.files);
        pageToken = response.data.nextPageToken;
    } while (pageToken);

    return subfolders;
};

// Guardar archivos en base de datos
const saveFilesToDatabase = async (files, folderName, folderId) => {
    for (const file of files) {
        const type = file.mimeType.startsWith('video') ? 'video'
            : file.mimeType.startsWith('audio') ? 'audio'
                : null;

        if (type) {
            await Files.findOrCreate({
                where: { idFile: file.id },
                defaults: {
                    name: file.name,
                    type,
                    folderName: folderName,
                    folderId: file.parents ? file.parents[0] : null,
                }
            });
        }
    }
};

// Procesar carpeta + subcarpetas
const processFolderAndSubfolders = async (folderId, folderName = 'Raíz') => {
    try {
        // Obtener archivos de la carpeta actual
        const files = await getFilesFromFolder(folderId);
        await saveFilesToDatabase(files, folderName, folderId);

        // Obtener subcarpetas
        const subfolders = await getAllSubfolders(folderId);
        for (const subfolder of subfolders) {
            await processFolderAndSubfolders(subfolder.id, subfolder.name); // pasa el nombre de la subcarpeta
        }
    } catch (error) {
        console.error(`Error al procesar la carpeta ${folderId}:`, error.message);
    }
};

// Controlador de ruta
export const saveFilesfromFolder = async (req, res) => {
    try {
        const folderId = req.params.folderId;


        await processFolderAndSubfolders(folderId);
        res.status(200).json({ message: 'Archivos guardados exitosamente.' });
    } catch (error) {
        res.status(500).json({ error: 'Hubo un error al guardar los archivos.' });
    }
};

export const getCountFilesFolder = async (req, res) => {
    try {
        const folderId = req.params.folderId; // <-- CAMBIO AQUÍ

        if (!folderId) {
            return res.status(400).json({ error: 'Se requiere el folderId' });
        }

        const totalFiles = await countFilesRecursively(folderId);
        res.json({ count: totalFiles });

    } catch (error) {
        console.error('Error al contar archivos:', error);
        res.status(500).json({ error: 'Error al contar archivos en Google Drive' });
    }
};


async function countFilesRecursively(folderId) {
    let total = 0;

    const list = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id, mimeType)',
        pageSize: 1000,
    });

    const files = list.data.files;

    for (const file of files) {
        if (file.mimeType === 'application/vnd.google-apps.folder') {
            // Es una subcarpeta, contar recursivamente
            total += await countFilesRecursively(file.id);
        } else {
            total += 1; // Es un archivo
        }
    }

    return total;
}