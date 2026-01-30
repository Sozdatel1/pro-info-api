const axios = require('axios');
const fs = require('fs');

axios.get('https://yastat.net')
    .then(res => {
        fs.writeFileSync('original_tag.js', res.data);
        console.log("✅ Файл успешно скачан на сервер!");
    })
    .catch(err => console.log("❌ Ошибка: " + err.message));
