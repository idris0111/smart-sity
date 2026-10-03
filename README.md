# SMART CITY · Душанбе

Учебный Django DRF + React проект. Основные данные хранятся в PostgreSQL.
Redis используется для cache (DB 1), Celery broker (DB 0), Channels (DB 2).
Маршрут 88, три бронируемые парковки и DEMO-88-01 — демонстрационные данные.
Новая главная страница — MapLibre Command Center; маршруты строятся по дорогам
OSRM и сохраняются в PostgreSQL. Камеры, потоковые форматы, слои, AI и ограничения
настройки описаны в [COMMAND_CENTER.md](COMMAND_CENTER.md).

## Запуск через Docker Compose

```powershell
node scripts/setup-local-env.cjs
docker compose up -d --build
docker compose exec backend python manage.py seed_demo_data
cd frontend
npm.cmd install
npm.cmd run dev
```

Нужен работающий Docker Linux engine. На этом компьютере Docker не запускается:
WSL не установлен. Compose подготовлен и проверен синтаксически; запуск контейнеров,
реального Redis, Celery Worker и Beat в этой сессии не проверен.
Celery для основного запуска предусмотрен в Linux-контейнере.

Приложение: http://localhost:5173 · Swagger: http://localhost:8000/swagger/
Admin: http://localhost:8000/admin/ — создайте аккаунт командой
`docker compose exec backend python manage.py createsuperuser`.

`.env` создаётся с локальными случайными секретами и исключён из Git.
Compose читает его автоматически. Все адреса и credentials задаются окружением;
пример находится в `.env.example`. Не публикуйте dev-ключи и DEBUG=1.

## Проверенный локальный PostgreSQL

Пока Docker недоступен, выделенный PostgreSQL проекта работает на 127.0.0.1:55432.
Данные находятся в `.runtime/postgres`, отдельно от установленного системного сервиса.
В него импортированы 5 парковок, 15 мест, 12 остановок, Route 88, 8 RouteStop и Vehicle.
Исходный `db.sqlite3` сохранён. CustomUser в исходной базе не было.

```powershell
$cityPython = '.\.venv\Scripts\python.exe'
# Если выделенный PostgreSQL остановлен:
& 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe' -D .runtime/postgres -l .runtime/postgres.log -o '-h 127.0.0.1 -p 55432' start
& $cityPython manage.py migrate
& $cityPython manage.py runserver 127.0.0.1:8000
```

`.venv` использует Python 3.14. Устанавливайте зависимости только через её Python:
`& .\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt`.
Не устанавливайте бинарные библиотеки из Python pgAdmin в `.venv` другого Python.
Настройки Django читают локальный `.env`, поэтому обычный `python manage.py runserver`
в активированной `.venv` получает правильные параметры PostgreSQL.
На другом компьютере создайте обычное Python-окружение, установите requirements.txt
и задайте переменные окружения перед `python manage.py ...`.
Без Redis REST сохраняет данные, кэш читает из PostgreSQL и пишет предупреждение;
real-time и broker в таком режиме недоступны. Это диагностический режим, не полный стек.

## Открытие frontend с телефона в локальной сети

Запустите `npm.cmd run dev` в `frontend`: Vite слушает `0.0.0.0:5173`.
На телефоне в той же Wi-Fi сети откройте Network URL, который напечатает Vite.
Адрес localhost на телефоне не указывает на компьютер. API использует относительные
URL и пересылается Vite в Django; backend не требуется открывать в локальную сеть.
Windows Firewall должен разрешать входящие подключения Node в вашей частной сети.

Для WebSocket добавьте точный адрес frontend (например, `http://<IP-компьютера>:5173`)
в список `WEBSOCKET_ORIGINS` в локальном `.env` и перезапустите Django.
При смене Wi-Fi адрес компьютера может измениться. Для текущей сети origin добавлен.
Без работающего Redis real-time остаётся недоступным.

В production используйте существующий Nginx proxy и относительные API/WS URL;
для отдельного API домена задаются `VITE_API_BASE_URL` и `VITE_WS_URL` при сборке,
а разрешённые hosts/origins и CORS настраиваются под реальные домены deployment.
Vite dev server предназначен для локальной разработки.

## Перенос SQLite без JSON

Для НОВОЙ ПУСТОЙ PostgreSQL-базы после migrate:

```powershell
python manage.py import_sqlite --source /path/to/db.sqlite3
```

Команда напрямую читает SQLite в режиме read-only и записывает существующие модели.
ID и хеши паролей сохраняются, sequences PostgreSQL обновляются. При непустой целевой
базе команда отказывается перезаписывать данные. Custom groups/permissions, sessions
и JWT blacklist не копируются; после переноса войдите заново. JSON-файлов данных нет.
В контейнер нужно отдельно передать SQLite-файл, он исключён из Docker image.

## REST API

