const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const app = express();
const hardcodedUrl = "https://yastat.net";

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

async function downloadAndPrepare() {
    const filePath = path.join(__dirname, 'original_tag.js');
    
    try {
        console.log("📡 Пытаюсь скачать свежий tag.js...");
        // ИСПРАВЛЕНО: Указан ПОЛНЫЙ путь к файлу на CDN
        const res = await axios.get('https://cdn.jsdelivr.net');
        
        if (typeof res.data !== 'string' || res.data.length < 5000) {
             throw new Error("Скачанный файл слишком мал или это не JS");
        }

        fs.writeFileSync(filePath, res.data);
        console.log("✅ Файл сохранен как original_tag.js");
        
        processLocalFile(); 
    } catch (err) {
        console.error("❌ Не удалось скачать файл: " + err.message);
        processLocalFile();
    }
}

function processLocalFile() {
    try {
        const filePath = path.join(__dirname, 'original_tag.js');
        if (!fs.existsSync(filePath)) throw new Error("Файл отсутствует");

        let code = fs.readFileSync(filePath, 'utf8');

        // ИСПРАВЛЕНО: Добавлен /log, чтобы данные попадали в твой роут проксирования
        code = code.replace(/https:\/\/mc\.yandex\.ru/g, 'https://pro-info-api.onrender.com');

        const result = JavaScriptObfuscator.obfuscate(code, {
            compact: true,
            stringArray: true,
            rotateStringArray: true,
            stringArrayThreshold: 1
        });
        
        obfuscatedCode = result.getObfuscatedCode();
        console.log("💎 ПОБЕДА! Код из файла зашифрован.");
    } catch (e) {
        console.error("❌ Ошибка обработки: " + e.message);
    }
}


processLocalFile();

// Отдаем "невидимый" скрипт
app.get('/style/main.css', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(obfuscatedCode || 'console.log("File not found")');
});

// Проксируем данные в Яндекс (Backend-to-Backend)
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
    } catch (e) { res.status(200).send(''); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Сервер на порту ${PORT}`));
