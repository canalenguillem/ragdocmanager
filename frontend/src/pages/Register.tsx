import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

const PHONE_CODES = [
  { label: 'Espana (+34)', value: '+34' },
  { label: 'Francia (+33)', value: '+33' },
  { label: 'Italia (+39)', value: '+39' },
  { label: 'Portugal (+351)', value: '+351' },
  { label: 'Reino Unido (+44)', value: '+44' },
  { label: 'Alemania (+49)', value: '+49' },
  { label: 'Estados Unidos (+1)', value: '+1' },
  { label: 'Mexico (+52)', value: '+52' }
];

export function Register() {
  const navigate = useNavigate();
  const register = useAuthStore((state) => state.register);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneCode, setPhoneCode] = useState('+34');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cleanedPhone = phoneNumber.replace(/[^\d\s()-]/g, '').trim();
      await register(email, password, name, cleanedPhone ? `${phoneCode} ${cleanedPhone}` : null);
      navigate('/dashboard');
    } catch {
      setError('No se pudo crear la cuenta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Crear cuenta</h1>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" required />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required />
        <div style={{ display: 'flex', gap: 10 }}>
          <select
            value={phoneCode}
            onChange={(e) => setPhoneCode(e.target.value)}
            style={{ width: 180 }}
          >
            {PHONE_CODES.map((code) => (
              <option key={code.value} value={code.value}>{code.label}</option>
            ))}
          </select>
          <input
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="Telefono (opcional)"
            type="tel"
          />
        </div>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          type="password"
          required
        />
        {error ? <div className="form-error">{error}</div> : null}
        <button type="submit" disabled={loading}>
          {loading ? 'Creando...' : 'Registrarse'}
        </button>
        <p>
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </p>
      </form>
    </div>
  );
}
