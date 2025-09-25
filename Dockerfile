# Используем официальный Node.js LTS образ
FROM node:20

# Создаем рабочую директорию
WORKDIR /usr/src/app

# Копируем package.json и package-lock.json (если есть)
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем весь проект
COPY . .

# Устанавливаем zip утилиту
RUN apt-get update && apt-get install -y zip && rm -rf /var/lib/apt/lists/*

# Дефолтная команда: сборка в tmp, потом копирование в смонтированный dist
CMD ["sh", "-c", "\
mkdir -p /tmp/build/chrome /tmp/build/firefox && \
npm run build:content && \
cp manifest.json /tmp/build/chrome/ && cp -r src/*.js /tmp/build/chrome/ && cp -r icons /tmp/build/chrome/ && cp popup.html /tmp/build/chrome/ && cp privacy.html /tmp/build/chrome/ && \
(cd /tmp/build/chrome && zip -r chrome.zip *) && \
cp manifest.json /tmp/build/firefox/ && cp -r src/*.js /tmp/build/firefox/ && cp -r icons /tmp/build/firefox/ && cp popup.html /tmp/build/firefox/ && cp privacy.html /tmp/build/firefox/ && \
(cd /tmp/build/firefox && zip -r firefox.zip *) && \
mkdir -p /usr/src/app/dist && \
cp /tmp/build/chrome/chrome.zip /usr/src/app/dist/ && cp /tmp/build/firefox/firefox.zip /usr/src/app/dist/ \
"]
