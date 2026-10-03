import { tr, getLocale } from "./i18n.js";
import LanguageSwitch from './LanguageSwitch.jsx';
import AccentSwitch from './AccentSwitch.jsx';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Building2, Eye, EyeOff, LockKeyhole, LoaderCircle, MapPin, ShieldCheck, UserRound, Route, SquareParking } from 'lucide-react';
import { login, register } from './api.js';
import { translations } from './i18n.js';
import './auth.css';

function AuthField({ name, label, value, onChange, error, busy, mode, inputRef }) {
  const [visible, setVisible] = useState(false);
  const password = name === 'password';
  const Icon = password ? LockKeyhole : UserRound;
  return <div className="city-auth-field">
    <label htmlFor={`auth-${name}`}>{tr(label)}</label>
    <div className="city-auth-input">
      <Icon size={18} aria-hidden="true" />
      <input ref={inputRef} id={`auth-${name}`} name={name} type={password && !visible ? 'password' : 'text'}
      autoComplete={password ? mode === 'login' ? 'current-password' : 'new-password' : 'username'}
      autoCapitalize="none" spellCheck={false} value={value} onChange={onChange} disabled={busy}
      inputMode={password ? undefined : 'text'} enterKeyHint={password ? 'go' : 'next'} maxLength={password ? mode === 'register' ? 128 : undefined : 150}
      aria-invalid={Boolean(error)} aria-describedby={error ? `auth-${name}-error` : undefined}
      placeholder={password ? tr("Enter your password") : tr("Enter your username")} />
      {password && <button type="button" className="city-auth-eye" onClick={() => setVisible(!visible)} disabled={busy}
      aria-label={visible ? tr("Hide password") : tr("Show password")} aria-pressed={visible}>
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>}
    </div>
    {error && <p className="city-auth-field-error" id={`auth-${name}-error`}>{tr(error)}</p>}
  </div>;
}

function AuthPanel({ mode }) {
  return <aside className="city-auth-panel">
    <div className="city-auth-brand"><span><Building2 size={22} /></span><div>SMART<span>CITY</span><small>{tr("DUSHANBE PLATFORM")}</small></div></div>
    <div className="city-auth-welcome" key={mode}>
      <span className="city-auth-eyebrow"><i />{tr("YOUR CITY, CONNECTED")}</span>
      <h1>{mode === 'login' ? <>{tr("A smarter city.")}<br /><em>{tr("A simpler day.")}</em></> : <>{tr("One account.")}<br /><em>{tr("Your whole city.")}</em></>}</h1>
      <p>{tr("Ваш маршрут. Ваше место. Ваш город.")}<br />{tr("Всё начинается со Smart City.")}</p>
    </div>
    <div className="city-auth-scene" aria-hidden="true">
      <div className="city-auth-orb"><i /><i /><i /><i /><span /></div>
      <div className="city-auth-scene-label scene-route"><Route size={16} /><span>{tr("EXPLORE")}<strong>{tr("Dushanbe routes")}</strong></span><i /></div>
      <div className="city-auth-scene-label scene-parking"><SquareParking size={16} /><span>{tr("DISCOVER")}<strong>{tr("Your next stop")}</strong></span></div>
      <div className="city-auth-particles"><i /><i /><i /><i /></div>
    </div>
    <div className="city-auth-location"><MapPin size={14} />{tr("DUSHANBE") + " "}<span>38.56° N / 68.78° E</span></div>
  </aside>;
}

function PasswordStrength({ password }) {
  const score = Number(password.length >= 8) + Number(password.length >= 12) +
  Number(/[a-z]/.test(password) && /[A-Z]/.test(password)) +
  Number(/\d/.test(password) && /[^\w\s]/.test(password));
  const level = password ? score >= 3 ? 'Strong' : score >= 2 ? 'Medium' : 'Weak' : 'Not entered';
  return <div className="city-auth-strength" data-level={level.toLowerCase()}>
    <div><span>{tr("Password strength")}</span><strong aria-live="polite">{tr(level)}</strong></div>
    <div className="city-auth-strength-bars" aria-hidden="true">{[1, 2, 3, 4].map((n) => <i key={n} className={password && n <= Math.max(1, score) ? 'filled' : ''} />)}</div>
    <p>{tr("Рекомендуем длинный уникальный пароль. Это подсказка, а не условие регистрации.")}</p>
  </div>;
}

