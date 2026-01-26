const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

// ИСПРАВЛЕНИЕ CORS: Разрешаем твоему сайту на Vercel обращаться к серверу
app.use(cors({
    origin: "https://pro-info.vercel.app", // Твой домен на Vercel
    methods: ["GET", "POST"]
}));

const server = http.createServer(app);

// Настройка Socket.io с поддержкой CORS
const io = new Server(server, {
    cors: {
        origin: "https://pro-info.vercel.app",
        methods: ["GET", "POST"]
    }
});

// Добавляем ответ на обычный запрос (чтобы не было 404)
app.get('/', (req, res) => {
    res.json({ message: "Сервер Про-Инфо активен!", online: onlineCount });
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
server.listen(PORT, () => console.log('Бэкенд запущен!'));
