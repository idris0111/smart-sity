"""An explicit offline guide using real, permission-scoped project records."""
import re

COPY = {
    'hello': ('Привет! Давай разберёмся. Могу подсказать парковку, показать маршрут или объяснить Smart City. Что тебе сейчас нужно?', 'Hi! Let’s work it out together. I can help with parking, show a route, or explain Smart City. What would you like to do?', 'Салом! Биё якҷоя ҳал кунем. Метавонам таваққуфгоҳ ё хатсайрро нишон диҳам ва Smart City-ро фаҳмонам. Ҳоло чӣ лозим аст?'),
    'thanks': ('Пожалуйста! Если нужно, можем дальше разобраться с маршрутом или парковкой.', 'You’re welcome! We can keep looking at routes or parking if you like.', 'Марҳамат! Агар хоҳед, хатсайр ё таваққуфгоҳро якҷоя меёбем.'),
    'help': ('Могу помочь с парковками, маршрутами и камерами из базы проекта. Для поиска объектов нажми Ctrl+K. Попробуй: «Где есть свободные места?» или «Покажи маршрут 88».', 'I can help with parking, routes and cameras in the project database. Press Ctrl+K to find objects. Try “Where are spaces available?” or “Show route 88”.', 'Бо таваққуфгоҳҳо, хатсайрҳо ва камераҳои пойгоҳи лоиҳа кӯмак мекунам. Барои ҷустуҷӯ Ctrl+K-ро пахш кунед. Масалан: «Ҷойҳои холӣ куҷоянд?» ё «Хатсайри 88-ро нишон деҳ».'),
    'empty': ('В базе проекта пока нет подходящих записей. Что ещё хочешь найти?', 'There are no matching records in the project database yet. What else would you like to find?', 'Дар пойгоҳи лоиҳа ҳоло сабти мувофиқ нест. Боз чӣ меҷӯед?'),
    'parking': ('Вот парковки со свободными местами сейчас:', 'Here is parking with spaces available now:', 'Инҳо таваққуфгоҳҳо бо ҷойҳои холӣ дар айни ҳол:'),
    'free': ('свободно', 'available', 'холӣ'),
    'booking_note': ('Это состояние на текущий момент. Для бронирования выбери время в разделе «Парковки» и проверь доступность ещё раз.', 'These counts are for right now. Choose your time in Parking and check availability again before booking.', 'Ин шумораҳо барои айни ҳоланд. Барои брон вақтро дар «Таваққуфгоҳҳо» интихоб намуда, дастрасиро боз санҷед.'),
    'full': ('Сейчас свободных мест в доступных парковках нет. Для другого времени проверь раздел «Парковки».', 'No spaces are currently available in the listed parking areas. Check Parking for another time.', 'Ҳоло дар таваққуфгоҳҳои дастрас ҷойи холӣ нест. Барои вақти дигар бахши «Таваққуфгоҳҳо»-ро санҷед.'),
    'routes': ('Нашёл такие маршруты в проекте:', 'I found these routes in the project:', 'Дар лоиҳа ин хатсайрҳоро ёфтам:'),
    'route_note': ('Кнопка ниже покажет маршрут на карте. В «Маршрутах» можно выбрать остановки отправления и прибытия.', 'Use a button below to see a route on the map. In Routes, choose departure and arrival stops.', 'Тугмаи поён хатсайрро дар харита нишон медиҳад. Дар «Хатсайрҳо» истгоҳҳои оғоз ва анҷомро интихоб кунед.'),
    'cameras': ('Вот записи разрешённых камер. UNKNOWN означает, что работоспособность ещё не проверена:', 'Here are the authorized camera records. UNKNOWN means the stream has not been checked yet:', 'Инҳо сабтҳои камераҳои иҷозатдодашудаанд. UNKNOWN маънои онро дорад, ки ҷараён ҳанӯз санҷида нашудааст:'),
    'demo': ('DEMO — учебные данные, а не официальная информация о городе.', 'DEMO means learning data, not official city information.', 'DEMO маълумоти омӯзишӣ аст, на маълумоти расмии шаҳр.'),
    'near': ('Подскажи название парковки или маршрута. Без твоего местоположения я не могу определить, что ближе. Можно найти объект через Ctrl+K.', 'Tell me the parking name or route number. I cannot determine what is closest without your location. Ctrl+K can help you find an object.', 'Номи таваққуфгоҳ ё рақами хатсайрро бигӯед. Бе ҷойгиршавии шумо наздиктаринро муайян карда наметавонам. Бо Ctrl+K объектро ёбед.'),
    'booking': ('Конечно! Открой «Парковки», выбери парковку, время начала и окончания, затем свободное место. Проверь детали и подтверди бронь. Я сам бронь не создаю.', 'Sure! Open Parking, choose a parking area, start and end times, then an available space. Review the details and confirm. I do not create bookings myself.', 'Албатта! «Таваққуфгоҳҳо»-ро кушоед, таваққуфгоҳ, вақти оғозу анҷом ва ҷойи холиро интихоб кунед. Маълумотро санҷида, бронро тасдиқ кунед. Ман худам брон намесозам.'),
    'report': ('Помогу. В «Обращениях» выбери тип проблемы, опиши её и укажи точку на карте. Затем проверь и отправь форму. Для дорожной проблемы используй «Инциденты».', 'I can help. In Requests, choose the issue type, describe it and mark a point on the map, then review and submit. Use Incidents for road problems.', 'Кӯмак мекунам. Дар «Муроҷиатҳо» навъи мушкилот, тавсиф ва нуқтаро дар харита интихоб кунед, сипас формаро санҷида фиристед. Барои мушкилоти роҳ «Ҳодисаҳо»-ро истифода баред.'),
    'color': ('Цвет можно выбрать в верхней панели: синий, красный или зелёный. Выбор сохраняется в этом браузере и действует также на входе и регистрации.', 'Choose blue, red or green in the top bar. Your choice is saved in this browser and also applies to sign-in and registration.', 'Дар панели боло кабуд, сурх ё сабзро интихоб кунед. Интихоб дар браузер нигоҳ дошта шуда, ба вуруд ва сабти ном ҳам таъсир мекунад.'),
}
PATTERNS = {
    'booking': r'брон|заброни|book|reserve|фармоиш',
    'parking': r'парков|свободн|мест[ао]|parking|spaces?|таваққуф|ҷой',
    'routes': r'маршрут|автобус|route|bus|хатсайр|нақлиёт',
    'cameras': r'камер|camera',
    'report': r'обращен|жалоб|проблем|инцидент|report|request|incident|муроҷиат|мушкил|ҳодиса',
    'color': r'цвет|тем[ау]|сини|красн|зел[её]н|colou?r|theme|ранг|кабуд|сурх|сабз',
}


