import * as React from "react";

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  companyName?: string;
  position?: string;
}

export interface AuthProps {
  onLogin: (email: string, pass: string) => Promise<void>;
  onRegister: (data: RegisterData) => Promise<void>;
  onOAuthLogin?: (provider: 'google' | 'apple') => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  successMessage?: string | null;
}

// ── Inline SVG icons ──────────────────────────────────────────
const IconMail = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
);
const IconLock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
);
const IconUser = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);
const IconPhone = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
);
const IconBuilding = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>
);
const IconBriefcase = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
);
const IconCheck = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
);
const IconHardHat = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#F28C28" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z"/><path d="M10 15V7.103a3 3 0 0 1 .882-2.121L12 3.88l1.118 1.102A3 3 0 0 1 14 7.103V15"/><path d="M14 15V9.236a5 5 0 0 1 2.438-4.292L18 4v11"/><path d="M6 4l1.562.947A5 5 0 0 1 10 9.236V15"/></svg>
);

// ── CSS keyframes & animations (injected once) ───────────────
const ANIMATION_CSS = `
@keyframes docstruc-float {
  0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.07; }
  50% { transform: translateY(-20px) rotate(5deg); opacity: 0.12; }
}
@keyframes docstruc-float-reverse {
  0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.05; }
  50% { transform: translateY(15px) rotate(-3deg); opacity: 0.09; }
}
@keyframes docstruc-pulse-ring {
  0% { transform: scale(0.95); opacity: 0.5; }
  50% { transform: scale(1.05); opacity: 0.3; }
  100% { transform: scale(0.95); opacity: 0.5; }
}
@keyframes docstruc-slide-up {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes docstruc-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes docstruc-shimmer {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}
@keyframes docstruc-grid-move {
  0% { transform: translate(0, 0); }
  100% { transform: translate(40px, 40px); }
}

.docstruc-auth-input {
  width: 100%;
  padding: 12px 14px 12px 42px;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  font-size: 15px;
  color: #1e293b;
  background: #f8fafc;
  outline: none;
  transition: all 0.2s ease;
  font-family: inherit;
  box-sizing: border-box;
}
.docstruc-auth-input:focus {
  border-color: #F28C28;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(242, 140, 40, 0.12);
}
.docstruc-auth-input::placeholder {
  color: #94a3b8;
}
.docstruc-auth-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s ease;
  font-family: inherit;
  letter-spacing: 0.3px;
}
.docstruc-auth-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(14, 42, 71, 0.25);
}
.docstruc-auth-btn:active:not(:disabled) {
  transform: translateY(0);
}
.docstruc-auth-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.docstruc-toggle-link {
  color: #F28C28;
  font-weight: 600;
  cursor: pointer;
  border: none;
  background: none;
  font-size: 14px;
  padding: 0;
  text-decoration: none;
  transition: color 0.2s;
  font-family: inherit;
}
.docstruc-toggle-link:hover {
  color: #e07b1a;
  text-decoration: underline;
}
`;

let cssInjected = false;
function injectCSS() {
  if (cssInjected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.textContent = ANIMATION_CSS;
  document.head.appendChild(style);
  cssInjected = true;
}

// ── Field component ──────────────────────────────────────────
function AuthField({ icon, label, required, value, onChange, placeholder, type = 'text' }: {
  icon: React.ReactNode;
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: 'block',
        fontSize: 13,
        fontWeight: 600,
        color: '#475569',
        marginBottom: 6,
        letterSpacing: 0.2,
      }}>
        {label}{required && <span style={{ color: '#F28C28', marginLeft: 2 }}>*</span>}
      </label>
      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute',
          left: 13,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          alignItems: 'center',
          pointerEvents: 'none',
        }}>
          {icon}
        </div>
        <input
          className="docstruc-auth-input"
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoComplete={type === 'password' ? 'new-password' : 'off'}
        />
      </div>
    </div>
  );
}

