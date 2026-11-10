# Развёртывание на Hostinger VPS

## Требования

Нужен Hostinger VPS с Docker Engine и Docker Compose plugin, доменом и настроенным Nginx. Docker Manager для готовых образов не собирает этот репозиторий автоматически: конфигурация ниже собирает образ из исходников.

## Подготовка

1. Клонируйте репозиторий на VPS и перейдите в его каталог.
2. Создайте .env на VPS из .env.example. Заполните APP_PASSWORD и OPENAI_API_KEY; остальные параметры проверьте по разделу ниже.
3. Не загружайте .env в GitHub. Файл исключён через .gitignore и .dockerignore.

Минимальные настройки .env для Pro:

    NODE_ENV=production
    PORT=3000
    APP_PASSWORD=ЗАМЕНИТЬ_НА_ДЛИННЫЙ_СЛУЧАЙНЫЙ_ПАРОЛЬ
    OPENAI_API_KEY=ЗАМЕНИТЬ_СВОИМ_КЛЮЧОМ
    OPENAI_TRANSCRIBE_MODEL=gpt-transcribe
    OPENAI_SUMMARY_MODEL=gpt-5-mini
    MAX_VIDEO_MB=250
    DATA_DIR=/app/data
    FFMPEG_PATH=/usr/bin/ffmpeg
    PRO_ENABLED=true

Не оставляйте значения «ЗАМЕНИТЬ…» в рабочей конфигурации. FFPROBE_PATH сейчас не используется кодом приложения.

## Сборка и запуск

    docker compose up -d --build
    docker compose ps
    docker compose logs --tail=100 app

Проверка локального порта VPS:

    curl -i http://127.0.0.1:3000/api/config

Ожидается HTTP 200 и JSON с proEnabled: true. Значение passwordRequired должно быть true.

## Nginx

Порт контейнера привязан только к loopback VPS (127.0.0.1:3000). В конфигурации Nginx домена проксируйте запросы на http://127.0.0.1:3000, установите TLS-сертификат и увеличьте client_max_body_size до допустимого лимита приложения. Не открывайте порт 3000 напрямую в Интернет.

## Данные

Результаты хранятся в именованном Docker volume meeting-notes-ai-data, смонтированном в /app/data. Обновление контейнера не должно удалять этот volume. Настройте резервное копирование. Команда docker compose down -v удалит volume с данными; не запускайте её для обычного обновления.

## Примечания

- PRO_ENABLED=true включает импорт публичных ссылок Яндекс Диска. Для режима только Lite установите false.
- Приложение использует ffmpeg-static как зависимость; контейнер дополнительно устанавливает системный FFmpeg и явно задаёт его путь.
- Убедитесь, что лимит загрузки Nginx не меньше MAX_VIDEO_MB (по умолчанию 250 МБ).
- Конспект и расшифровка сохраняются в JSON, поэтому Docker volume и резервные копии критичны.
