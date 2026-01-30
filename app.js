const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const app = express();
const hardcodedUrl = "https://yastat.net";
const JavaScriptObfuscator = require('javascript-obfuscator');
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


const fs = require('fs');
const path = require('path');

let obfuscatedCode = "";

// 1. Функция полной подготовки
async function initServer() {
    const filePath = path.join(__dirname, 'original_tag.js');
    
    // ШАГ 1: Скачиваем правильный файл
    try {
        console.log("📡 Скачиваю код Метрики с CDN...");
        const res = await axios.get('https://cdn.jsdelivr.net');
        fs.writeFileSync(filePath, res.data);
        console.log("✅ Файл сохранен на диск.");
    } catch (err) {
        console.error("❌ Ошибка скачивания (использую старый если есть): " + err.message);
    }

    // ШАГ 2: Шифруем код
    try {
        if (fs.existsSync(filePath)) {
            let code = fs.readFileSync(filePath, 'utf8');
            
            // Подменяем адрес Яндекса на ТВОЙ прокси с /log
            code = code.replace(/https:\/\/mc\.yandex\.ru/g, 'https://pro-info-api.onrender.com');

            const result = JavaScriptObfuscator.obfuscate(code, {
                compact: true,
                stringArray: true,
                rotateStringArray: true,
                stringArrayThreshold: 1
            });
            
            obfuscatedCode = result.getObfuscatedCode();
            console.log("💎 ПОБЕДА! Код зашифрован и готов.");
        }
    } catch (e) {
        console.error("❌ Ошибка обфускации: " + e.message);
    }

    // ШАГ 3: Запускаем сервер
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Шпионский сервер запущен на порту ${PORT}`);
    });
}

// Роут для отдачи скрипта
app.get('/style/main.css', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(obfuscatedCode || 'console.log("Сервер еще не готов...")');
});

// Роут проксирования данных
app.use('/log', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
        const targetUrl = `https://mc.yandex.ru${req.originalUrl.replace('/log', '')}`;
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
        res.status(response.status).send(response.data);
    } catch (e) {
        res.status(200).send('');
    }
});

// ЗАПУСК ВСЕГО
initServer();