export default function AuthPage({ onDone }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [accountCreated, setAccountCreated] = useState(false);
  const pending = useRef(false);
  const usernameInput = useRef(null);
  const previousMode = useRef(mode);

  useEffect(() => {
    if (previousMode.current !== mode) usernameInput.current?.focus({ preventScroll: true });
    previousMode.current = mode;
  }, [mode]);

  function switchMode() {
    if (pending.current) return;
    setMode((current) => current === 'login' ? 'register' : 'login');
    setPassword('');
    setErrors({});
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    const validation = {};
    if (!username.trim()) validation.username = tr("Username is required");
    if (!password) validation.password = tr("Password is required");
    setErrors(validation);
    setError('');
    if (Object.keys(validation).length) {
      event.currentTarget.querySelector(`[name="${Object.keys(validation)[0]}"]`)?.focus();
      return;
    }
    pending.current = true;
    setBusy(true);
    let created = false;
    try {
      if (mode === 'register') {
        await register(username.trim(), password);
        created = true;
        setAccountCreated(true);
      }
      await login(username.trim(), password);
      onDone();
    } catch (issue) {
      if (created) setMode('login');
      const fields = {};
      for (const field of ['username', 'password']) {
        if (issue.fields?.[field]) fields[field] = [].concat(issue.fields[field]).join(' ');
      }
      setErrors(fields);
      if (!Object.keys(fields).length) setError(issue.message || tr("Unable to sign in. Please try again."));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function update(field, value) {
    if (field === 'username') {setUsername(value);setAccountCreated(false);} else
    setPassword(value);
    setErrors((current) => ({ ...current, [field]: '' }));
    setError('');
  }

  return <main className="city-auth">
    <div className="city-auth-ambient" aria-hidden="true"><i /><i /></div>
    <header className="city-auth-page-header"><span>SMART CITY <i>/</i>{tr("DUSHANBE")}</span><span><AccentSwitch /><LanguageSwitch /><ShieldCheck size={14} />{tr("ACCOUNT ACCESS")}</span></header>
    <div className={`city-auth-card ${mode === 'register' ? 'is-register' : ''}`}>
      <AuthPanel mode={mode} />
      <section className="city-auth-form-panel" aria-label={mode === 'login' ? tr("Sign in") : tr("Register")}>
        <nav className="city-auth-mode" aria-label={tr("Account access")}>
          <button type="button" aria-pressed={mode === 'login'} disabled={busy} onClick={() => {if (mode !== 'login') switchMode();}}>{tr("Sign in")}</button>
          <button type="button" aria-pressed={mode === 'register'} disabled={busy} onClick={() => {if (mode !== 'register') switchMode();}}>{tr("Create account")}</button>
          <i aria-hidden="true" />
        </nav>
        <div className="city-auth-form-content" key={mode}>
          <span className="city-auth-form-symbol"><UserRound size={23} /></span>
          <span className="city-auth-eyebrow">{mode === 'login' ? tr("YOUR NEXT CHAPTER STARTS HERE") : tr("MAKE THE CITY YOURS")}</span>
          <h2>{mode === 'login' ? tr("Welcome back") : tr("Create account")}</h2>
          <p className="city-auth-subtitle">{mode === 'login' ? tr("Sign in to continue to your city.") : tr("Create your account and start exploring.")}</p>
          <form onSubmit={submit} noValidate aria-busy={busy}>
            <AuthField name="username" label={tr("Username")} value={username} onChange={(e) => update('username', e.target.value)} error={errors.username} busy={busy} mode={mode} inputRef={usernameInput} />
            <AuthField name="password" label={tr("Password")} value={password} onChange={(e) => update('password', e.target.value)} error={errors.password} busy={busy} mode={mode} />
            {mode === 'register' && <PasswordStrength password={password} />}
            {accountCreated && <p className="city-auth-notice" role="status">{tr("Account created. Sign in to continue.")}</p>}
            {error && <div className="city-auth-error" role="alert">{tr(error)}</div>}
            <button className="city-auth-submit" disabled={busy} type="submit">
              {busy ? <><LoaderCircle size={18} className="city-auth-spinner" /> {mode === 'login' ? tr("SIGNING IN…") : tr("CREATING ACCOUNT…")}</> : <>{mode === 'login' ? tr("LOGIN") : tr("CREATE ACCOUNT")} <ArrowRight size={18} /></>}
            </button>
          </form>
          <p className="city-auth-switch">{mode === 'login' ? tr("Don't have an account?") : tr("Already have an account?")} <button type="button" disabled={busy} onClick={switchMode}>{mode === 'login' ? tr("Create account") : tr("Sign in")}</button></p>
          <div className="city-auth-footer"><ShieldCheck size={14} />{tr("ONE ACCOUNT. A CONNECTED CITY.")}</div>
        </div>
      </section>
    </div>
    <footer className="city-auth-caption"><span>{tr("BUILT AROUND YOUR CITY.")}</span><span>SMART CITY · DUSHANBE</span></footer>
  </main>;
}
