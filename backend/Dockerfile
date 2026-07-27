FROM node:18-alpine

WORKDIR /app

# Копируем package.json и lock-файлы
COPY package*.json ./

# Устанавливаем зависимости (для продакшена можно --only=production)
RUN npm ci

# Копируем весь код
COPY . .

# Открываем порт
EXPOSE 3000

# Запускаем (используем исправленный скрипт start)
CMD ["npm", "start", "--", "--host", "0.0.0.0", "--poll", "1000", "--allowed-hosts", "*"]