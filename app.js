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
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/javascript');
    
    try {
        const response = await axios.get('https://mc.yandex.ru', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        // Проверяем, что данные пришли
        if (response.data) {
            res.send(response.data);
        } else {
            throw new Error('Empty response');
        }
    } catch (e) {
        console.error("Ошибка при связи с Яндексом:", e.message);
        // Если Яндекс не отдал код, отдаем "заглушку", чтобы сайт не выдавал ошибку 500
        res.send('console.log("Metrika: fallback mode active");');
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
