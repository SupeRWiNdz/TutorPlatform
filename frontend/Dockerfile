FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
# Используем npm install вместо npm ci, чтобы подтянуть зависимости заново
RUN npm install

COPY . .

# Запуск dev-сервера
CMD ["npm", "start", "--", "--host", "0.0.0.0", "--poll", "1000"]