| URL | Назначение |
| --- | --- |
| `/account/register/`, `/account/login/` | Регистрация и JWT |
| `/account/token/refresh/`, `/account/logout/`, `/account/profile/` | Refresh, выход, профиль |
| `/api/parkings/`, `/api/parking-spots/`, `/api/bookings/` | Парковки, места, брони |
| `/api/parkings/<id>/availability/?start_time=...&end_time=...` | Доступность за интервал |
| `/api/stops/`, `/api/routes/`, `/api/route-stops/`, `/api/vehicles/` | Транспорт и остановки |
| `/api/routes/search/<start_id>/<end_id>/` | Прямой маршрут по порядку остановок |
| `/api/parking-spots/?parking=ID`, `/api/vehicles/?route=ID` | Фильтрация |
| `/api/incidents/`, `/api/service-requests/` | События и обращения |
| `/api/assistant/`, `/api/camera/analyze/` | Настраиваемый AI gateway |

Списки: GET, POST. Объекты /<id>/: GET, PUT, PATCH, DELETE.
Authorization: Bearer ACCESS_TOKEN. Городские справочники меняет staff.
Брони, события, обращения видит владелец или staff. Статус обращения меняет staff.
Swagger документирует REST; WebSocket описан ниже.

## WebSocket `/ws/city/`

Vite пересылает `/ws/` в Daphne. После открытия клиент первым сообщением отправляет:

```json
{"type":"authenticate","access":"ACCESS_TOKEN"}
```

JWT не помещается в URL. До аутентификации пользователь не включён в группы и не
получает данные. На аутентификацию даётся 5 секунд. Ошибка/истечение JWT → close 4401;
попытка выполнять CRUD через сокет → 4403. Origin проверяется по WEBSOCKET_ORIGINS.
В production используйте HTTPS/WSS. Клиент обновляет токен и переподключается.

События имеют `kind` и `data`:
`vehicle.updated`, `vehicle.deleted`, `incident.created/updated/deleted`,
`request.created/updated/deleted`, `booking.updated/deleted`.
`data` — сериализованная запись, при удалении только id.
Транспорт доступен всем авторизованным. Личные события идут владельцу и staff,
чужие события обычный пользователь не получает. Сокет только доставляет обновления;
CRUD и начальная загрузка данных остаются в DRF. Обновления из Django Admin тоже
отправляются благодаря post_save. Сигналы публикуют после успешного commit.

## Redis, Celery и Beat

Кэшируется только список маршрутов: `city:routes`, TTL 60 секунд.
Изменение Route, RouteStop или BusStop удаляет кэш. Это сокращает одинаковые SQL-запросы.
TTL — время жизни ключа: после истечения следующий запрос снова читает PostgreSQL.

`check_expired_bookings` каждую минуту выбирает BOOKED с end_time < now и сохраняет
COMPLETED. Повторный запуск безопасен; CANCELLED и будущие записи не меняются.
`move_demo_vehicle` раз в 10 секунд переносит только DEMO-88-01 на следующую
упорядоченную остановку. DEMO_SIMULATION=0 отключает периодическую симуляцию.
Это не GPS и не официальный маршрут. REST booking validation остаётся в Serializer.

Django/Celery Beat → Redis broker → Celery Worker → задача → PostgreSQL.
После save: post_save → Redis channel layer → Channels consumer → WebSocket → React.
Redis channel layer связывает разные процессы worker и ASGI; браузеры не подключаются
к Redis напрямую. Дополнительные emergency calls и сложные notification-модели не добавлены.

## Deployment: Nginx + ASGI

```powershell
cd frontend
npm.cmd run build
cd ..
docker compose --profile deployment up -d --build
```

http://localhost:8080 обслуживает React build. Nginx пересылает API в Daphne,
`/ws/` с Upgrade/Connection headers — в тот же ASGI-сервер; `/static/` и `/media/`
читает из volumes. В development Nginx не нужен. Обычный WSGI Gunicorn не используется
для WebSocket; выбран один Daphne для HTTP + WS. TLS и публичный hostname нужно
настроить перед реальным deployment. Compose не является готовой production-конфигурацией.

## Камера и AI

Start/stop/flip, live preview, capture JPEG и отправка кадра реализованы.
Без SMART_CITY_AI_URL и SMART_CITY_AI_KEY backend возвращает 503 AI is not configured.
Адаптер ожидает POST gateway с system/task/message либо system/task/image и ответ
`{"answer":"..."}`. Конкретная модель не подключена. Инструкция: myapp/ai_prompt.txt.
Внешняя модель не получает ключи или JWT. Встроенный справочник явно подписан.
Камера и UI визуально не проверены: браузерный инструмент не обнаружил браузеров.

## Проверки и защита

```powershell
$env:POSTGRES_TESTS='1'
& $cityPython manage.py test --settings=core.test_settings
& $cityPython manage.py check
& $cityPython manage.py makemigrations --check
cd frontend
npm.cmd run build
```

22 теста прошли на PostgreSQL. В тестах cache и channel layer изолированы в памяти;
Celery tasks вызываются напрямую. Это НЕ подтверждение работы Redis broker/Beat.
Для полного стека предусмотрен `scripts/integration_realtime.py`.
Отчёт: [VERIFICATION.md](VERIFICATION.md). Объяснения: [DEFENSE.md](DEFENSE.md).
