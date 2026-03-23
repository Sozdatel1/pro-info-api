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
    'https://info-t.vercel.app' 
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
const supabaseUrl = 'https://nwopcdkydnuudovkgvxs.supabase.co'; // замените на свой URL
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const GITHUB_TOKEN = process.env.GITHUB_TOKEN; 
const REPO = "Sozdatel1/PRO-info";
const PATH = "posts.json";


app.post('/publish', async (req, res) => {
  const { title, text, image } = req.body;
  if (!title || !text) return res.status(400).send("Title and text are required");

  try {
    const { data, error } = await supabase
      .from('articles')
      .insert([{
        id: crypto.randomUUID(), // или используйте автоинкрементное поле
        title,
        text,
        image: image || "/img/staty/газета.png",
        likes: 0,
        date: new Date().toISOString()
      }]);
    if (error) throw error;

    res.send({ success: true, post: data[0] });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 2. Загрузка всех постов (/loadPosts)
app.get('/loadPosts', async (req, res) => {
  try {
    const { data: allPostsData, error } = await supabase
      .from('')
      .select('*')
      .order('date', { ascending: false });
    if (error) throw error;

    res.json(allPostsData);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 3. Загрузка конкретной статьи (/loadFullArticle?id=ID)
app.get('/loadFullArticle', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).send("ID is required");

  try {
    const { data: article, error } = await supabase
      .from('articles')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !article) return res.status(404).send("Post not found");

    res.json(article);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 4. Лайки - увеличение лайков (/like/:id)
app.post('/like/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Получить текущие лайки
    const { data: post, error } = await supabase
      .from('articles')
      .select('likes')
      .eq('id', id)
      .single();

    if (error || !post) return res.status(404).json({ error: 'Post not found' });

    // Обновить лайки
    const { data: updatedPost, error: updateError } = await supabase
      .from('posts')
      .update({ likes: (post.likes || 0) + 1 })
      .eq('id', id);
    if (updateError) throw updateError;

    res.json({ success: true, likes: updatedPost.likes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});













app.post('/publish', async (req, res) => {
    // 1. Забираем все три поля
    const { title, text, image } = req.body; 
    
    // Проверка: заголовок и текст обязательны
    if (!title || !text) return res.status(400).send("Title and text are required");

    try {
        const getFile = await fetch(`https://api.github.com/repos/${REPO}/contents/${PATH}`, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
        });
        const fileData = await getFile.json();

        let posts = JSON.parse(Buffer.from(fileData.content, 'base64').toString());

        // 2. ИСПРАВЛЕНО: Добавляем объект со всеми полями
        posts.unshift({ 
            id: Date.now(), 
            title: title, 
            text: text, 
            image: image || "/img/staty/газета.png", // Если картинки нет, ставим дефолт
            date: new Date().toLocaleString() 
        });

        // 3. Пушим обратно
        const update = await fetch(`https://api.github.com/repos/${REPO}/contents/${PATH}`, {
            method: 'PUT',
            headers: { 
                'Authorization': `token ${GITHUB_TOKEN}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                message: `New article: ${title}`,
                content: Buffer.from(JSON.stringify(posts, null, 2)).toString('base64'),
                sha: fileData.sha
            })
        });

        if (update.ok) res.send({ success: true });
        else res.status(500).send("GitHub Error");
    } catch (err) {
        res.status(500).send(err.message);
    }
});



// Очередь для синхронизации записи
let writeQueue = Promise.resolve();

app.post('/like/:id', async (req, res) => {
    const { id } = req.params;

    // Цепляем новый процесс к хвосту очереди
    writeQueue = writeQueue.then(async () => {
        try {
            // ИСПРАВЛЕНО: Добавлен /repos/ и правильные слеши
            const getFile = await fetch(`https://api.github.com/repos/${REPO}/contents/${PATH}`, {
                headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
            });

            if (!getFile.ok) throw new Error("Failed to fetch file from GitHub");
            
            const fileData = await getFile.json();
            const posts = JSON.parse(Buffer.from(fileData.content, 'base64').toString());

            const post = posts.find(p => p.id == id);
            if (!post) {
                // Используем return, чтобы выйти из функции внутри then
                res.status(404).json({ error: "Post not found" });
                return;
            }
            
            post.likes = (post.likes || 0) + 1;

            const update = await fetch(`https://api.github.com/repos/${REPO}/contents/${PATH}`, {
                method: 'PUT',
                headers: { 
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({
                    message: `Like post ${id}`,
                    content: Buffer.from(JSON.stringify(posts, null, 2)).toString('base64'),
                    sha: fileData.sha 
                })
            });

            if (update.ok) {
                res.json({ success: true, likes: post.likes });
            } else {
                const errorLog = await update.json();
                console.error("GitHub API Error:", errorLog);
                res.status(500).json({ success: false, message: "GitHub Save Error" });
            }
        } catch (err) {
            console.error("Queue Error:", err);
            if (!res.headersSent) res.status(500).json({ error: err.message });
        }
    }).catch(err => {
        // Этот catch гарантирует, что если один лайк сломается, 
        // очередь НЕ заблокируется для следующих лайков
        console.error("Fatal Queue Crash:", err);
    });
});








const PORT = process.env.PORT || 10000; // Render любит 10000 или PORT
server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
