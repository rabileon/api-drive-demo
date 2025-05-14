import sequelize from 'sequelize';
import { filesModel } from '../models/files.js';
import dotenv from 'dotenv';
import { genresModel, initializeGenres, genresInit } from '../models/genres.js';
dotenv.config();  // Cargar las variables desde el archivo .env

const env = process.env.ENV;

const config = {
    DEV: {
        database: process.env.MYSQL_DATABASE_DEV,
        username: process.env.MYSQL_USER_DEV,
        password: process.env.MYSQL_PASSWORD_DEV,
        host: process.env.MYSQL_HOST_DEV,
        port: process.env.MYSQL_PORT_DEV,
    },
    PROD: {
        database: process.env.MYSQL_DATABASE_PROD,
        username: process.env.MYSQL_USER_PROD,
        password: process.env.MYSQL_PASSWORD_PROD,
        host: process.env.MYSQL_HOST_PROD,
        port: process.env.MYSQL_PORT_PROD,
    },
};



const { database, username, password, host, port } = config[env];

export const db = new sequelize(database, username, password, {
    dialect: 'mysql',
    host,
    port,

});

export const Files = filesModel(db, sequelize);

export const Genres = genresModel(db, sequelize);
// await initializeGenres(Genres, genresInit);

export const dbConnectMysql = async () => {
    try {
        await db.authenticate();

        db.sync({ force: false }).then(() => {
            console.log(`Database & tables created here!`);
        });
        console.log('CONEXION A LA BASE DE DATOS MYSQL EXITOSA');
    } catch (error) {

        console.error('CONEXION ERRONEA A LA BASE DE DATOS MYSQL', error);
    }
};


