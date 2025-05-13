import axios from 'axios';
import { setCache, getCache } from '../config/redis.js'; // Importamos las funciones
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { Files } from '../config/mysql.js';
import { stringify } from 'querystring';

const tempPath = path.resolve(new URL(import.meta.url).pathname, '../../tempFiles');

export const getAuth = async (req, res) => {
    try {
        // Hacer la solicitud a la API de OpenDrive para obtener el SessionID
        const response = await axios.post('https://dev.opendrive.com/api/v1/session/login.json', {
            username: process.env.OPENDRIVE_USER,
            passwd: process.env.OPENDRIVE_PASS
        });

        console.log('Respuesta de OpenDrive:', response.data);
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


export const listFilesInFolder = async (req, res) => {
    try {
        const folderId = req.params.folderId;
        // Obtener el SessionID de Redis




        // Hacer la solicitud a la API de OpenDrive para listar los archivos en la carpeta
        const response = await axios.get(`https://dev.opendrive.com/api/v1/folder/shared.json/${folderId}?order_type=asc`);

        res.json(response.data.Files);
    }
    catch (error) {
        // console.error('Error al listar los archivos en la carpeta:', error);
        throw error; // Lanza el error para que pueda ser manejado por el llamador
    }

};

export const getPreview = async (req, res) => {
    const fileId = req.params.id;

    try {
        // 1. Obtener metadatos desde la API pública de OpenDrive
        const { data: file } = await axios.get(`https://dev.opendrive.com/api/file/info.json/${fileId}`);

        const mime = file.MimeType || file.Extension;
        const isVideo = mime && mime.includes('mp4');
        const isAudio = mime && (
            mime.includes('mp3') ||
            mime.includes('mpeg') ||
            mime.includes('audio/wav') ||
            mime.includes('audio/x-wav') ||
            mime.includes('audio/wave') ||
            mime.includes('audio')
        );

        if (!isVideo && !isAudio) {
            return res.status(400).send('Archivo no compatible para preview');
        }

        const outputFormat = isVideo ? 'mp4' : 'mp3';
        res.setHeader('Content-Type', isVideo ? 'video/mp4' : 'audio/mpeg');

        const streamUrl = file.TempStreamingLink || file.StreamingLink;
        if (!streamUrl) {
            return res.status(404).send('No se pudo obtener el enlace de streaming');
        }

        const response = await axios.get(streamUrl, { responseType: 'stream' });

        if (isAudio) {
            const ffmpegStream = ffmpeg(response.data)
                .outputOptions('-map 0:a') // <--- Excluir la imagen incrustada
                .setStartTime(0)
                .audioBitrate('64k') // Más semántico
                .format('adts') // Esto produce AAC en contenedor ADTS
                .audioCodec('aac')

            res.on('close', () => {
                try {
                    ffmpegStream.kill('SIGKILL');
                } catch (_) { }
            });

            ffmpegStream
                .on('start', cmd => console.log('FFmpeg:', cmd))
                .on('error', err => {
                    console.error('FFmpeg error:', err.message);
                    if (!res.headersSent) res.status(500).send('Error al procesar preview');
                })
                .pipe(res, { end: true });
        } else {
            const tempFile = path.join(tempPath, `video_${Date.now()}.mp4`);
            const writer = fs.createWriteStream(tempFile);

            response.data.pipe(writer);

            writer.on('finish', () => {
                const ffmpegStream = ffmpeg(tempFile)
                    .setStartTime(0)
                    .duration(80)
                    .outputOptions([
                        '-map 0:v:0', // Mapeo de video
                        '-map 0:a:0', // Mapeo de audio
                        '-c:v copy', // Copiar video sin re-encodear
                        '-movflags frag_keyframe+empty_moov'
                    ])
                    .format('mp4');

                res.on('close', () => {
                    try {
                        ffmpegStream.kill('SIGKILL');
                    } catch (_) { }
                    fs.unlink(tempFile, () => { });
                });

                ffmpegStream
                    .on('start', cmd => console.log('FFmpeg:', cmd))
                    .on('error', err => {
                        console.error('FFmpeg error:', err.message);
                        if (!res.headersSent) res.status(500).send('Error al procesar preview');
                        fs.unlink(tempFile, () => { });
                    })
                    .pipe(res, { end: true });
            });

            writer.on('error', err => {
                console.error('Error escribiendo archivo temporal:', err.message);
                res.status(500).send('Error al descargar video');
            });
        }

    } catch (error) {
        console.error('Error general:', error.message);
        if (!res.headersSent) {
            res.status(500).send('Error: ' + error.message);
        }
    }
};

export const syncData = async (req, res) => {

    const { folderId } = req.params;

    try {
        await syncFolderRecursive(folderId);
        res.status(200).json({ message: 'Carpeta sincronizada correctamente.' });
    } catch (error) {
        console.error('Error al sincronizar carpeta:', error.message);
        res.status(500).json({ error: 'Ocurrió un error al sincronizar la carpeta.' });
    }
};


export const syncFolderRecursive = async (folderId, rootFolder = "") => {
    try {
        const res = await axios.get(`https://dev.opendrive.com/api/v1/folder/shared.json/${folderId}?order_type=asc`);

        if ((!res.data.Folders || res.data.Folders.length === 0) && (!res.data.Files || res.data.Files.length === 0)) {
            console.log(`No hay archivos en la carpeta ${folderId}`);
            return;
        }

        const filesApi = res.data.Files || [];
        const folders = res.data.Folders || [];
        const folderRootData = res.data.FolderInfo;

        // Guardar archivos del folder actual
        for (const file of filesApi) {
            const cleanedName = file.Name.replace(" Download from www.thebestmixcleanvideo.net", "");
            await Files.findOrCreate({
                where: { fileId: file.FileId },
                defaults: {
                    name: cleanedName,
                    extension: file.Extension,
                    folderId: folderRootData.FolderID,
                    folderName: folderRootData.Name.toUpperCase(),
                    folderRoot: rootFolder?.trim() || folderRootData.Name,
                    downloadLink: file.DownloadLink,
                    dateModifiedFile: new Date(file.DateModified * 1000),
                },
            });
        }

        // Recursividad: recorrer subcarpetas
        for (const subfolder of folders) {

            await syncFolderRecursive(subfolder.FolderID, folderRootData.Name); // llamada recursiva
        }
    } catch (err) {
        console.error(`Error al procesar carpeta ${folderId}:`, err.message);
        throw err;
    }
};