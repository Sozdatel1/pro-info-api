const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors()); // Чтобы твой сайт на GitHub мог достучаться до сервера
app.get('/test', (req, res) => {
    res.json({ message: "Связь с Render установлена!", time: new Date() });
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" } // Разрешаем подключения отовсюду
});

let onlineCount = 0;

io.on('connection', (socket) => {
    onlineCount++;
    io.emit('updateCount', onlineCount); // Отправляем всем новое число

    socket.on('disconnect', () => {
        onlineCount--;
        io.emit('updateCount', onlineCount);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Счетчик работает!'));