def guide_answer(data, context):
    index = {'ru': 0, 'en': 1, 'tg': 2}.get(data.get('language'), 0)
    def t(key):
        return COPY[key][index]
    message = data['message'].casefold()
    def intent(value):
        return next((key for key, pattern in PATTERNS.items() if re.search(pattern, value)), None)
    topic = intent(message)
    # Prior assistant text is never treated as authoritative context.
    if not topic and re.search(r'покажи|его|эту|этот|какой|which|show|that|it\b|нишон|онро', message):
        for turn in reversed(data.get('history', [])):
            if turn['role'] == 'user' and intent(turn['content'].casefold()):
                topic = intent(turn['content'].casefold())
                message = turn['content'].casefold() + ' ' + message
                break
    if topic in ('parking', 'routes', 'cameras') and re.search(r'ближай|рядом|nearest|near me|наздик', message):
        return {'answer': t('near'), 'actions': []}
    if topic in ('booking', 'report', 'color'):
        return {'answer': t(topic), 'actions': []}
    if topic in ('parking', 'routes', 'cameras'):
        records = context[{'parking': 'parkings', 'routes': 'routes', 'cameras': 'cameras'}[topic]]
        numbers = re.findall(r'\b\d+\b', message)
        if topic == 'routes' and numbers:
            records = [item for item in records if str(item['number']) in numbers]
        if topic == 'parking':
            if records and not any(item['free_now'] for item in records):
                return {'answer': t('full'), 'actions': []}
            records = sorted((item for item in records if item['free_now'] > 0), key=lambda item: (-item['free_now'], item['id']))
        records = records[:5]
        if not records:
            return {'answer': t('empty'), 'actions': []}
        lines, actions = [t(topic)], []
        for item in records:
            name = item['name']
            if topic == 'parking':
                lines.append(f"• {name}: {t('free')} {item['free_now']}")
            elif topic == 'routes':
                lines.append(f"• {item['number']} — {name}")
            else:
                lines.append(f"• {name} — {item['status']}")
            actions.append({'type': {'parking': 'select_parking', 'routes': 'show_route', 'cameras': 'select_camera'}[topic], 'id': item['id']})
        if topic in ('parking', 'routes'):
            lines.extend(['', t('booking_note' if topic == 'parking' else 'route_note')])
        if any('demo' in item['name'].casefold() or (topic == 'routes' and str(item['number']) == '88') for item in records):
            lines.extend(['', t('demo')])
        return {'answer': '\n'.join(lines), 'actions': actions}
    if re.search(r'спасибо|благодар|thanks?|thank you|ташаккур|раҳмат', message):
        return {'answer': t('thanks'), 'actions': []}
    if re.search(r'привет|здравств|салом|hello|\bhi\b|салям', message):
        return {'answer': t('hello'), 'actions': []}
    return {'answer': t('help'), 'actions': []}
