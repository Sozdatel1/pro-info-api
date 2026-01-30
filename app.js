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




const JavaScriptObfuscator = require('javascript-obfuscator');


let cachedCode = "";

async function refreshMetrika() {
    // Вбиваем прямую ссылку гвоздями прямо в запрос
    const hardcodedUrl = "https://yastat.net";
    
    try {
        console.log("🚀 ПРЯМОЙ ШТУРМ АДРЕСА: " + hardcodedUrl);
        const res = await axios.get(hardcodedUrl, { timeout: 15000 });
        let code = res.data;

        if (typeof code === 'string' && code.length > 5000) {
            // Маскировка
            code = code.replace(/https:\/\/mc\.yandex\.ru/g, 'https://pro-info-api.onrender.com');
            
            console.log("🛠 ОБФУСКАЦИЯ ЗАПУЩЕНА...");
            const obfuscated = JavaScriptObfuscator.obfuscate(code, {
                compact: true,
                stringArray: true
            });
            
            cachedCode = obfuscated.getObfuscatedCode();
            console.log("💎 ПОБЕДА!!! МЕТРИКА В КАРМАНЕ!");
        } else {
            console.log("⚠️ Яндекс отдал какую-то дичь вместо кода. Длина: " + (code ? code.length : 0));
            // Если Яндекс подвел, пробуем запасной CDN прямо здесь
            console.log("🚑 ПЛАН Б: Пробуем CDN...");
            const backup = await axios.get("https://cdn.jsdelivr.net");
            cachedCode = backup.data.replace(/https:\/\/mc\.yandex\.ru/g, 'https://pro-info-api.onrender.com');
            console.log("✅ CDN СПАС СИТУАЦИЮ!");
        }
    } catch (e) {
        console.error("🚨 ПОЛНЫЙ ПРОВАЛ: " + e.message);
    }
}


refreshMetrika();

app.get('/style/main.css', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.send(cachedCode || 'console.log("Сервер пустой")');
});

app.use('/log', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
        const path = req.originalUrl.replace('/log', '');
        const targetUrl = `https://mc.yandex.ru${path}`;
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
app.listen(PORT, () => {
    console.log(`🔥 ШПИОНСКИЙ СЕРВЕР НА ПОРТУ ${PORT}`);
});
