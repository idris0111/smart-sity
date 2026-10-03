import { useSyncExternalStore } from 'react'
import copy from './locales.json'

const supported = ['ru', 'en', 'tg']
const savedLanguage = typeof localStorage !== 'undefined' ? localStorage.getItem('smart-city-language') : 'ru'
let currentLanguage = supported.includes(savedLanguage) ? savedLanguage : 'ru'
const listeners = new Set()
const sourceByTranslation = new Map()
for (const [source, versions] of Object.entries(copy)) {
  for (const text of Object.values(versions)) if (!sourceByTranslation.has(text)) sourceByTranslation.set(text, source)
}
export function setLanguage(language) {
  if (!supported.includes(language)) return
  currentLanguage = language
  if (typeof localStorage !== 'undefined') localStorage.setItem('smart-city-language', language)
  if (typeof document !== 'undefined') document.documentElement.lang = language
  listeners.forEach(listener => listener())
}
const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener) }
export function useLanguage() {
  return [useSyncExternalStore(subscribe, () => currentLanguage, () => currentLanguage), setLanguage]
}
export function tr(text, values = {}) {
  if (typeof text !== 'string') return text
  const source = copy[text] ? text : sourceByTranslation.get(text)
  const translated = copy[source]?.[currentLanguage] || text
  return translated.replace(/\{(\d+)\}/g, (match, key) => String(values[key] ?? match))
}
export function getLocale() { return { ru: 'ru-RU', en: 'en-US', tg: 'tg-TJ' }[currentLanguage] }
export function sourceText(text) { return sourceByTranslation.get(text) || text }

export const translations = {
  ru: {
    nav: {
      dashboard: 'Обзор города',
      admin: 'Управление',
      map: 'Карта города',
      parking: 'Парковки',
      routes: 'Маршруты',
      incidents: 'События',
      requests: 'Обращения',
      camera: 'Камера',
      assistant: 'AI помощник',
      profile: 'Профиль',
      logout: 'Выйти',
      search: 'Поиск по городу...'
    },
    auth: {
      signIn: 'Войти',
      createAccount: 'Создать аккаунт',
      username: 'Имя пользователя',
      password: 'Пароль',
      welcomeBack: 'С возвращением',
      welcomeCreate: 'Создать аккаунт',
      subtitleLogin: 'Войдите в систему, чтобы продолжить.',
      subtitleRegister: 'Создайте аккаунт и начните исследовать город.',
      accountReady: 'Аккаунт создан. Войдите, чтобы продолжить.',
      usernameRequired: 'Имя пользователя обязательно',
      passwordRequired: 'Пароль обязателен',
      signInButton: 'Войти',
      registerButton: 'Создать аккаунт',
      switchLogin: 'Уже есть аккаунт?',
      switchRegister: 'Нет аккаунта?',
      switchActionLogin: 'Создать аккаунт',
      switchActionRegister: 'Войти',
      passwordStrength: 'Сила пароля',
      passwordHint: 'Рекомендуем длинный уникальный пароль.'
    },
    dashboard: {
      heading: 'Ваш город. Ближе, чем когда-либо.',
      subtitle: 'Находите маршруты, планируйте поездки и решайте городские вопросы в одном месте.',
      explore: 'Исследовать город',
      findParking: 'Найти парковку',
      overview: 'Обзор города',
      live: 'Город в движении',
      lastActions: 'Последние действия',
      empty: 'Ваши бронирования и обращения появятся здесь.'
    }
  },
  en: {
    nav: {
      dashboard: 'City overview',
      admin: 'Management',
      map: 'City map',
      parking: 'Parking',
      routes: 'Routes',
      incidents: 'Incidents',
      requests: 'Requests',
      camera: 'Camera',
      assistant: 'AI assistant',
      profile: 'Profile',
      logout: 'Log out',
      search: 'Search the city...'
    },
    auth: {
      signIn: 'Sign in',
      createAccount: 'Create account',
      username: 'Username',
      password: 'Password',
      welcomeBack: 'Welcome back',
      welcomeCreate: 'Create account',
      subtitleLogin: 'Sign in to continue.',
      subtitleRegister: 'Create your account and start exploring the city.',
      accountReady: 'Account created. Sign in to continue.',
      usernameRequired: 'Username is required',
      passwordRequired: 'Password is required',
      signInButton: 'LOGIN',
      registerButton: 'CREATE ACCOUNT',
      switchLogin: 'Already have an account?',
      switchRegister: 'Don’t have an account?',
      switchActionLogin: 'Create account',
      switchActionRegister: 'Sign in',
      passwordStrength: 'Password strength',
      passwordHint: 'We recommend a long unique password.'
    },
    dashboard: {
      heading: 'Your city. Closer than ever.',
      subtitle: 'Find routes, plan trips, and solve city issues in one place.',
      explore: 'Explore city',
      findParking: 'Find parking',
      overview: 'City overview',
      live: 'The city in motion',
      lastActions: 'Recent activity',
      empty: 'Your bookings and requests will appear here.'
    }
  },
  tg: {
    nav: {
      dashboard: 'Намоиши шаҳр',
      admin: 'Идоракунӣ',
      map: 'Харитаи шаҳр',
      parking: 'Таваққуфгоҳҳо',
      routes: 'Хатсайрҳо',
      incidents: 'Ҳодисаҳо',
      requests: 'Муроҷиатҳо',
      camera: 'Камера',
      assistant: 'Ёрдамчии AI',
      profile: 'Профил',
      logout: 'Баромад',
      search: 'Ҷустуҷӯи шаҳр...'
    },
    auth: {
      signIn: 'Вуруд',
      createAccount: 'Эҷоди ҳисоб',
      username: 'Номи корбар',
      password: 'Парол',
      welcomeBack: 'Хуш омадед',
      welcomeCreate: 'Эҷоди ҳисоб',
      subtitleLogin: 'Барои идома додан ворид шавед.',
      subtitleRegister: 'Ҳисоби худро созед ва шаҳрро кашф кунед.',
      accountReady: 'Ҳисоб офарида шуд. Барои идома ворид шавед.',
      usernameRequired: 'Номи корбар ҳатмӣ аст',
      passwordRequired: 'Парол ҳатмӣ аст',
      signInButton: 'ВУРУД',
      registerButton: 'ЭҶОДИ ҲИСОБ',
      switchLogin: 'Ҳисоб доред?',
      switchRegister: 'Ҳисоб надоред?',
      switchActionLogin: 'Эҷоди ҳисоб',
      switchActionRegister: 'Вуруд',
      passwordStrength: 'Қуввати пароль',
      passwordHint: 'Пароли дароз ва беназирро тавсия медиҳем.'
    },
    dashboard: {
      heading: 'Шаҳри шумо. Наздиктар аз ҳамеша.',
      subtitle: 'Маршрутҳо, сафарҳо ва мушкилоти шаҳриро дар як ҷой пайдо кунед.',
      explore: 'Кашфи шаҳр',
      findParking: 'Ёфтани парковка',
      overview: 'Намоиши шаҳр',
      live: 'Шаҳр дар ҳаракат',
      lastActions: 'Фаъолиятҳои охирин',
      empty: 'Броньҳо ва дархостҳои шумо ин ҷо пайдо мешаванд.'
    }
  }
}
