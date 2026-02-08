
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Smartphone, Lock, ArrowRight, Upload, Camera, CheckCircle, User, CreditCard } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

const Auth: React.FC = () => {
  const [step, setStep] = useState(1); // 1: Login, 2: Document Upload
  const [fullName, setFullName] = useState('');
  const [idCardNumber, setIdCardNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docs, setDocs] = useState({ cin: false, permis: false, assurance: false });
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Check if driver exists with full_name and id_card_number
    // Note: In the provided SQL, id_card_number is a text column in drivers table
    const { data, error: sbError } = await supabase
      .from('drivers')
      .select('*')
      .eq('full_name', fullName)
      .eq('id_card_number', idCardNumber)
      .maybeSingle();

    if (data) {
      localStorage.setItem('vta_auth', 'true');
      localStorage.setItem('vta_driver_id', data.id); // L'ID unique du livreur
      localStorage.setItem('vta_phone', data.phone); // We still need the phone for real-time order tracking
      localStorage.setItem('vta_driver_name', data.full_name);
      navigate('/');
    } else {
      setError("Identifiants incorrects. Veuillez vérifier votre nom et numéro CIN.");
    }
    setLoading(false);
  };

  const toggleDoc = (doc: keyof typeof docs) => {
    setDocs({ ...docs, [doc]: !docs[doc] });
  };

  const allDocsDone = docs.cin && docs.permis && docs.assurance;

  if (step === 1) {
    return (
      <div className="min-h-screen flex flex-col p-8 justify-center space-y-12 bg-[#0F172A]">
        <div className="space-y-2 text-center">
          <h1 className="text-4xl font-black tracking-tighter text-white">VEETAA</h1>
          <p className="text-orange-500 font-bold uppercase tracking-[0.2em] text-sm">Driver Terminal</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            <div className="relative">
              <User className="absolute left-4 top-4 text-slate-500" size={20} />
              <input
                type="text"
                placeholder="Nom complet"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:border-orange-500 outline-none transition-all font-semibold"
                required
              />
            </div>
            <div className="relative">
              <CreditCard className="absolute left-4 top-4 text-slate-500" size={20} />
              <input
                type="password"
                placeholder="Numéro CIN (Mot de passe)"
                value={idCardNumber}
                onChange={(e) => setIdCardNumber(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:border-orange-500 outline-none transition-all font-semibold"
                required
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-500 text-xs font-bold text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 text-white font-black py-4 rounded-2xl shadow-[0_10px_40px_rgba(249,115,22,0.3)] flex items-center justify-center gap-2 group transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? "CONNEXION..." : "SE CONNECTER"}
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>

          <p className="text-center text-slate-500 text-sm font-medium">
            Accès réservé aux livreurs enregistrés par l'administration.
          </p>
        </form>
      </div>
    );
  }

  // Fallback if step 2 is ever reached (though login now requires existing driver)
  return (
    <div className="min-h-screen p-8 flex flex-col items-center justify-center bg-[#0F172A]">
      <p className="text-white">Redirection en cours...</p>
    </div>
  );
};

export default Auth;
