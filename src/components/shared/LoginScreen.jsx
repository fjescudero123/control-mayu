import React from 'react';
import { AlertCircle, User, Lock } from 'lucide-react';
import MayuLogo from '../ui/MayuLogo';

export default function LoginScreen({ loginForm, setLoginForm, loginError, onLogin }) {
  return (
    <div className="min-h-screen bg-[#F3F4EF] flex items-center justify-center p-4 font-sans text-slate-800">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-fade-in border border-slate-200">

        <div className="h-2 w-full flex">
          <div className="flex-1 bg-[#DCA75D]"></div>
          <div className="flex-1 bg-[#788A87]"></div>
          <div className="flex-1 bg-[#DCDDDF]"></div>
          <div className="flex-1 bg-[#899264]"></div>
        </div>

        <div className="pt-10 pb-6 px-8 text-center bg-white">
          <MayuLogo className="h-24 w-auto mx-auto mb-4 drop-shadow-sm" />
          <p className="text-[#788A87] text-xs font-bold tracking-widest uppercase">Plataforma Pre-Ejecución</p>
        </div>

        <div className="px-8 pb-8">
          {loginError && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 flex items-center gap-2 border border-red-200">
              <AlertCircle size={16} /> {loginError}
            </div>
          )}
          <form onSubmit={onLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#788A87] mb-1">Usuario</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User size={18} className="text-slate-400" />
                </div>
                <input
                  type="text"
                  required
                  className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#899264] focus:border-transparent transition-shadow"
                  placeholder="Ej: fjescudero, jquevedo..."
                  value={loginForm.username}
                  onChange={e => setLoginForm({...loginForm, username: e.target.value})}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#788A87] mb-1">Contraseña</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className="text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#899264] focus:border-transparent transition-shadow"
                  placeholder="Tu clave personal"
                  value={loginForm.password}
                  onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                />
              </div>
            </div>
            <button type="submit" className="w-full bg-[#899264] text-white py-3 rounded-lg font-bold hover:bg-[#788253] transition-colors shadow-md mt-6">
              Ingresar al Sistema
            </button>
          </form>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
      `}} />
    </div>
  );
}
