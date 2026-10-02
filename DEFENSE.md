# Как объяснить SMART CITY

Запрос проходит путь URL → View → Permission → Serializer → Model → Database.
React → один API client → Django REST API. Карта получает координаты из API,
Leaflet отображает маркеры поверх тайлов OpenStreetMap.

## Модели

| Модель | Назначение |
| --- | --- |
| CustomUser | Существующий пользователь, расширяет AbstractUser |
| ParkingLot | Парковка, адрес, координаты, активность |
| ParkingSpot | Место, тип NORMAL/DISABLED/EV, связь с парковкой |
| ParkingBooking | Пользователь, место, время, статус брони |
| BusStop | Остановка и координаты |
| Route | Номер, имя, активность маршрута |
| RouteStop | Связь маршрута и остановки, порядковый номер |
| Vehicle | Тип транспорта, номер, координаты, необязательный маршрут |
| TrafficIncident | Дорожное событие, автор и статус |
| ServiceRequest | Обращение жителя и статус обработки |

## Serializer и View

ModelSerializer преобразует модель в JSON и проверяет входные данные.
Для каждой основной модели есть свой serializer. В RouteSerializer вложенные
route_stops доступны только для чтения. Владельцы и created_at не меняются клиентом.
Для параметров доступности и AI предусмотрены простые Serializer без таблиц БД.

ListCreateAPIView делает GET списка и POST создания.
RetrieveUpdateDestroyAPIView делает GET записи, PUT, PATCH, DELETE.
ProfileView использует RetrieveUpdateAPIView и возвращает request.user.
RouteSearchView использует ListAPIView. Availability использует APIView,
потому что вычисляет доступность за интервал. AI использует GenericAPIView с POST.

IsAdminOrReadOnly позволяет авторизованным читать городские справочники,
а сотруднику редактировать. IsOwnerOrAdmin позволяет работать со своими
бронями, событиями, заявками; администратор видит всё. get_queryset ограничивает
выборку владельцем. perform_create назначает request.user автоматически.
Статус заявки меняет только администратор.

## JWT, бронь и поиск

Login выдаёт access и refresh. Access отправляется в Authorization: Bearer TOKEN.
Refresh получает новый access после истечения старого. При ротации старый refresh
попадает в blacklist. Клиент объединяет одновременные запросы обновления токена.
Регистрация хеширует пароль через set_password; открытый пароль не хранится.

Бронь проверяет end > start, отсутствие времени в прошлом, активность парковки
и места. Пересечение: существующее start < новое end и существующее end > новое start,
только status=BOOKED. При PATCH текущая запись исключается. Соседние интервалы
допустимы; отменённая бронь место не блокирует. Сейчас основная база — PostgreSQL.
Проверка Serializer сама по себе не гарантирует защиту от одновременного бронирования.

Поиск берёт RouteStop начальной остановки, на том же маршруте ищет конечную.
Подходит только активный маршрут, где start.order < end.order. Пересадки не ищутся.
Нет прямого маршрута → пустой список; неизвестная остановка → 404.

## Возможные вопросы преподавателя

1. Что такое Model? Описание таблицы БД, полей и связей.
2. Что такое Serializer? Преобразование JSON и проверка данных.
3. Что такое Generic View? Готовое представление DRF для типовых действий API.
4. Что такое JWT? Подписанный токен, удостоверяющий пользователя запроса.
5. Что такое access token? Короткоживущий токен для доступа к API.
6. Что такое refresh token? Токен для получения нового access.
7. Что такое permission? Проверка права пользователя выполнить действие.
8. Что такое ForeignKey? Связь записи с одной записью другой таблицы.
9. Что такое CASCADE? Удаление зависимых записей при удалении родителя.
10. Что такое SET_NULL? Связь становится пустой; Vehicle остаётся после удаления Route.
11. Что такое related_name? Имя обратного доступа к связанным объектам.
12. Что делает get_queryset? Выбирает доступные пользователю записи.
13. Что делает perform_create? Дополняет сохранение, например назначает владельца.
14. Зачем RouteStop? Для состава маршрута и порядка остановок.
15. Как работает поиск? Сравнивает порядок двух остановок одного маршрута.
16. Как работает ParkingBooking? Хранит место, владельца, интервал и статус.
17. Как определяется свободное место? Активное место без пересечения BOOKED-броней.
18. Почему user read_only? Клиент не может назначить другого владельца.
19. Что такое request.user? Пользователь, установленный аутентификацией DRF.
20. Как frontend получает данные? Через fetch в api.js с JWT-заголовком.
21. Как работает карта? Leaflet загружает тайлы и накладывает координаты API.
22. Почему OpenStreetMap? Подходит для интерактивной карты с атрибуцией источника.
23. Как работает камера? getUserMedia создаёт поток; canvas захватывает один кадр.
24. Чем DEMO отличается от real? DEMO показывает сценарий, официальность не подтверждена.
25. Работает ли AI? Без gateway и ключа возвращается 503; встроенный справочник не является AI.

