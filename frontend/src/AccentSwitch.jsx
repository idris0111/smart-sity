import { Palette } from "lucide-react";
import { useLanguage } from "./i18n.js";
import { useAccent, setAccent } from "./appearance.js";

const labels = {
  ru: ["Цвет интерфейса", "Синий", "Красный", "Зелёный"],
  en: ["Interface color", "Blue", "Red", "Green"],
  tg: ["Ранги интерфейс", "Кабуд", "Сурх", "Сабз"],
};
export default function AccentSwitch() {
  const [language] = useLanguage();
  const accent = useAccent();
  const text = labels[language] || labels.ru;
  return (
    <label className="accent-switch" title={text[0]}>
      <Palette size={15} aria-hidden="true" />
      <select
        aria-label={text[0]}
        value={accent}
        onChange={(event) => setAccent(event.target.value)}
      >
        {["blue", "red", "green"].map((key, index) => (
          <option key={key} value={key}>
            {text[index + 1]}
          </option>
        ))}
      </select>
    </label>
  );
}
