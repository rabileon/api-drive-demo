export const filesModel = (db, type) => {
    return db.define('files', {
        idFile: {
            type: type.STRING,
            allowNull: false,
        },
        name: {
            type: type.STRING,
        },
        type: {
            type: type.STRING,
        },
        folderId: {
            type: type.STRING,
        },

        folderName: {
            type: type.STRING,
        },
        folderRoot: {
            type: type.STRING,
        },
    }, {
        timestamps: true,
    });
};