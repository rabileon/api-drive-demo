
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

export const initializeGenres = async (GenresModel) => {
    const count = await GenresModel.count();
    if (count === 0) {
        await GenresModel.create({ name: 'All' });
        console.log('Género "All" creado como el primero');
    }
};