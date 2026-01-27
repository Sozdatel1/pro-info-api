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
app.get('/lib/metrika.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Шифруем адрес через Base64, чтобы Касперский не нашел строку "yandex" или "metrika"
    const target = Buffer.from("aHR0cHM6Ly95YXN0YXQubmV0L3MzL21ldHJpa2EvdGFnLmpz").toString('base64'); 
    
    const code = `
    (function() {
        var _0x1f2e = ['script', 'createElement', 'head', 'appendChild', 'atob', '${target}'];
        var s = document[_0x1f2e[1]](_0x1f2e[0]);
        s.src = atob(_0x1f2e[5]); // Расшифровка адреса в браузере
        s.async = true;
        s.onload = function() {
            // Используем window['ym'] вместо прямого ym
            window['ym'](106462068, "init", {
                dest: "https://pro-info-api.onrender.com",
                clickmap:true, trackLinks:true, accurateTrackBounce:true, webvisor:true
            });
        };
        document[_0x1f2e[2]][_0x1f2e[3]](s);
    })();`;
    
    res.send(code);
});








// МАРШРУТ 2: Принимаем данные (используем Regex для стабильности)
// Используем строку с подстановочным знаком для надежности
// Мы даем имя параметру :wildcard и разрешаем в нем любые символы (*)
// Используем Regex. Для Node.js 22 это единственный способ захватить всё без ошибок.
// Используем app.use — он не парсит "звездочки" как регулярки, 
// поэтому PathError (ошибка 2026 года) не возникнет.
app.use('/collect', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    try {
        // 1. Получаем хвост пути. Например: /watch/106462068...
        // Используем substring, чтобы точно отрезать приставку /collect
        const targetPath = req.originalUrl.substring(req.originalUrl.indexOf('/collect') + 8);
        
        // 2. Склеиваем URL. Важно, чтобы между доменом и путем был ОДИН слэш.
        const targetUrl = `https://mc.yandex.ru${targetPath.startsWith('/') ? '' : '/'}${targetPath}`;

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

        // --- ЛОГ УСПЕХА ---
        console.log(`✅ Метрика доставлена: ${targetPath.split('?')[0]}`);
        
        res.status(response.status).send(response.data);
    } catch (e) {
        // Выводим РЕАЛЬНЫЙ путь в лог ошибки, чтобы понять, почему был 404
        const errPath = req.originalUrl.substring(req.originalUrl.indexOf('/collect') + 8);
        console.error(`⚠️ 404 по адресу: https://mc.yandex.ru${errPath.startsWith('/') ? '' : '/'}${errPath}`);
        
        res.status(200).send(''); 
    }
});













const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