## Технологии новой версии

| Технология | Для чего нужна | Где находится в проекте |
| --- | --- | --- |
| PostgreSQL | Постоянные модели, связи и транзакции | core/settings.py, модели Django |
| Redis cache | Уменьшает повторные SELECT списка маршрутов | RouteListCreateView.list, city:routes, TTL=60 |
| Redis broker | Очередь фоновых задач между Beat/Django и Worker | CELERY_BROKER_URL, Redis DB 0 |
| Redis channel layer | Передаёт события между процессами ASGI и Celery | CHANNEL_LAYERS, Redis DB 2 |
| Celery | Выполняет задачи вне HTTP request | core/celery.py, myapp/tasks.py |
| Celery Beat | По расписанию отправляет задачи Worker | CELERY_BEAT_SCHEDULE |
| Channels | Consumer и группы получателей real-time событий | myapp/consumers.py, myapp/realtime.py |
| WebSocket | Постоянный канал обновлений server → client | /ws/city/, frontend/src/realtime.js |
| ASGI/Daphne | Обслуживает HTTP и WebSocket | core/asgi.py, Dockerfile |
| Signals | Уведомляет об изменениях из API, Admin или task | myapp/signals.py, после commit |
| Docker Compose | Запускает отдельные процессы приложения и инфраструктуры | compose.yaml |
| Nginx | Reverse proxy API/WS и раздача React/static/media | deploy/nginx.conf |
| DRF | CRUD API, Serializers, Views, Permissions | myapp, accounts |
| JWT | Определяет пользователя REST и WebSocket | SimpleJWT; первый WS frame |
| React | Показывает интерфейс и применяет события к state | frontend/src |
| Leaflet/OpenStreetMap | Интерактивная карта и маркеры поверх тайлов | CityMap.jsx |

TTL означает срок жизни ключа Redis. Через 60 секунд кэш маршрутов истекает,
следующий запрос снова получает модели из PostgreSQL. Redis не хранит основную БД.

Почему Celery не делает CRUD? CRUD нужен немедленно и выполняется DRF.
Фоновая задача каждую минуту завершает старые BOOKED-брони. Beat только планирует,
Redis broker хранит сообщение задачи, Worker исполняет код.

Почему WebSocket отдельно от REST? REST загружает исходные объекты и изменяет их.
WebSocket передаёт дальнейшие изменения координат, статусов и уведомления.
DEMO simulation меняет запись Vehicle через Celery; signal после commit отправляет
её consumer через Redis. React обновляет запись в state, Leaflet перемещает маркер.

Зачем channel layer? Worker и ASGI могут быть разными процессами.
Через Redis сообщение попадает в нужную группу: весь транспорт или конкретный user.
Staff получает отдельную группу всех личных событий. Обычный пользователь не
может подписать себя на чужую группу; consumer назначает группы по проверенному JWT.

Почему нет WSGI Gunicorn для сокетов? Выбран Daphne, который поддерживает ASGI.
Nginx пересылает WebSocket с заголовками Upgrade и Connection. Nginx не выполняет Django-код.

Что реально проверено? 22 теста на PostgreSQL и сборка React. Реальный Redis,
Worker/Beat и контейнерный deployment пока не проверены: Docker engine недоступен
из-за отсутствующего WSL. InMemoryChannelLayer используется только в тестах.
