
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