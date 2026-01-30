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




const JavaScriptObfuscator = require('javascript-obfuscator');


let cachedCode = "";

async function refreshMetrika() {
     const sources = [
    'https://yastat.net',
    'https://mc.yandex.ru',
    'https://www.googletagmanager.com', // (просто для теста связи)
    'https://cdn.jsdelivr.net'
];


    for (let url of sources) {
        try {
            console.log(`Попытка загрузки: ${url}`);
            const res = await axios.get(url, { timeout: 10000 });
            let code = res.data;

            // Проверка: если в начале <!, значит это HTML (ошибка), а не JS
            if (typeof code === 'string' && code.trim().startsWith('<!')) {
                console.log(`⚠️ Источник ${url} отдал HTML вместо скрипта. Пропускаю...`);
                continue;
            }

            code = code.replace(/https:\/\/mc\.yandex\.ru/g, 'https://pro-info-api.onrender.com');

            const obfuscated = JavaScriptObfuscator.obfuscate(code, {
                compact: true,
                controlFlowFlattening: false, // Отключи для скорости, если падает
                stringArray: true,
                stringArrayThreshold: 1
            });
            
            cachedCode = obfuscated.getObfuscatedCode();
            console.log("✅ ПОБЕДА! Код зашифрован.");
            return; // Выходим из цикла, если всё ок
        } catch (e) {
            console.error(`❌ Ошибка на источнике ${url}: ${e.message}`);
        }
    }
    console.error("!!! КРИТИЧЕСКАЯ ОШИБКА: Ни один источник не доступен.");
}


refreshMetrika();

// Отдаем скрипт
app.get('/style/main.css', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.send(cachedCode || 'console.log("Server starting, please refresh...")');
});

// Проксируем данные
app.use('/log', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
        // Отрезаем /log из URL
        const path = req.originalUrl.replace('/log', '');
        const targetUrl = `https://mc.yandex.ru${path}`;
        
        const response = await axios({
            method: req.method,
            url: targetUrl,
            data: req.body,
            headers: {
                'User-Agent': req.headers['user-agent'],
                'X-Forwarded-For': req.headers['x-forwarded-for'] || req.ip,
                'Content-Type': 'text/plain'
            },
            responseType: 'arraybuffer'
        });
        res.status(response.status).send(response.data);
    } catch (e) { 
        res.status(200).send(''); 
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Сервер на порту ${PORT}`);
});
