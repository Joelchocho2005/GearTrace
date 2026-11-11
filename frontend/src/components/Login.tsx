import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../api/errors';
import { authApi } from '../api/resources';
import { useAuth } from '../contexts/AuthContext';

/** Las cuentas de demostración (prisma/seed.ts) solo se anuncian en desarrollo. */
const SHOW_DEMO_HINT = import.meta.env.DEV;

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      const { accessToken, user } = await authApi.login({ email: email.trim(), password });
      toast.success(`Bienvenido, ${user.name}`);
      login(accessToken, user);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error al iniciar sesión'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Elemento de diseño de fondo (glow) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-500 rounded-full blur-[128px] opacity-20 pointer-events-none"></div>

      <div className="glass-strong max-w-md w-full space-y-8 p-10 rounded-2xl shadow-2xl relative z-10">
        <div>
          <div className="icon-badge mx-auto h-16 w-16 flex items-center justify-center rounded-2xl">
            <Wrench size={32} strokeWidth={2.5} />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            GearTrace
          </h2>
          <p className="mt-2 text-center text-sm text-slate-400">
            Sistema de Gestión Logística Inteligente
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label htmlFor="email-address" className="sr-only">Correo electrónico</label>
              <input
                id="email-address"
                name="email"
                type="email"
                required
                className="appearance-none rounded-xl relative block w-full px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:z-10 sm:text-sm transition-all glass-input"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Contraseña</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-xl relative block w-full px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:z-10 sm:text-sm transition-all glass-input"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 text-sm font-semibold rounded-xl btn-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 focus:ring-offset-slate-900 transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(234,88,12,0.4)] hover:shadow-[0_0_25px_rgba(249,115,22,0.6)]"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </div>
          
          <p className="text-center text-sm text-slate-400">
            ¿Eres cliente y no tienes cuenta?{' '}
            <Link to="/registro" className="font-medium text-brand-400 hover:text-brand-300">Regístrate</Link>
          </p>

          {SHOW_DEMO_HINT && (
            <p className="text-center text-xs text-slate-500 mt-4">
              Desarrollo: usa las cuentas de demostración creadas por <code>npm run prisma:seed</code>.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