// ── Blueprint grid background ────────────────────────────────
function BlueprintBackground() {
  return (
    <>
      {/* Blueprint grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `
          linear-gradient(rgba(14, 42, 71, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(14, 42, 71, 0.03) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
        animation: 'docstruc-grid-move 20s linear infinite',
      }} />

      {/* Decorative construction elements */}
      <div style={{
        position: 'absolute', top: '8%', left: '5%', width: 120, height: 120,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(242,140,40,0.08) 0%, transparent 70%)',
        animation: 'docstruc-float 8s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', top: '15%', right: '8%', width: 80, height: 80,
        borderRadius: 16,
        border: '2px solid rgba(14, 42, 71, 0.04)',
        transform: 'rotate(45deg)',
        animation: 'docstruc-float-reverse 10s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', bottom: '12%', left: '10%', width: 60, height: 60,
        borderRadius: 12,
        background: 'rgba(14, 42, 71, 0.03)',
        animation: 'docstruc-float 12s ease-in-out infinite 2s',
      }} />
      <div style={{
        position: 'absolute', bottom: '20%', right: '6%', width: 100, height: 100,
        borderRadius: '50%',
        border: '2px solid rgba(242, 140, 40, 0.06)',
        animation: 'docstruc-pulse-ring 6s ease-in-out infinite',
      }} />

      {/* Diagonal construction lines */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.03, pointerEvents: 'none' }}>
        <line x1="0" y1="100%" x2="30%" y2="0" stroke="#0E2A47" strokeWidth="1" />
        <line x1="70%" y1="100%" x2="100%" y2="30%" stroke="#0E2A47" strokeWidth="1" />
        <line x1="50%" y1="100%" x2="80%" y2="0" stroke="#F28C28" strokeWidth="0.5" />
      </svg>
    </>
  );
}

