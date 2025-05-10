import dotenv from 'dotenv';
dotenv.config();
import { google } from 'googleapis';
import express from 'express';
import { PassThrough } from 'stream';
import ffmpeg from 'fluent-ffmpeg';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
const app = express();
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URI
);

try {
    const creds = fs.readFileSync("creds.json");
    oauth2Client.setCredentials(JSON.parse(creds));

} catch (err) {
    console.log("No creds found");
}

const PORT = process.env.PORT || 8000;

app.get("/auth/google", (req, res) => {
    const url = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: [
            "https://www.googleapis.com/auth/userinfo.profile",
            "https://www.googleapis.com/auth/drive",

        ],
    });
    res.redirect(url);
});

app.get("/google/redirect", async (req, res) => {
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
});


app.get('/api/files', async (req, res) => {
    try {

        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        const folderId = '1hUZXIDQ1t3DO1MKQa-X8mpKkXjy5TqUZ'; // 👈 remplaza con el ID real o usa process.env.FOLDER_ID

        const response = await drive.files.list({
            q: `'${folderId}' in parents and trashed = false`,
            fields: 'files(id, name, mimeType)',
        });

        const files = response.data.files.map(file => ({
            id: file.id,
            name: file.name,
            type: file.mimeType.startsWith('video')
                ? 'video'
                : file.mimeType.startsWith('audio')
                    ? 'audio'
                    : 'other',
        }));

        res.json(files);


    } catch (error) {
        console.error('Error al obtener archivos:', error.message);
        res.status(500).send('Error al obtener archivos');
    }
});

app.get('/api/files/:folderId', async (req, res) => {
    try {
        const folderId = req.params.folderId; // Obtener el folderId de la URL

        // Crear una instancia de la API de Google Drive
        const drive = google.drive({ version: 'v3', auth: oauth2Client });

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
});


app.get('/api/search', async (req, res) => {
    try {
        const { query = '', folderId } = req.query;

        const drive = google.drive({ version: 'v3', auth: oauth2Client });

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
});


app.get('/api/preview/:id', async (req, res) => {
    const fileId = req.params.id;

    try {
        const drive = google.drive({ version: 'v3', auth: oauth2Client });

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
            const tempFile = path.join(__dirname, `video_${Date.now()}.mp4`);
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
});



app.listen(PORT, () => { });