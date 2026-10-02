# Smart City · Dushanbe

Небольшой учебный проект: Django REST API и React-интерфейс с настоящей интерактивной картой OpenStreetMap. Маршрут №88, три бронируемые парковки и движение микроавтобуса являются **DEMO DATA**, а не официальными городскими данными.

## Быстрый запуск

В первом терминале, из корня проекта:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py loaddata dushanbe_locations
.\.venv\Scripts\python.exe manage.py seed_demo_data
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

Если `.venv` ещё нет, сначала создайте его установленным Python: `python -m venv .venv`.

Во втором терминале:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Откройте `http://127.0.0.1:5173/` и зарегистрируйте пользователя. Vite пересылает запросы `/api/` и `/account/` в локальный Django. Для Django Admin отдельно создайте сотрудника через `manage.py createsuperuser`.

Проверка:

```powershell
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py test
cd frontend
npm.cmd run build
```

## Что действительно работает

Регистрация, вход, JWT access/refresh, выход, профиль; CRUD для девяти существующих моделей; разграничение прав; бронирование с проверкой времени; поиск прямого маршрута; Django Admin; Swagger. Команда `seed_demo_data` создаёт Route 88, 8 остановок, один Vehicle, 3 парковки и 15 мест. Она использует `get_or_create`, поэтому повторный запуск не добавляет дубликаты.

React показывает Dashboard, карту, парковки, бронирования, маршрут, события, обращения, камеру, помощника и профиль. Есть светлая и тёмная темы, мобильная компоновка, состояния загрузки и ошибок. Данные загружаются из Django API, а карта — из OpenStreetMap. Для картографических тайлов нужен интернет.

## API

| Адрес | Назначение |
| --- | --- |
| `/account/register/`, `/account/login/` | Регистрация и выдача JWT |
| `/account/token/refresh/`, `/account/logout/`, `/account/profile/` | Обновление токена, выход, профиль |
| `/api/parkings/`, `/api/parking-spots/`, `/api/bookings/` | Парковки, места, брони |
| `/api/parkings/<id>/availability/?start_time=...&end_time=...` | Свободные места за выбранный интервал |
| `/api/stops/`, `/api/routes/`, `/api/route-stops/`, `/api/vehicles/` | Транспорт и остановки |
| `/api/routes/search/?start_stop=ID&end_stop=ID` | Прямой маршрут в правильном направлении |
| `/api/route-paths/88/` | DEMO-линия маршрута 88 |
| `/api/incidents/`, `/api/service-requests/` | Дорожные события и обращения |
| `/swagger/`, `/admin/` | Документация и Django Admin |

Списки поддерживают `GET`, `POST`; запись по `/<id>/` — `GET`, `PUT`, `PATCH`, `DELETE`. Кроме регистрации и входа нужен заголовок `Authorization: Bearer <access>`. Городские данные читает авторизованный пользователь, изменяет сотрудник. Личные записи пользователь видит и меняет только свои. Поля `user` и `created_by` задаёт backend.

## Как устроен код

| Файл | Что делает | Что объяснить учителю |
| --- | --- | --- |
| `myapp/models.py` | Таблицы и связи | `ForeignKey` связывает объекты; `RouteStop.order` хранит последовательность; `CASCADE` удаляет зависимое, `SET_NULL` оставляет Vehicle без маршрута. |
| `myapp/serializer.py` | JSON и проверка данных | `ParkingBookingSerializer.validate()` проверяет время, активность места и пересечение броней. |
| `myapp/permissions.py` | Разрешает или запрещает действие | JWTAuthentication определяет `request.user`; permission проверяет его права. |
| `myapp/views.py` | Generic Views и небольшие специальные GET API | `get_queryset()` скрывает чужие записи; `perform_create()` назначает владельца перед сохранением. |
| `myapp/urls.py`, `accounts/urls.py` | Связь URL с views | URL — адрес конкретного действия API. |
| `frontend/src/api.js` | JWT, обновление токена, вызовы API | Frontend не передаёт владельца, а добавляет access token в заголовок. |
| `frontend/src/CityMap.jsx` | Leaflet-карта, маркеры и линия | OpenStreetMap рисует улицы, Django отдаёт координаты объектов. |
| `frontend/src/Pages.jsx` | Страницы и формы | Бронь, событие и обращение отправляются через API. |

В `frontend/src/CityMap.jsx` DEMO Vehicle перемещается по точкам `route_paths.json` только для демонстрации интерфейса. Это **не live GPS**. Линия также DEMO и не заявлена как точная дорожная геометрия.

## Геоданные и DEMO DATA

`myapp/fixtures/dushanbe_locations.json` содержит 4 нанесённые на карту остановки и 2 парковки с опубликованными координатами. Адреса парковок оставлены пустыми, а `is_active=false`: возможность реального бронирования не подтверждена. DEMO-парковки и места создаёт отдельная команда. Источники координат:

| Объект | OSM ID | Источник |
| --- | --- | --- |
| Zarafshan parking | way 486347100 | [Mapcarta / OSM](https://mapcarta.com/W486347100) |
| Таввакуфгох | way 377957311 | [Mapcarta / OSM](https://mapcarta.com/W377957311) |
| Парк имени Рудаки | node 300671943 | [Mapcarta / OSM](https://mapcarta.com/N300671943) |
| Мединститут | node 4865522022 | [Mapcarta / OSM](https://mapcarta.com/N4865522022) |
| Гостиница Авесто | node 6549124480 | [Mapcarta / OSM](https://mapcarta.com/N6549124480) |
| Фурудгох | node 5481809824 | [Mapcarta / OSM](https://mapcarta.com/N5481809824) |

[Министерство транспорта Таджикистана](https://mintrans.tj/en/surface-transport-city-routes-details/1) публикует номера и описания маршрутов, но не полный набор координат и точную линию. Поэтому Route 88 в проекте явно обозначен как DEMO. На карте видна атрибуция © OpenStreetMap contributors. Публичные тайлы используются только при обычном просмотре карты, без массовой загрузки.

## Камера и помощник

Камера использует `navigator.mediaDevices.getUserMedia()` для live preview и останавливает видеотреки при выключении. Видеопоток не сохраняется. Кнопка анализа честно сообщает `AI Analysis: Not connected`: модель обнаружения опасностей не подключена, кадр не отправляется. Для камеры на телефоне при открытии с другого устройства потребуется HTTPS; `localhost` на ноутбуке работает как защищённый контекст.

Помощник сейчас работает как встроенный справочник по функциям и устройству проекта. Он не обращается к внешней AI-модели и не выдаёт DEMO за официальные данные.

## Ограничения перед реальным городским запуском

- DEMO-маршрут, координаты DEMO-остановок, парковок и движение Vehicle нужно заменить проверенными городскими данными и GPS-интеграцией.
- Для настоящего одновременного бронирования нужна защита от гонок на уровне транзакций и подходящей базы данных. Учебная SQLite проверяет пересечения в обычных последовательных запросах.
- Камерный AI, автоматическая оценка опасности, экстренные вызовы и онлайн-оплата не подключены.
- Текущие `SECRET_KEY`, `DEBUG` и `ALLOWED_HOSTS` предназначены для локальной разработки. Перед публикацией их нужно настроить безопасно.