// ── Main LoginForm component ─────────────────────────────────
export function LoginForm({ onLogin, onRegister, onOAuthLogin, isLoading, error, successMessage }: AuthProps) {
  React.useEffect(() => { injectCSS(); }, []);

  const [isLogin, setIsLogin] = React.useState(true);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [companyName, setCompanyName] = React.useState("");
  const [position, setPosition] = React.useState("");
  const [showSuccess, setShowSuccess] = React.useState(false);
  const [formKey, setFormKey] = React.useState(0); // for re-triggering animation

  // Track successful registration
  React.useEffect(() => {
    if (successMessage) setShowSuccess(true);
    else setShowSuccess(false);
  }, [successMessage]);

  const canSubmit = isLogin
    ? email.trim() !== '' && password.trim() !== ''
    : email.trim() !== '' && password.trim() !== '' && firstName.trim() !== '' && lastName.trim() !== '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (isLogin) {
      await onLogin(email, password);
    } else {
      await onRegister({
        email,
        password,
        firstName,
        lastName,
        phone: phone || undefined,
        companyName: companyName || undefined,
        position: position || undefined,
      });
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setShowSuccess(false);
    setFormKey(k => k + 1);
  };

  // ── Success screen after registration ────────────────────
  if (showSuccess && !isLogin) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        minHeight: '100vh', width: '100%',
        background: 'linear-gradient(135deg, #0E2A47 0%, #1a3a5c 40%, #0E2A47 100%)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        position: 'relative', overflow: 'hidden',
      }}>
        <BlueprintBackground />
        <div style={{
          background: '#fff',
          borderRadius: 24,
          padding: '48px 40px',
          maxWidth: 460,
          width: '90%',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
          animation: 'docstruc-slide-up 0.5s ease-out',
          boxShadow: '0 25px 60px rgba(0,0,0,0.2)',
        }}>
          <div style={{
            width: 80, height: 80,
            borderRadius: '50%',
            background: '#f0fdf4',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
            border: '3px solid #bbf7d0',
          }}>
            <IconCheck />
          </div>
          <h2 style={{ color: '#0E2A47', fontSize: 24, fontWeight: 800, margin: '0 0 12px', letterSpacing: -0.3 }}>
            Registrierung erfolgreich!
          </h2>
          <p style={{ color: '#64748b', fontSize: 15, lineHeight: 1.6, margin: '0 0 8px' }}>
            {successMessage || 'Wir haben Ihnen eine Bestätigungs-E-Mail gesendet.'}
          </p>
          <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.5, margin: '0 0 32px' }}>
            Bitte überprüfen Sie Ihren Posteingang und klicken Sie auf den Bestätigungslink, um Ihr Konto zu aktivieren.
          </p>
          <button
            className="docstruc-auth-btn"
            onClick={toggleMode}
            style={{
              background: '#0E2A47',
              color: '#fff',
            }}
          >
            Zur Anmeldung
          </button>
        </div>
      </div>
    );
  }

  // ── Main auth form ───────────────────────────────────────
  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      width: '100%',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* Left panel — branding */}
      <div style={{
        flex: '0 0 45%',
        background: 'linear-gradient(135deg, #0E2A47 0%, #1a3a5c 50%, #0E2A47 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        position: 'relative', overflow: 'hidden',
        padding: '40px',
      }}>
        <BlueprintBackground />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', animation: 'docstruc-fade-in 0.8s ease-out' }}>
          {/* Logo area */}
          <div style={{
            width: 72, height: 72,
            borderRadius: 20,
            background: 'rgba(242, 140, 40, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 28px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(242, 140, 40, 0.2)',
          }}>
            <IconHardHat />
          </div>

          <h1 style={{
            color: '#ffffff', fontSize: 36, fontWeight: 800,
            margin: '0 0 12px', letterSpacing: -0.5,
          }}>
            DocStruc
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.6)', fontSize: 16, fontWeight: 400,
            margin: '0 0 48px', lineHeight: 1.5,
          }}>
            Baudokumentation. Digital. Einfach.
          </p>

          {/* Feature highlights */}
          {[
            { title: 'Projekte verwalten', desc: 'Alle Bauprojekte an einem Ort' },
            { title: 'Team koordinieren', desc: 'Aufgaben und Rollen zuweisen' },
            { title: 'Dokumentation', desc: 'Lückenlose Baudokumentation' },
          ].map((feat, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              marginBottom: 20,
              padding: '14px 20px',
              borderRadius: 14,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(8px)',
              animation: `docstruc-slide-up 0.5s ease-out ${0.2 + i * 0.1}s both`,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(242, 140, 40, 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 16 }}>{['🏗️', '👥', '📋'][i]}</span>
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{feat.title}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{feat.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{
        flex: 1,
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        background: '#f8fafc',
        padding: '40px 20px',
        overflowY: 'auto',
      }}>
        <div
          key={formKey}
          style={{
            width: '100%', maxWidth: 440,
            animation: 'docstruc-slide-up 0.4s ease-out',
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: 32, textAlign: 'center' }}>
            <h2 style={{
              color: '#0E2A47', fontSize: 28, fontWeight: 800,
              margin: '0 0 8px', letterSpacing: -0.3,
            }}>
              {isLogin ? 'Willkommen zurück' : 'Konto erstellen'}
            </h2>
            <p style={{ color: '#64748b', fontSize: 15, margin: 0 }}>
              {isLogin
                ? 'Melden Sie sich an, um fortzufahren'
                : 'Erstellen Sie Ihr DocStruc-Konto'}
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div style={{
              marginBottom: 20,
              padding: '14px 16px',
              background: '#fef2f2',
              borderRadius: 12,
              border: '1px solid #fecaca',
              display: 'flex', alignItems: 'center', gap: 10,
              animation: 'docstruc-slide-up 0.3s ease-out',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span style={{ color: '#dc2626', fontSize: 14, fontWeight: 500 }}>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {/* Registration-only fields */}
            {!isLogin && (
              <>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <AuthField
                      icon={<IconUser />}
                      label="Vorname"
                      required
                      value={firstName}
                      onChange={setFirstName}
                      placeholder="Max"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <AuthField
                      icon={<IconUser />}
                      label="Nachname"
                      required
                      value={lastName}
                      onChange={setLastName}
                      placeholder="Mustermann"
                    />
                  </div>
                </div>
              </>
            )}

            <AuthField
              icon={<IconMail />}
              label="E-Mail"
              required
              value={email}
              onChange={setEmail}
              placeholder="name@firma.de"
              type="email"
            />

            <AuthField
              icon={<IconLock />}
              label="Passwort"
              required
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              type="password"
            />

            {/* Additional registration fields */}
            {!isLogin && (
              <>
                <AuthField
                  icon={<IconPhone />}
                  label="Telefonnummer"
                  value={phone}
                  onChange={setPhone}
                  placeholder="+49 123 456789"
                  type="tel"
                />

                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <AuthField
                      icon={<IconBuilding />}
                      label="Unternehmen"
                      value={companyName}
                      onChange={setCompanyName}
                      placeholder="Musterbau GmbH"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <AuthField
                      icon={<IconBriefcase />}
                      label="Position"
                      value={position}
                      onChange={setPosition}
                      placeholder="Bauleiter"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Submit button */}
            <div style={{ marginTop: 8 }}>
              <button
                className="docstruc-auth-btn"
                type="submit"
                disabled={isLoading || !canSubmit}
                style={{
                  background: canSubmit ? 'linear-gradient(135deg, #0E2A47 0%, #1a3a5c 100%)' : '#e2e8f0',
                  color: canSubmit ? '#fff' : '#94a3b8',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {isLoading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                    </svg>
                    Bitte warten...
                  </span>
                ) : (
                  isLogin ? 'Anmelden' : 'Registrieren'
                )}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16,
            margin: '28px 0 20px',
          }}>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            <span style={{ color: '#94a3b8', fontSize: 13 }}>oder</span>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          </div>

          {/* OAuth Buttons */}
          {onOAuthLogin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {/* Google */}
              <button
                type="button"
                disabled={isLoading}
                onClick={() => onOAuthLogin('google')}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  width: '100%', padding: '11px 16px',
                  background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10,
                  fontSize: 14, fontWeight: 600, color: '#0f172a', cursor: 'pointer',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#94a3b8'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.07)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e2e8f0'; (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'; }}
              >
                <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
                  <path d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" fill="#FFC107"/>
                  <path d="M6.3 14.7l7 5.1C15 16.1 19.1 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 16.3 2 9.7 7.4 6.3 14.7z" fill="#FF3D00"/>
                  <path d="M24 46c5.5 0 10.5-1.9 14.3-5.1l-6.6-5.6C29.5 36.9 26.9 38 24 38c-6.1 0-11.3-4.1-13.1-9.6l-7 5.4C7.5 41.8 15.2 46 24 46z" fill="#4CAF50"/>
                  <path d="M44.5 20H24v8.5h11.8c-1 2.8-2.9 5.1-5.5 6.7l6.6 5.6C41.2 37.2 44.5 31 44.5 24c0-1.3-.2-2.7-.5-4z" fill="#1976D2"/>
                </svg>
                Mit Google anmelden
              </button>

              {/* Apple */}
              <button
                type="button"
                disabled={isLoading}
                onClick={() => onOAuthLogin('apple')}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  width: '100%', padding: '11px 16px',
                  background: '#000', border: '1.5px solid #000', borderRadius: 10,
                  fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer',
                  transition: 'background 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.18)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#000'; (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'; }}
              >
                <svg width="16" height="18" viewBox="0 0 814 1000" fill="white">
                  <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.5-157.2-92.2c-57.6-60.3-103-153.2-103-241.4 0-203.8 131.4-314.5 260.3-314.5 69.4 0 127.1 45.9 171.2 45.9 42.8 0 109.7-48.9 189.9-48.9 30.7 0 109.7 2.6 163.5 85.5z"/>
                  <path d="M549.1 175.2c22.4-26.9 38.4-64.1 38.4-101.4 0-5.1-.4-10.3-1.3-14.4-36.5 1.4-79.8 24.4-106.2 54.5-20.5 23.7-39.4 60.3-39.4 98.1 0 5.7.6 11.4 1.3 13.1 2.5.6 6.4 1.3 10.2 1.3 32.7 0 73.3-21.7 97-51.2z"/>
                </svg>
                Mit Apple anmelden
              </button>
            </div>
          )}

          {/* Toggle */}
          <div style={{ textAlign: 'center' }}>
            <span style={{ color: '#64748b', fontSize: 14 }}>
              {isLogin ? 'Noch kein Konto? ' : 'Bereits registriert? '}
            </span>
            <button className="docstruc-toggle-link" onClick={toggleMode} type="button">
              {isLogin ? 'Jetzt registrieren' : 'Zur Anmeldung'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
