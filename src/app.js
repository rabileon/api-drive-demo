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

dbConnectMysql();