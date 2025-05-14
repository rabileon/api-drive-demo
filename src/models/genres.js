
export const genresModel = (db, type) => {
    return db.define('genres', {
        id: {
            type: type.UUID,
            defaultValue: type.UUIDV4, // o UUIDV1 si lo prefieres
            primaryKey: true,
            allowNull: false
        },
        name: {
            type: type.STRING,

        },
    }, {
        timestamps: true,
    });
};

export const genresInit = [
    { name: 'AFRO LATIN' },
    { name: 'AFROBEAT' },
    { name: 'AFROHOUSE' },
    { name: 'ALL' },
    { name: 'BRAZILIAN FUNK' },
    { name: 'COUNTRY' },
    { name: 'CUMBIA' },
    { name: 'DANCE' },
    { name: 'DEMBOW' },
    { name: 'DISCO' },
    { name: 'EDM' },
    { name: 'FUNKY HOUSE' },
    { name: 'HAPPY HARDCORE' },
    { name: 'HARD TRANCE' },
    { name: 'HIP HOP - RNB' },
    { name: 'HOUSE' },
    { name: 'LATIN DANCE' },
    { name: 'LATIN HOUSE' },
    { name: 'MAMBO LATINO' },
    { name: 'MASHUP' },
    { name: 'MELODIC TECHNO' },
    { name: 'NU DISCO' },
    { name: 'PIANO HOUSE' },
    { name: 'POP' },
    { name: 'POP DANCE' },
    { name: 'POP LATINO' },
    { name: 'REGGAE' },
    { name: 'REGGAETON' },
    { name: 'ROCK' },
    { name: 'ROCK-POP' },
    { name: 'SALSA' },
    { name: 'TECH HOUSE' },
    { name: 'TRANSITION' },
    { name: 'TRAP' },
    { name: 'TRAP LATINO' },
    { name: 'NORTEÑO' },
    { name: 'RETRO 80s' },
    { name: 'RETRO 90s' },
    { name: 'RETRO 70s' },
    { name: 'ELECTRO' },
    { name: 'OTHER' },

];

export const initializeGenres = async (GenresModel, genres) => {
    const count = await GenresModel.count();
    if (count === 0) {
        await GenresModel.bulkCreate(genres, { ignoreDuplicates: true }); // Evita duplicados si ya existen
        console.log('Géneros creados correctamente');
    }
};