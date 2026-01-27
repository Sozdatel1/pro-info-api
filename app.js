const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

// 1. Настройка CORS для Express
app.use(cors({
    origin: "*", 
    methods: ["GET", "POST"]
}));

// 2. Ответ для главной страницы
app.get('/', (req, res) => {
    res.json({ message: "Бэкенд Про-Инфо работает!" });
});

const server = http.createServer(app);

// 3. Настраиваем сокеты (добавлены пропущенные запятые)
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"], // тут была пропущена запятая
        credentials: true
    }, // тут была пропущена запятая
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

const axios = require('axios');

// Добавьте эти маршруты к вашим существующим (где сокеты)

// 1. Прокси скрипта
app.get('/lib/metrika.js', async (req, res) => {
    try {
        const response = await axios.get('https://mc.yandex.ru');
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Access-Control-Allow-Origin', '*'); // Разрешаем Vercel забрать файл
        res.send(response.data);
    } catch (e) {
        res.status(500).send('Error');
    }
});

// 2. Прокси данных
// Было: app.all('/collect/*', ...
// Стало (исправленный вариант для новых версий Express):
app.all('/collect/(.*)', async (req, res) => {
    try {
        // Извлекаем путь, который идет после /collect/
        const pathAfterCollect = req.params[0]; 
        const targetUrl = `https://mc.yandex.ru{pathAfterCollect}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;
        
        const response = await axios({
            method: req.method,
            url: targetUrl,
            data: req.body,
            headers: {
                'X-Forwarded-For': req.headers['x-forwarded-for'] || req.ip,
                'User-Agent': req.headers['user-agent']
            },
            responseType: 'arraybuffer' // Важно для корректной пересылки данных
        });

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(response.status).send(response.data);
    } catch (e) {
        // Если ошибка — просто отдаем 200, чтобы не спамить в консоль браузера
        res.status(200).send();
    }
});



const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
