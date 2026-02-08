
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, Phone, CreditCard, Shield, Package, Trash2, Zap } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

const Profile: React.FC = () => {
    const navigate = useNavigate();
    const [driver, setDriver] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const driverPhone = localStorage.getItem('vta_phone');

    useEffect(() => {
        const fetchDriverData = async () => {
            if (!driverPhone) {
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('drivers')
                .select('*')
                .eq('phone', driverPhone)
                .maybeSingle();

            if (data) {
                setDriver(data);
            }
            setLoading(false);
        };

        fetchDriverData();
    }, [driverPhone]);

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-white bg-[#0F172A] font-bold">
                CHARGEMENT DU PROFIL...
            </div>
        );
    }

    if (!driver) {
        return (
            <div className="min-h-screen p-8 text-center space-y-4 flex flex-col items-center justify-center bg-[#0F172A]">
                <Shield size={48} className="text-slate-700" />
                <p className="text-slate-400">Session expirée ou profil introuvable.</p>
                <button onClick={handleLogout} className="bg-orange-500 text-white px-6 py-2 rounded-xl font-bold">Retour Connexion</button>
            </div>
        );
    }

    return (
        <div className="pb-32 pt-10 px-6 min-h-screen bg-[#0F172A] space-y-8">
            {/* Profil Header */}
            <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                    <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center border-4 border-slate-900 shadow-2xl overflow-hidden">
                        {driver.profile_photo ? (
                            <img src={driver.profile_photo} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <User size={40} className="text-slate-600" />
                        )}
                    </div>
                    <div className={`absolute bottom-1 right-1 w-6 h-6 border-4 border-[#0F172A] rounded-full ${driver.status === 'available' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                </div>
                <div className="text-center">
                    <h2 className="text-2xl font-black text-white uppercase tracking-tight">{driver.full_name}</h2>
                    <div className="flex items-center justify-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${driver.status === 'available' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                        <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">
                            {driver.status === 'available' ? 'Actuellement en ligne' : 'Actuellement hors ligne'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Info Cards */}
            <div className="space-y-3">
                <div className="glass p-5 rounded-3xl border-white/10 flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-500/10 rounded-2xl flex items-center justify-center text-slate-400">
                        <Shield size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">ID Livreur</p>
                        <p className="font-mono text-[10px] font-bold text-white opacity-60">{driver.id}</p>
                    </div>
                </div>

                <div className="glass p-5 rounded-3xl border-white/10 flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-500">
                        <Phone size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Contact</p>
                        <p className="font-bold text-white">{driver.phone}</p>
                    </div>
                </div>

                <div className="glass p-5 rounded-3xl border-white/10 flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500">
                        <CreditCard size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Numéro CIN</p>
                        <p className="font-bold text-white">{driver.id_card_number || 'Non renseigné'}</p>
                    </div>
                </div>

                <div className="glass p-5 rounded-3xl border-white/10 flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center text-green-500">
                        <Package size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Livraisons</p>
                        <p className="font-bold text-white">{driver.delivery_count} Missions</p>
                    </div>
                </div>

                <div className={`glass p-5 rounded-3xl border-white/10 flex items-center gap-4 ${driver.warns > 0 ? 'bg-red-500/5' : ''}`}>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${driver.warns > 0 ? 'bg-red-500/10 text-red-500' : 'bg-slate-500/10 text-slate-500'}`}>
                        <Shield size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Avertissements (Warns)</p>
                        <p className={`font-bold ${driver.warns > 0 ? 'text-red-500' : 'text-white'}`}>{driver.warns} Signalement{driver.warns > 1 ? 's' : ''}</p>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="space-y-4 pt-4">
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-3 bg-red-500/10 text-red-500 py-5 rounded-3xl font-black text-sm border border-red-500/20 active:scale-95 transition-all"
                >
                    <LogOut size={20} />
                    DÉCONNEXION
                </button>

                <p className="text-center text-slate-600 text-[10px] font-bold uppercase tracking-widest">Veetaa Driver v1.0.5</p>
            </div>
        </div>
    );
};

export default Profile;
