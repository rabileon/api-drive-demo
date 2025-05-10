import dotenv from 'dotenv';
dotenv.config();

import { dbConnectMysql } from './config/mysql.js';

import express from 'express';
import cors from 'cors';
import routes from './routes/index.js'; // o './routes.js' si es un solo archivo

const app = express();


app.use(cors());
app.use(express.json());


const port = process.env.PORT || 8000;

app.use("/api", routes);


app.listen(port, () => {
    console.log(`Server running on port ${port}`);
})

import { exec } from 'child_process';

exec('ffmpeg -version', (error, stdout, stderr) => {
    if (error) {
        console.error('FFmpeg no está disponible:', error);
    } else {
        console.log('FFmpeg está disponible:\n', stdout);
    }
});

dbConnectMysql();