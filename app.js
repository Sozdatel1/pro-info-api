const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(express.json());
const { Redis } = require('@upstash/redis');
const DEV_KEY = process.env.DEV_KEY; 
// Разрешаем фронтенду подключаться
app.use(express.json());

// 1. Настройка CORS для Express
// На Render в app.js (примерно 28 строка)
const allowedOrigins = [
    'https://pro-info.vercel.app',
    'http://127.0.0.1:5500',
    'http://localhost:5500'
];

app.use(cors({
    origin: function (origin, callback) {
        // Логируем для отладки
        console.log("Пришел запрос с Origin:", origin);

        // Разрешаем, если адреса нет (например, серверные запросы) или он в списке
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.error("CORS отклонил запрос с:", origin);
            callback(new Error('CORS blocked this request'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
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






const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// ПАРОЛЬ: измени 'admin123' на свой!
const ADMIN_PASS = process.env.ADMIN_PASS; 

// Маршрут получения сообщений
app.post('/get-msgs', async (req, res) => {
    try {
        if (req.body.pass !== ADMIN_PASS) return res.status(403).json({error: "Нет доступа"});
        
        // Получаем последние 100 сообщений из списка 'chat'
        const rawMsgs = await redis.lrange('chat', 0, 99);
        // Декодируем и переворачиваем, чтобы новые были внизу
        const msgs = rawMsgs.reverse();
        res.json(msgs);
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

// Маршрут отправки сообщения
app.post('/add-msg', async (req, res) => {
    try {
        const { pass, text, author } = req.body; 
        if (req.body.pass !== ADMIN_PASS) return res.status(403).json({error: "Нет доступа"});
        
        const newMsg = {
             
    text: req.body.text,
    author: author || "Аноним", 
    // Эта строка гарантирует московское время вне зависимости от сервера
    time: new Date().toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' })
  
        };

        
        // Сохраняем в начало списка
        await redis.lpush('chat', newMsg);
        res.json({status: "ok"});
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});
// Роут для удаления сообщения
app.post('/delete-msg', async (req, res) => {
    try {
        const { pass, msgData } = req.body;
        if (pass !== ADMIN_PASS) return res.status(403).json({ error: "Нет доступа" });

        // Удаляем именно то сообщение, которое совпадает по тексту и времени
        // Мы превращаем объект обратно в строку, так как в Redis всё хранится строками
        await redis.lrem('chat', 0, JSON.stringify(msgData));
        
        res.json({ status: "deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});











// Настройка CORS для работы с Cookie


const ADMIN_HOME = process.env.ADMIN_HOME;

app.post('/api/login', (req, res) => {
    if (req.body.password === ADMIN_HOME) {
        // Устанавливаем куку, которая будет жить 1 день
        res.cookie('access_pass', ADMIN_HOME, {
            maxAge: 86400000, // 24 часа
            httpOnly: false,  // Чтобы JS на фронте мог её прочитать (для простоты)
            secure: true,     // Обязательно для Render (HTTPS)
            sameSite: 'none'  // Обязательно для разных доменов (Vercel -> Render)
        });
        return res.json({ success: true });
    }
    res.status(401).json({ success: false });
});

// Проверка доступа
app.get('/api/check', (req, res) => {
    // В реальном мире тут проверяется ТОКЕН, но раз просил только ПАРОЛЬ:
    if (req.headers.cookie?.includes(`access_pass=${ADMIN_HOME}`)) {
        res.json({ authorized: true, data: "Добро пожаловать в ваш кабинет!" });
    } else {
        res.status(401).json({ authorized: false });
    }
});


let pagesStatus = {
    global: false,      // Общий рубильник (весь сайт)
    '/index.html': false,
    '/second.html': false,
    '/two page.html': false,
    '/carta.html': false,
    '/fact.html': false,
    '/holiday.html': false,
    '/why.html': false,
    // и так далее для всех 8 страниц
};

// Универсальный роут для переключения
app.post('/api/admin/toggle-page', (req, res) => {
    if (req.headers.cookie?.includes(`access_pass=${ADMIN_HOME}`)) {
        const { path, status } = req.body; // Получаем путь (например 'global' или '/about.html')
        
        pagesStatus[path] = status;
        
        res.json({ success: true, pagesStatus });
    } else {
        res.status(403).send("No access");
    }
});

// Публичный роут для проверки статуса
app.get('/api/public/status', (req, res) => {
    res.json(pagesStatus); 
});


app.get('/api/logout', (req, res) => {
    res.clearCookie('access_pass', {
        secure: true,
        sameSite: 'none'
    });
    res.json({ success: true });
});







const { Sequelize, DataTypes } = require('sequelize');

const fs = require('fs');
const path = require('path');



// 1. ПОДКЛЮЧЕНИЕ К БАЗЕ (Ссылку DATABASE_URL вставь в настройки Render!)
const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    logging: false
});

// 2. МОДЕЛЬ СТАТЬИ
const Article = sequelize.define('Article', {
    title: DataTypes.STRING,
    content: DataTypes.TEXT
});

// 3. ТВОЙ HTML-ШАБЛОН (Вставь свой дизайн сюда)
const myLayout = (title, content) => `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        /* ТВОЙ CSS ДИЗАЙН */
        body { background: #121212; color: #eee; font-family: sans-serif; line-height: 1.6; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; background: #1e1e1e; padding: 30px; border-radius: 10px; }
        h1 { color: #00ffcc; border-bottom: 1px solid #333; padding-bottom: 10px; }
        .text { white-space: pre-wrap; font-size: 18px; margin-top: 20px; }
        .back-btn { display: inline-block; margin-top: 30px; color: #00ffcc; text-decoration: none; border: 1px solid #00ffcc; padding: 10px 20px; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${title}</h1>
        <div class="text">${content}</div>
        <a href="https://ТВОЙ-САЙТ.vercel.app" class="back-btn">← На главную (Vercel)</a>
    </div>
</body>
</html>
`;

// 4. МАРШРУТ: ЗАГРУЗКА ИЗ ТВОЕГО .TXT ФАЙЛА
// Используй так: /upload?name=myfile.txt
app.get('/upload', async (req, res) => {
    const fileName = req.query.name;
    if (!fileName) return res.send('Укажи имя файла в URL: ?name=статья.txt');

    try {
        const filePath = path.join(__dirname, 'my_articles', fileName);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        
        const lines = fileContent.split('\n');
        const title = lines[0].trim();
        const content = lines.slice(1).join('\n').trim();

        const saved = await Article.create({ title, content });
        res.send(`✅ Статья "${saved.title}" успешно добавлена в базу! ID: ${saved.id}`);
    } catch (err) {
        res.status(500).send('Ошибка: файл не найден в папке my_articles. ' + err.message);
    }
});

// 5. МАРШРУТ: ПРОСМОТР СТАТЬИ В ТВОЕМ HTML
app.get('/view/:id', async (req, res) => {
    try {
        const article = await Article.findByPk(req.params.id);
        if (!article) return res.status(404).send('Статья не найдена');
        
        // Отправляем готовую упакованную страницу
        res.send(myLayout(article.title, article.content));
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 6. МАРШРУТ: СПИСОК ВСЕХ СТАТЬИ (Для главной на Vercel)
app.get('/all', async (req, res) => {
    const articles = await Article.findAll({ order: [['id', 'DESC']] });
    res.json(articles);
});






const PORT = process.env.PORT || 10000; // Render любит 10000 или PORT
server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
