# Проверка SMART CITY — 2 октября 2026, PostgreSQL + real-time

## Обновление 3 октября 2026 — Command Center и дорожный маршрут

- `manage.py check`: без ошибок; `makemigrations --check --dry-run`: изменений нет.
- 41 тест прошёл на отдельной временной PostgreSQL-базе, удалённой Django после тестов.
- Проверены: сохранение/инвалидация дороги, отсутствие прямого fallback, выбор route ID,
  camera permissions/allowlist/tickets, HLS rewrite, async MJPEG, запрет HTML,
  WHEP offer/answer и права на сессию, camera health/cache, AI REVIEW, подтверждение оператором,
  staff-only удаление камер и публичные счётчики парковки без деталей чужой брони.
- Фактический Route 88: 590 координат, 19 049 метров; привязка остановок к дороге 1–27 м.
- TypeScript check и production build прошли. MapLibre и HLS.js — отдельные lazy chunks.
  Vite сообщает размер библиотечных chunks больше 500 KB; сборка успешна.
- Новые компоненты, существующая авторизация и формы рендерятся на ru/en/tg.
- Smoke через Vite + PostgreSQL прошёл: JWT/refresh/profile, дорога, камеры/GeoJSON/system,
  поиск, бронирование/конфликт/отмена, incident/request. Временный аккаунт удалён.
- Миграции 0004/0005 применены к рабочей базе, существующие данные сохранены.
- Публичный DEM-тайл Душанбе: HTTP 200, image/png. Используются реальные Mapzen Terrain данные.
- Потоки камер и AI gateway не настроены; реальное видео/AI не проверялись.
  Redis/worker/Beat локально не запущены, PostGIS отсутствует.
- Computer Use остановил визуальную проверку: не смог достоверно определить URL браузера.
  Скриншоты и внешний вид в живом браузере не подтверждены.

Описание текущей реализации: [COMMAND_CENTER.md](COMMAND_CENTER.md).
Следующие разделы — результаты предыдущей версии.

## Реализовано

Основная БД заменена на PostgreSQL. В отдельный кластер проекта импортированы
5 ParkingLot, 15 ParkingSpot, 12 BusStop, Route 88, 8 RouteStop, Vehicle.
Исходная SQLite сохранена; команда импорта отказывается перезаписывать непустую БД.
Рабочие данные не читаются из JSON-файлов. Старый fixture удалён.

Redis настроен для трёх задач: route cache с TTL=60, Celery broker, Channels layer.
Кэш инвалидируется при изменении Route/RouteStop/BusStop. При недоступности cache
REST читает PostgreSQL и явно пишет предупреждение.

Celery tasks: истёкшие BOOKED → COMPLETED; движение только DEMO-88-01 по ordered stops.
Beat: каждые 60 секунд проверка броней, каждые 10 секунд DEMO simulation при включённом
DEMO_SIMULATION. CRUD и booking validation остаются DRF.

Один CityConsumer: JWT в первом frame, deadline 5 секунд, истечение токена,
проверка Origin, группы владельца и staff. Через WS нельзя выполнять CRUD.
Signals после commit отправляют Vehicle, Incident, ServiceRequest, Booking updates/deletes.
Личные события не рассылаются другим обычным пользователям. React обновляет markers
и записи без polling Vehicle; показывает состояние соединения и уведомления.

ASGI ProtocolTypeRouter HTTP+WS; Daphne выбран вместо WSGI-сервера для сокетов.
Compose: backend, postgres, redis, celery, celery-beat; Nginx — отдельный deployment profile.
Nginx имеет WebSocket Upgrade/Connection headers, API/static/media/React маршруты.
Secrets генерируются в игнорируемом .env, не зашиты в compose.

## Реально проверено

- Полный набор **22 теста, OK**, с реальной PostgreSQL test database.
- REST CRUD девяти моделей, JWT, profile, refresh, permissions и ownership.
- Booking validation, availability, отмена, направление route search, фильтры.
- Task-функции: только истёкшие BOOKED завершены; повторный вызов безопасен.
- Task-функция simulation: правильный порядок остановок, другой Vehicle не меняется.
- Consumer: JWT, запрещённый Origin, invalid token, запрет CRUD через WS,
  доставка личного Incident владельцу и staff, отсутствие доставки другому user.
- Django check и makemigrations --check прошли; PostgreSQL migrate выполнен.
- React production build проходит.
- Docker compose config --quiet проходит; git diff --check без ошибок whitespace.
- HTTP smoke через Vite и ASGI/PostgreSQL: register/login/refresh/profile,
  routes/search, availability, booking/overlap/cancel, incident и request.

