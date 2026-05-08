const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const app = express();


const { Redis } = require('@upstash/redis');
const DEV_KEY = process.env.DEV_KEY; 
// Разрешаем фронтенду подключаться
app.use(express.json());

// 1. Настройка CORS для Express
// На Render в app.js (примерно 28 строка)
const allowedOrigins = [
    'https://pro-info.vercel.app',
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    'https://info-t.vercel.app',
    'https://iposters.vercel.app'
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
app.use(express.json());

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




const { createClient } = require('@supabase/supabase-js');
// const supabaseUrl = 'https://nwopcdkydnuudovkgvxs.supabase.co'; // замените на свой URL
// const supabaseKey = process.env.SUPABASE_KEY;
// const supabase = createClient(supabaseUrl, supabaseKey);
const crypto = require('crypto');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; 
const REPO = "Sozdatel1/PRO-info";
const PATH = "posts.json";
require('dotenv').config();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.post('/api/delete-user', async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    // Удаляем пользователя. Статьи удалятся автоматически благодаря связи Cascade
    const { error } = await supabase.auth.admin.deleteUser(userId);

    if (error) throw error;

    return res.json({ success: true, message: 'Пользователь удален' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});


app.get('/api/posts', async (req, res) => {
    try {
        // ТВОЙ КОД ПЕРЕНЕСЕН СЮДА:
        const [resArticles, resLikes, resViews, resComments] = await Promise.all([
            supabase.from('articles').select('*').order('created_at', { ascending: false }),
            supabase.from('likes').select('post_id'),
            supabase.from('views').select('post_id'),
            supabase.from('comments').select('post_id') 
        ]);

        if (resArticles.error) throw resArticles.error;

        const articles = resArticles.data || [];
        const allLikes = resLikes.data || [];
        const allViews = resViews.data || [];
        const allComments = resComments.data || [];

        const processedData = articles.map(post => ({
            ...post,
            commentCount: post.comments_count || 0, 
            real_likes: allLikes.filter(l => l.post_id === post.id).length,
            viewCount: allViews.filter(v => v.post_id === post.id).length
        }));

        // Отправляем результат клиенту
        res.json(processedData);

    } catch (err) {
        console.error("Ошибка сервера:", err.message);
        res.status(500).json({ error: err.message });
    }
});


app.get('/api/my-articles', async (req, res) => {
    try {
        // Получаем токен из заголовков запроса
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: "No token provided" });

        const token = authHeader.split(' ')[1];

        // 1. Проверяем пользователя на сервере по его токену
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (authError || !user) throw new Error("Unauthorized");

        // 2. Делаем запрос статей этого пользователя
        const { data, error } = await supabase
            .from('articles')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json(data);
    } catch (err) {
        res.status(401).json({ error: err.message });
    }
});


app.get('/api/article/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Запускаем всё параллельно: саму статью, счетчик лайков и счетчик просмотров
        const [artRes, likesRes, viewsRes] = await Promise.all([
            supabase.from('articles').select('*').eq('id', id).single(),
            supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', id),
            supabase.from('views').select('*', { count: 'exact', head: true }).eq('post_id', id)
        ]);

        if (artRes.error) throw artRes.error;

        // Отдаем один объект со всеми данными
        res.json({
            ...artRes.data,
            real_likes: likesRes.count || 0,
            view_count: viewsRes.count || 0
        });
    } catch (err) {
        res.status(404).json({ error: "Статья не найдена" });
    }
});



app.post('/api/publish', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const { title, text, image, id } = req.body; // id передаем, если это редактирование

        if (!authHeader) return res.status(401).json({ error: "Нужна авторизация" });
        const token = authHeader.split(' ')[1];

        // 1. Проверяем пользователя
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) throw new Error("Сессия истекла");

        const generatedName = user.email.split('@')[0];
        const postData = {
            title,
            text,
            image: image || "/img/staty/газета.png",
            user_id: user.id,
            author_name: generatedName
        };

        let result;
        if (id) {
            // --- РЕДАКТИРОВАНИЕ ---
            result = await supabase
                .from('articles')
                .update({ title, text, image: postData.image })
                .eq('id', id)
                .eq('user_id', user.id); // Защита: редактировать может только автор
        } else {
            // --- СОЗДАНИЕ ---
            result = await supabase.from('articles').insert([postData]);
        }

        if (result.error) throw result.error;
        res.json({ success: true });

    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});






const PORT = process.env.PORT || 10000; // Render любит 10000 или PORT
server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
