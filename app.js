const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

// 1. ИСПРАВЛЯЕМ CORS: разрешаем твоему сайту на Vercel брать данные
app.use(cors({
    origin: "*", // Твой домен на Vercel
    methods: ["GET", "POST"]
}));

// 2. ИСПРАВЛЯЕМ 404: добавляем ответ для главной страницы
app.get('/', (req, res) => {
    res.json({ message: "Бэкенд Про-Инфо работает!" });
});

const server = http.createServer(app);

// 3. Настраиваем сокеты с учетом CORS
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
        credentials: true
    }
    allowEIO3: true 
});

let onlineCount = 0;

io.on('connection', (socket) => {
    onlineCount++;
    io.emit('updateCount', onlineCount);

    socket.on('disconnect', () => {
        onlineCount--;
        io.emit('updateCount', onlineCount);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
