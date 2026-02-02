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




import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import 'dotenv/config';

const app = express();
 // Разрешаем запросы с твоего Vercel


const openai = new OpenAI({
  apiKey: process.env.AI_KEY // Ключ храни в настройках Render!
});

app.post('/ask', async (req, res) => {
  try {
    const { message } = req.body;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Дешевая и быстрая модель
      messages: [
        { role: "system", content: "Ты — веселый ИИ-помощник на сайте молодого разработчика. Отвечай кратко и с эмодзи!" },
        { role: "user", content: message }
      ],
    });

    res.json({ text: completion.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ error: "Что-то пошло не так" });
  }
});




const PORT = process.env.PORT || 10000; // Render любит 10000 или PORT
server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
