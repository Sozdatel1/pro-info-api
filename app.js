const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const app = express();


const { Redis } = require('@upstash/redis');
const DEV_KEY = process.env.DEV_KEY; 
// Разрешаем фронтенду подключаться
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));


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
    methods: ['GET', 'POST', 'OPTIONS', 'PATCH', 'DELETE',],
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
// 🔥 ШАГ 2. АБСОЛЮТНЫЙ ФИКС СИНИОРА: Объявляем и инициализируем суверенный мастер-клиент supabaseAdmin!
// Он берет секретный service_role из переменных окружения и обходит любые блокировки валидатора!
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY, // Наш секретный ключ из env!
  {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
  }
);
// 🔥 СУВЕРЕННЫЙ СТРОГИЙ РОУТ ПРОВЕРКИ НИКНЕЙМА С УЧЕТОМ РЕГИСТРА БУКВ
app.post('/api/check-username', async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) return res.status(400).json({ error: "Username is required" });

        // Отрезаем только случайные пробелы по краям, РЕГИСТР БУКВ ОСТАВЛЯЕМ ОРИГИНАЛЬНЫМ!
        const cleanUsername = username.trim(); 

        // 1. Вытягиваем список ВСЕХ пользователей из ядра Supabase Auth через мастер-клиент
        const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
        if (error) throw error;

        // 2. СТРОГИЙ РЕГИСТРОЗАВИСИМЫЙ СКАНИНГ:
        // Сверяем символ к символу! Теперь "kapibara" !== "Kapibara" !
        const nameExists = users.some(u => {
            const metaName = u.user_metadata?.display_name || u.user_metadata?.name || '';
            return metaName === cleanUsername; // Точное совпадение с учетом больших букв!
        });

        if (nameExists) {
            return res.json({ exists: true, message: `❌ Никнейм "${cleanUsername}" уже занят другим автором!` });
        }

        // Если точного совпадения нет — даем зеленый свет! (Kapibara будет свободен!)
        res.json({ exists: false });

    } catch (err) {
        console.error("Ошибка проверки никнейма на сервере:", err.message);
        res.status(500).json({ error: err.message });
    }
});

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

const fetch = require('node-fetch'); // Убедись, что у тебя установлен node-fetch или используй встроенный в node v18+

