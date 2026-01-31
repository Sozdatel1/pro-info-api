const express = require('express');
const cors = require('cors');
const { Redis } = require('@upstash/redis');

const app = express();

// Разрешаем фронтенду подключаться
app.use(cors());
app.use(express.json());

// Инициализация базы через переменные, которые ты вставил в Render
const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// ПАРОЛЬ: измени 'admin123' на свой!
const ADMIN_PASS = "admin123"; 

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
        if (req.body.pass !== ADMIN_PASS) return res.status(403).json({error: "Нет доступа"});
        
        const newMsg = {
            text: req.body.text,
            time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
        };
        
        // Сохраняем в начало списка
        await redis.lpush('chat', newMsg);
        res.json({status: "ok"});
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
