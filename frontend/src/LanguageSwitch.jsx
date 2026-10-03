import { tr, useLanguage } from './i18n.js'

export default function LanguageSwitch() {
  const [language, setLanguage] = useLanguage()
  return <select className="language-switch" value={language} onChange={event => setLanguage(event.target.value)} aria-label={tr('Language')} title={tr('Language')}>
    <option value="tg">TJ · Тоҷикӣ</option>
    <option value="en">EN · English</option>
    <option value="ru">RU · Русский</option>
  </select>
}
