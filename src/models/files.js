
export const filesModel = (db, type) => {
    return db.define('file_storage', {
        id: {
            type: type.UUID,
            defaultValue: type.UUIDV4, // o UUIDV1 si lo prefieres
            primaryKey: true,
            allowNull: false
        },
        fileId: {
            type: type.STRING,
            allowNull: false,
            unique: true,
        },
        name: {
            type: type.TEXT,
        },
        extension: {
            type: type.STRING,
        },
        categoria: {
            type: type.INTEGER,
        },
        folderId: {
            type: type.STRING,
        },
        folderName: {
            type: type.STRING,
        },
        genre: {
            type: type.STRING,
        },
        folderRoot: {
            type: type.STRING,
        },
        downloadLink: {
            type: type.TEXT,
        },
        dateModifiedFile: {
            type: type.DATE,
        },
    }, {
        timestamps: true,
    });
};