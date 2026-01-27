const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const app = express();
app.use(express.json());
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


// Добавьте эти маршруты к вашим существующим (где сокеты)
app.get('/lib/metrika.js', async (req, res) => {
    try {
        const response = await axios.get('https://mc.yandex.ru', {
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(response.data);
    } catch (e) {
        console.error('Ошибка проксирования:', e.message);
        // Если Яндекс недоступен, отдаем пустой корректный JS, чтобы не было ошибки 500
        res.setHeader('Content-Type', 'application/javascript');
        res.send('console.log("Metrika proxy: temporarily unavailable");');
    }
});


// МАРШРУТ 2: Принимаем данные (используем Regex для стабильности)
app.all(/^\/collect\/(.*)/, async (req, res) => {
    try {
        const path = req.params[0];
        const query = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
        const targetUrl = `https://mc.yandex.ru{path}${query}`;

        const response = await axios({
            method: req.method,
            url: targetUrl,
            data: req.body,
            headers: {
                'User-Agent': req.headers['user-agent'],
                'X-Forwarded-For': req.headers['x-forwarded-for'] || req.ip
            },
            responseType: 'arraybuffer'
        });

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(response.status).send(response.data);
    } catch (e) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).send(''); 
    }
});




const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
