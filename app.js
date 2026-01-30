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

// 1. Функция кражи и маскировки кода
async function refreshMetrika() {
    try {
        const res = await axios.get('https://yastat.net');
        let code = res.data;
        
        // Меняем оригинальный адрес сбора данных на твой прокси
        code = code.replace(/https:\/\/mc\.yandex\.ru/g, 'https://pro-info-api.onrender.com');

        // ЖЕСТКАЯ ОБФУСКАЦИЯ (делает код неузнаваемым для антивируса)
        const obfuscated = JavaScriptObfuscator.obfuscate(code, {
            compact: true,
            controlFlowFlattening: true, // Запутывает логику
            numbersToExpressions: true,  // Превращает числа в формулы
            splitStrings: true,          // Режет строки (чтобы слово "yandex" не нашли)
            stringArrayThreshold: 1
        });
        
        cachedCode = obfuscated.getObfuscatedCode();
        console.log("✅ Код зашифрован");
    } catch (e) { console.error("Ошибка кэша"); }
}

// Обновляем кэш при запуске
refreshMetrika();

// 2. Раздаем код под видом CSS (антивирусы лояльнее к стилям)
app.get('/style/main.css', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript'); // Но браузер поймет как JS
    res.send(cachedCode);
});

// 3. Прокси-роут для данных
app.use('/log', async (req, res) => {
    try {
        const path = req.originalUrl.replace('/log', '');
        const targetUrl = `https://mc.yandex.ru${path}`;
        
        const response = await axios({
            method: req.method,
            url: targetUrl,
            data: req.body,
            headers: {
                'User-Agent': req.headers['user-agent'],
                'X-Forwarded-For': req.headers['x-forwarded-for'] || req.ip,
                'Content-Type': 'text/plain' // Маскировка содержимого
            },
            responseType: 'arraybuffer'
        });
        res.status(response.status).send(response.data);
    } catch (e) { res.status(200).send(''); }
});

app.listen(process.env.PORT || 3000);
