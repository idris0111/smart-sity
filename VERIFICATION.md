# Проверка SMART CITY — 2 октября 2026, PostgreSQL + real-time

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
