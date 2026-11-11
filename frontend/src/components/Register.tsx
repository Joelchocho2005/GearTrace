import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../api/errors';
import { authApi } from '../api/resources';
import { useAuth } from '../contexts/AuthContext';

/** Mismos límites que RegisterDto en el backend. */
const MIN_PASSWORD = 6;
const MAX_PASSWORD = 72;

const inputClass =
  'appearance-none rounded-xl block w-full px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 sm:text-sm glass-input';

/** /registro — alta pública de clientes. El backend fuerza el rol CLIENTE. */
export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    try {
      const { accessToken, user } = await authApi.register({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      toast.success(`Cuenta creada. Bienvenido, ${user.name}`);
      login(accessToken, user);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo crear la cuenta.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500 opacity-20 blur-[128px]" />

      <div className="glass-strong relative z-10 w-full max-w-md space-y-8 rounded-2xl p-10 shadow-2xl">
        <div>
          <div className="icon-badge mx-auto flex h-16 w-16 items-center justify-center rounded-2xl">
            <UserPlus size={32} strokeWidth={2.5} />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">Crear cuenta</h2>
          <p className="mt-2 text-center text-sm text-slate-400">
            Registra tu cuenta de cliente para seguir tus reparaciones y agendar citas.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="register-name" className="sr-only">Nombre completo</label>
            <input id="register-name" required maxLength={150} autoComplete="name" placeholder="Nombre completo" value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="register-email" className="sr-only">Correo electrónico</label>
            <input id="register-email" type="email" required autoComplete="email" placeholder="Correo electrónico" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="register-password" className="sr-only">Contraseña</label>
            <input id="register-password" type="password" required minLength={MIN_PASSWORD} maxLength={MAX_PASSWORD} autoComplete="new-password" placeholder={`Contraseña (mín. ${MIN_PASSWORD} caracteres)`} value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="register-confirm" className="sr-only">Repite la contraseña</label>
            <input id="register-confirm" type="password" required minLength={MIN_PASSWORD} maxLength={MAX_PASSWORD} autoComplete="new-password" placeholder="Repite la contraseña" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={inputClass} />
          </div>

          <button type="submit" disabled={loading} className="flex w-full justify-center rounded-xl px-4 py-3 text-sm font-semibold btn-primary disabled:cursor-not-allowed disabled:opacity-70">
            {loading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-400">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-medium text-brand-400 hover:text-brand-300">Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}