// 1. Роут загрузки строки на FreeImage со стороны сервера
// 🔥 АБСОЛЮТНЫЙ НЕУЯЗВИМЫЙ ВАРИАНТ РОУТА ЗАГРУЗКИ ДЛЯ SERVER.JS (БЕЗ FORMDATA)
app.post('/api/upload-image', async (req, res) => {
    try {
        const { imageBase64 } = req.body;
        if (!imageBase64) return res.status(400).json({ error: "No image content provided" });

        const FREEIMAGE_API_KEY = '6d207e02198a847aa98d0a2a901485a5';

        // ИСПОЛЬЗУЕМ КЛАССИЧЕСКИЙ СЕРВЕРНЫЙ КOНТУР URLSearchParams ДЛЯ СВЕРХНАДЕЖНОЙ ПЕРЕДАЧИ СТРОК С БАЗЫ
        const params = new URLSearchParams();
        params.append('source', imageBase64); // Передаем чистую строку base64
        params.append('action', 'upload');
        params.append('format', 'json');

        // Стремительный POST-запрос со стороны сервера напрямую на FreeImage API v1
        const response = await fetch(`https://freeimage.host/api/1/upload?key=${FREEIMAGE_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded' // Жестко задали серверный тип контента!
            },
            body: params
        });

        if (!response.ok) throw new Error("FreeImage REST API connection error");
        
        const result = await response.json();
        
        if (result && result.status_code === 200 && result.image && result.image.url) {
            // Сборка нашей вечной прокси-ссылки на Рендер
            const secureProxyUrl = `https://pro-info-api.onrender.com/api/image-proxy?url=${encodeURIComponent(result.image.url)}`;
            res.json({ url: secureProxyUrl }); // Возвращаем фронтенду идеальную ссылку!
        } else {
            console.error("Детали отказа серверов FreeImage:", result);
            throw new Error('Server upload failure');
        }
    } catch (err) {
        console.error("Критический сбой на бэкенде сервера:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// 2. Роут скачивания и отдачи пикселей (Браузер думает, что картинку нарисовал твой сервер!)
app.get('/api/image-proxy', async (req, res) => {
    try {
        const targetUrl = req.query.url;
        if (!targetUrl) return res.status(400).send('No URL specified');

        // Скачиваем бинарный поток картинки сервером Рендера из-за рубежа
        const response = await fetch(targetUrl);
        if (!response.ok) return res.status(500).send('Failed to fetch image');

        // Копируем тип контента (image/jpeg, image/png) и выплевываем буфер в браузер!
        res.setHeader('Content-Type', response.headers.get('content-type'));
        response.body.pipe(res);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/api/posts', async (req, res) => {
    try {
        // 🔥 ШИЛД-ФИЛЬТР СИНИОРА: Добавляем .eq('is_approved', true) в запрос статей
        const [resArticles, resLikes, resViews, resComments, resUsers] = await Promise.all([
            supabase.from('articles').select('*').eq('is_approved', true).order('created_at', { ascending: false }),
            supabase.from('likes').select('post_id'),
            supabase.from('views').select('post_id'),
            supabase.from('comments').select('post_id'),
            supabaseAdmin.auth.admin.listUsers()
        ]);

        if (resArticles.error) throw resArticles.error;

        const articles = resArticles.data || [];
        const allLikes = resLikes.data || [];
        const allViews = resViews.data || [];
        const allComments = resComments.data || [];
        const allUsersList = resUsers.data?.users || [];

       const processedData = articles.map(post => {
            // Ищем автора этой конкретной статьи в списке пользователей по id
            const authorAccount = allUsersList.find(u => u.id === post.user_id);
            
            let beautifulName = "Аноним";
            if (authorAccount) {
                // Считываем его сочный, измененный красивый регистр букв из метаданных (Yaa / Kapibara)!
                beautifulName = authorAccount.user_metadata?.display_name || authorAccount.user_metadata?.name || authorAccount.email.split('@')[0];
            } else {
                // Если юзер не найден (старый пост), берем имя из статьи и делаем первую букву заглавной!
                const rawDbName = post.author_name || "Аноним";
                beautifulName = rawDbName.charAt(0).toUpperCase() + rawDbName.slice(1);
            }

            return {
                ...post,
                author_name: beautifulName, // Перезаписали поле на 100% рабочий красивый регистр на главной!
                real_likes: allLikes.filter(l => l.post_id === post.id).length,
                viewCount: allViews.filter(v => v.post_id === post.id).length,
                commentCount: allComments.filter(c => c.post_id === post.id).length
            };
        });

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

        // Запускаем параллельно саму статью, счетчик лайков и просмотров
        const [artRes, likesRes, viewsRes] = await Promise.all([
            supabase.from('articles').select('*').eq('id', id).single(),
            supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', id),
            supabase.from('views').select('*', { count: 'exact', head: true }).eq('post_id', id)
        ]);

        if (artRes.error) throw artRes.error;

        // 🔥 КИБЕР-ЗАМОК: Если статья скрыта (is_approved === false), выдаем ошибку 404!
        // (Примечание: Сюда можно дописать условие, чтобы админ kapibara всё равно мог её видеть)
        if (artRes.data && artRes.data.is_approved === false) {
            return res.status(404).json({ error: "Статья находится на проверке модератора!" });
        }

     // 🔥 КВАНТОВЫЙ ШЛЮЗ СИНИОРА: Стучимся в Authentication -> Users через мастер-клиент supabaseAdmin!
        // Теперь запрос ПРОБЬЕТ любые фильтры безопасности Supabase Auth со стороны сервера!
        let beautifulAuthorName = "Аноним";
        try {
            const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(artRes.data.user_id);
            if (userData && userData.user) {
                // Считываем твой сочный, измененный красивый регистр букв Yaa / Kapibara!
                beautifulAuthorName = userData.user.user_metadata?.display_name || userData.user.user_metadata?.name || userData.user.email.split('@')[0];
            }
        } catch (uErr) {
            console.warn("Сбой чтения метаданных через мастер-ключ:", uErr.message);
            beautifulAuthorName = artRes.data.author_name || "Аноним";
        }

        // 2. СБОРКА ИДЕАЛЬНОГО ОТВЕТА СЕРВЕРА С ОБНОВЛЕННЫМ ИМЕНЕМ АВТОРА С БОЛЬШИХ БУКВ
        res.json({
            ...artRes.data,
            author_name: beautifulAuthorName, // Выведет на фронт строго красивое живое имя!
            real_likes: likesRes.count || 0,
            view_count: viewsRes.count || 0
        });

    } catch (err) {
        res.status(404).json({ error: "Статья не найдена" });
    }
});


// =========================================================================
// 🔥 🔥 🔥 НОВЫЕ АДМИНСКИЕ РОУТЫ СТАТЕЙ (ТО, ЧЕГО НЕ ХВАТАЛО ДЛЯ СВЯЗКИ С ФРОНТОМ)
// =========================================================================

// 4. GET: Просмотр очереди НЕОДОБРЕННЫХ СТАТЕЙ (ДОСТУП СТРОГО ДЛЯ KAPIBARA)
app.get('/api/admin/unapproved-posts', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Доступ запрещен' });

    const token = authHeader.split(' ')[1]; // Извлекаем чистый токен Bearer

    try {
        // Декодируем сессию через токен в Supabase Auth
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) throw new Error('Ошибка авторизации');

        const username = user.email.split('@')[0];

        // ЖЕСТКИЙ ФАЙРВОЛ: Отбиваем атаку любого, кто косит под Капибару!
        if (username !== 'kapibara') {
            return res.status(403).json({ error: 'У вас нет прав на просмотр очереди постов! 🛑' });
        }

        // Вытаскиваем из таблицы articles строки, у которых флаг равен false
        const { data, error } = await supabase
            .from('articles')
            .select('*')
            .eq('is_approved', false)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data || []); // Возвращаем чистый JSON-массив фронтенду!
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. PATCH: Одобрение статьи по её ID (ДОСТУП СТРОГО ДЛЯ KAPIBARA)
app.patch('/api/posts/approve/:postId', async (req, res) => {
    const { postId } = req.params;
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Доступ запрещен' });

    const token = authHeader.split(' ')[1];

    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) throw new Error('Ошибка авторизации');

        const username = user.email.split('@')[0];

        if (username !== 'kapibara') {
            return res.status(403).json({ error: 'Вы не админ kapibara! 🛑' });
        }

        // Обновляем флаг на true в таблице articles
        const { error: updateError } = await supabase
            .from('articles')
            .update({ is_approved: true })
            .eq('id', postId);

        if (updateError) throw updateError;
        res.status(200).json({ success: true, message: 'Статья успешно опубликована! 📄👍' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =========================================================================
// 🦫 СУВЕРЕННЫЙ РОУТ ВЫДАЧИ КОММЕНТАРИЕВ С ЖИВЫМ ВЫРАВНИВАНИЕМ РЕГИСТРА ИМЕН
// =========================================================================
app.get('/api/comments/:postId', async (req, res) => {
    try {
        const { postId } = req.params;
        
        // 🔥 ШАГ 1. ФИКС СИНИОРА: Запускаем параллельно сбор комментов и штурм актуальной базы имен из ядра!
        // Твой боевой фильтр шрапнели модерации .eq('is_approved', true) сохранен на 1000%!
        const [commRes, usersRes] = await Promise.all([
            supabase
                .from('comments')
                .select('*')
                .eq('post_id', postId)
                .eq('is_approved', true) 
                .order('created_at', { ascending: false }), // Для рекурсивных деревьев сорт ascending/descending подхватится фронтом
            supabaseAdmin.auth.admin.listUsers() // Наш секретный мастер-клиент тянет живые метаданные
        ]);

        if (commRes.error) throw commRes.error;

        const comments = commRes.data || [];
        const allUsersList = usersRes.data?.users || [];

        // 🔥 ШАГ 2. КВАНТОВЫЙ МAППИНГ: Перезаписываем user_name красивым регистром из display_name!
        const processedComments = comments.map(c => {
            // Ищем аккаунт комментатора в базе пользователей по id
            const account = allUsersList.find(u => u.id === c.user_id);
            
            let beautifulName = "Аноним";
            if (account) {
                // Добавили точный индекс [0] на конце сплита для абсолютной безопасности!
                beautifulName = account.user_metadata?.display_name || account.user_metadata?.name || account.email.split('@')[0];
            } else {
                // Если аккаунт удален или не найден, берем старый текст из базы и делаем первую букву большой!
                const rawName = c.user_name || "Аноним";
                beautifulName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
            }

            return {
                ...c,
                user_name: beautifulName // Поле гарантированно вернет красивый регистр с большими буквами!
            };
        });

        res.json(processedComments);

    } catch (err) {
        console.error("Критический сбой роута комментариев на бэкенде:", err.message);
        res.status(500).json({ error: err.message });
    }
});


// 2. POST: Принудительный загон любого нового коммента на карантин (false)
app.post('/api/comments', async (req, res) => {
    const { postId, text, parentId } = req.body;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Не авторизован' });

    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) throw new Error('Ошибка авторизации');

        const username = user.email.split('@')[0];

        const { error: insertError } = await supabase.from('comments').insert([{
            post_id: postId,
            user_id: user.id,
            user_name: username,
            content: text,
            parent_id: parentId ? parseInt(parentId) : null,
            is_approved: false // 🔥 ЖЕСТКИЙ ЗАМОК: всегда false на старте!
        }]);

        if (insertError) throw insertError;
        res.status(200).json({ success: true, message: 'Отправлено на модерацию!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. 🔥 РОУТ PATCH: Одобрение комментария (СТРОГО ДЛЯ АККАУНТА KAPIBARA)
app.patch('/api/comments/approve/:commentId', async (req, res) => {
    const { commentId } = req.params;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Доступ запрещен' });

    try {
        // Проверяем сессию в Supabase Auth
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) throw new Error('Ошибка авторизации');

        // Вырезаем юзернейм из почты в точности как в твоем POST-роуте
        const username = user.email.split('@')[0];

        // 🦫 ЖЕСТКИЙ КИБЕР-ЩИТ: Проверяем, что вошел именно kapibara!
        if (username !== 'kapibara') {
            return res.status(403).json({ error: 'Доступ заблокирован: Вы не админ kapibara! 🛑' });
        }

        // Обновляем флаг на true в Supabase
        const { error: updateError } = await supabase
            .from('comments')
            .update({ is_approved: true })
            .eq('id', commentId);

        if (updateError) throw updateError;
        res.status(200).json({ success: true, message: 'Комментарий успешно опубликован! 👍' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. 🔥 GET РОУТ: Просмотр очереди модерации (СТРОГО ДЛЯ АККАУНТА KAPIBARA)
app.get('/api/admin/unapproved', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Доступ запрещен' });

    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) throw new Error('Ошибка авторизации');

        const username = user.email.split('@')[0];

        // 🦫 Бьем по рукам любого левого чела, который ломится в карантин
        if (username !== 'kapibara') {
            return res.status(403).json({ error: 'У вас нет прав на просмотр очереди модерации! 🛑' });
        }

        const { data, error } = await supabase
            .from('comments')
            .select('*')
            .eq('is_approved', false)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.post('/api/like', async (req, res) => {
    try {
        const { postId } = req.body;
        const authHeader = req.headers.authorization;
        let userId = null;

        // Извлекаем userId, если есть токен
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const { data: { user }, error: authError } = await supabase.auth.getUser(token);
            if (user) userId = user.id;
        }

        // Попытка вставить лайк
        const { error: insertError } = await supabase
            .from('likes')
            .insert([{ post_id: postId, user_id: userId }]);

        if (insertError) {
            // 23505 — код нарушения уникальности (уже лайкнул)
            if (insertError.code === '23505') {
                return res.status(400).json({ error: "already_liked" });
            }
            throw insertError;
        }

        // Считаем актуальное кол-во лайков
        const { count, error: countError } = await supabase
            .from('likes')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', postId);

        if (countError) throw countError;

        res.json({ success: true, count: count || 0 });
    } catch (err) {
        console.error("Like error:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});



// В твоем основном файле сервера (например, index.js или server.js)
app.post('/api/view/:postId', async (req, res) => {
    const { postId } = req.params;
    
    // Получаем IP пользователя (это замена navigator.userAgent на сервере)
    const viewerIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    try {
        // Пытаемся вставить запись в таблицу views
        // Supabase сам отсечет дубликат, если у тебя стоит Unique на (post_id, viewer_id)
        const { error } = await supabase
            .from('views')
            .insert([{ 
                post_id: postId, 
                viewer_id: viewerIp // Используем IP как уникальный ID анонима
            }]);

        if (error) {
            // Если ошибка 23505 (дубликат), просто отвечаем 200, это не страшно
            return res.status(200).json({ message: 'Already viewed' });
        }

        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});



app.get('/api/view-count/:postId', async (req, res) => {
    const { postId } = req.params;

    try {
        const { count, error } = await supabase
            .from('views')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', postId);

        if (error) throw error;

        res.status(200).json({ count: count || 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
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