В автоматических тестах cache и channel layer в памяти; task-функции вызываются
напрямую. Тесты consumer используют WebsocketCommunicator, а не внешний браузер.
Эти тесты не доказывают работу настоящего Redis, broker, Worker и Beat.

## Что осталось неподтверждённым

Интеграционный тест `scripts/integration_realtime.py` остановился на Redis PING:
сервер недоступен. Docker Desktop не поднял Linux engine, `wsl --status` сообщает,
что WSL не установлен. Установка OS-компонента WSL не выполнялась.
Поэтому Redis cache TTL, cross-process channel delivery, Celery broker/Worker/Beat,
Compose runtime и Nginx runtime не подтверждены. Не использовался fake Redis,
не подменялся broker eager-режимом ради заявления о готовности.

После исправления инфраструктуры:

```powershell
node scripts/setup-local-env.cjs
docker compose up -d --build
docker compose exec backend python manage.py seed_demo_data
# Для host-проверки установите requirements-dev.txt в рабочее Python-окружение:
$cityPython = '.\.venv\Scripts\python.exe'
# Укажите POSTGRES_HOST/PORT того PostgreSQL, который использует запущенный worker.
& $cityPython run_backend.py --module scripts.integration_realtime --beat
```

Не запускайте одновременно native PostgreSQL и Compose postgres на 55432.
Если используются контейнеры, сначала остановите выделенный native кластер:
`pg_ctl -D .runtime/postgres stop`. Данные native и Docker postgres — разные базы,
копирование между ними требует отдельного импорта.

## Сохранившиеся ограничения

Браузер/реальная камера и визуальная карта в этой сессии не проверены.
AI gateway/key не настроены; 503 AI is not configured проверен.
DEMO Route 88, DEMO парковки и simulation не официальные городские данные и не GPS.
Существующие недемонстрационные геоданные перенесены без новой внешней проверки.
Serializer overlap-check ещё не гарантирует защиту от одновременного бронирования.

В `.venv` обнаружена смесь Python 3.14 и бинарных пакетов cp313 из предыдущей
установки через pgAdmin. Это вызвало `_cffi_backend` ModuleNotFoundError.
Зависимости переустановлены через Python самой `.venv`. Рекомендуемый запуск —
`.venv/Scripts/python.exe manage.py runserver`, без чужого Python и подмены sys.path.
Настройки Django читают .env для стандартного запуска. Системная установка pgAdmin
и существующий PostgreSQL-сервис не изменены.

После исправления `_cffi_backend.cp314-win_amd64.pyd` загружается в Python 3.14,
Daphne и psycopg импортируются. `pip check` не обнаружил сломанных зависимостей.
`manage.py check` и 22 теста на PostgreSQL прошли. Обычный `manage.py runserver`
с StatReloader запущен на тестовом порту 8010; `/swagger/` ответил HTTP 200.
Тестовый сервер остановлен после проверки.

Инструкции и REST/WS протокол: README.md. Объяснения технологий и защита: DEFENSE.md.

## Официальные источники при реализации

- [Celery и Django](https://docs.celeryq.dev/en/stable/django/first-steps-with-django.html)
- [Channels channel layers](https://channels.readthedocs.io/en/latest/topics/channel_layers.html)
- [Channels authentication](https://channels.readthedocs.io/en/stable/topics/authentication.html)
- [Celery FAQ: Windows не поддерживается](https://docs.celeryq.dev/en/latest/faq.html)
# Цвет интерфейса и разговорный помощник — 3 октября 2026

- Единый синий акцент у входа, регистрации, панели и карты; красный/зелёный выбираются в верхней панели.
- Проверены сохранение, восстановление после перезагрузки, синхронизация вкладок,
  обработка недопустимого значения и работа при недоступном localStorage.
- Белый текст основных кнопок имеет расчётный контраст не ниже 4.5:1 во всех трёх палитрах.
- Чат передаёт последние 12 сообщений и язык ru/en/tg. При отсутствии или отказе AI
  явно включается локальный справочник с актуальными разрешёнными данными проекта.
- 47 тестов успешно выполнены на изолированной временной базе PostgreSQL; `manage.py check` без ошибок.
- `npm.cmd run build` и `npm.cmd run test:i18n` прошли: 92 новые подписи, 321 прежний перевод, SSR всех страниц на трёх языках.
- Внешняя языковая модель по-прежнему требует настройки gateway. Тест её контракта выполнен с подменой провайдера.
