# Imagen base con Node y apt para instalar FFmpeg
FROM node:18

# Instala FFmpeg
RUN apt-get update && apt-get install -y ffmpeg

# Establece el directorio de trabajo
WORKDIR /app

# Copia archivos del proyecto
COPY . .

# Instala dependencias
RUN npm install

# Expone el puerto de tu app (ajusta si usas otro)
EXPOSE 8000

# Comando para ejecutar tu servidor
CMD ["node", "app.js"]