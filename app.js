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
            // Добавляем заголовки, которые Яндекс ждет от живого человека
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': 'https://yandex.ru',
                'Cache-Control': 'no-cache'
            },
            timeout: 10000 // Увеличиваем ожидание до 10 секунд
        });

        if (response.data && response.data.length > 500) {
            res.send(response.data);
        } else {
            throw new Error('Слишком короткий ответ от Яндекса');
        }
    } catch (e) {
        console.error("Яндекс все еще блокирует запрос:", e.message);
        // Если Яндекс не отдаёт скрипт, загружаем его через официальное зеркало (CDN)
        try {
            const fallback = await axios.get('https://cdn.jsdelivr.net');
            res.send(fallback.data);
        } catch (e2) {
            res.send('console.log("Metrika: all sources blocked");');
        }
    }
});



// МАРШРУТ 2: Принимаем данные (используем Regex для стабильности)
// Используем строку с подстановочным знаком для надежности
// Мы даем имя параметру :wildcard и разрешаем в нем любые символы (*)
app.all('/collect/:wildcard(*)', async (req, res) => {
    try {
        // Извлекаем то, что попало в "звездочку"
        const path = req.params.wildcard;
        // Собираем Query-строку (все что после ?)
        const query = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
        
        // Формируем чистый URL для Яндекса
        const targetUrl = `https://mc.yandex.ru{path}${query}`;

        const response = await axios({
            method: req.method,
            url: targetUrl,
            data: req.body,
            headers: {
                'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
                'X-Forwarded-For': req.headers['x-forwarded-for'] || req.ip
            },
            responseType: 'arraybuffer'
        });

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(response.status).send(response.data);
    } catch (e) {
        // Вместо падения сервера просто логируем ошибку
        console.error(`Ошибка прокси: ${e.message}`);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).send(''); 
    }
});







const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
