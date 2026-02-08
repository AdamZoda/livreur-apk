
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Clock, CheckCircle2, AlertCircle, ChevronRight, ClipboardList, Zap } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

const Missions: React.FC = () => {
    const [activeMissions, setActiveMissions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [driverInfo, setDriverInfo] = useState<{ id: string, name: string, phone: string } | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const phone = localStorage.getItem('vta_phone') || "";
        const id = localStorage.getItem('vta_driver_id') || "";
        const name = localStorage.getItem('vta_driver_name') || "";
        setDriverInfo({ id, name, phone });
    }, []);

    useEffect(() => {
        if (!driverInfo?.phone) return;

        const fetchMissions = async () => {
            setLoading(true);
            const { data } = await supabase.from('orders').select('*');

            if (data) {
                const myMissions = data.filter(o => {
                    const assignedId = String(o.assigned_driver_id || "").toLowerCase();
                    const targetName = driverInfo.name.toLowerCase();
                    const targetId = driverInfo.id.toLowerCase();
                    const targetPhone = driverInfo.phone.toLowerCase();

                    const isMine = assignedId === targetName || assignedId === targetId || assignedId === targetPhone;
                    const status = String(o.status || "").toLowerCase();
                    // On cache tout ce qui est terminé, annulé ou refusé
                    const terminalStatuses = [
                        'delivered', 'completed', 'livrée', 'terminée',
                        'refused', 'refusée', 'refusé', 'refus', 'rejected',
                        'indisponible', 'indispo', 'cancelled', 'annulée', 'annulé', 'fermé'
                    ];
                    return isMine && !terminalStatuses.includes(status);
                });

                setActiveMissions(myMissions);
            }
            setLoading(false);
        };

        fetchMissions();
        const chan = supabase.channel('missions-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchMissions).subscribe();
        return () => { supabase.removeChannel(chan); };
    }, [driverInfo]);

    const getStatusLabel = (status: string) => {
        const s = String(status).toLowerCase();
        if (s === 'at_store' || s === 'traitement') return 'TRAITEMENT';
        if (s === 'delivering' || s === 'progression') return 'PROGRESSION';
        return s.toUpperCase();
    };

    const getStatusColor = (status: string) => {
        const s = String(status).toLowerCase();
        if (s === 'at_store' || s === 'traitement') return 'bg-orange-500/10 text-orange-500';
        if (s === 'delivering' || s === 'progression') return 'bg-blue-500/10 text-blue-500';
        return 'bg-slate-500/10 text-slate-400';
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center text-white font-black bg-[#0F172A] uppercase tracking-widest">Chargement des tâches...</div>;

    return (
        <div className="pb-32 pt-10 px-6 min-h-screen bg-[#0F172A] space-y-8">
            <header className="space-y-1">
                <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Mes Missions</h1>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Tâches en cours d'exécution</p>
            </header>

            {/* Gamification / Goals Brief */}
            <div className="grid grid-cols-2 gap-4">
                <div className="glass p-5 rounded-3xl border-white/5 bg-orange-500/5">
                    <Zap size={18} className="text-orange-500 mb-2" />
                    <p className="text-[9px] font-black text-slate-500 uppercase">Présence</p>
                    <p className="text-lg font-black text-white">3.5 / 5h</p>
                </div>
                <div className="glass p-5 rounded-3xl border-white/5 bg-blue-500/5">
                    <Package size={18} className="text-blue-500 mb-2" />
                    <p className="text-[9px] font-black text-slate-500 uppercase">Volume</p>
                    <p className="text-lg font-black text-white">12 / 20</p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-center px-2">
                    <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <ClipboardList size={16} className="text-orange-500" /> Liste des Tâches
                    </h3>
                    <span className="bg-white/5 px-3 py-1 rounded-full text-white font-serif text-[10px]">{activeMissions.length}</span>
                </div>

                {activeMissions.length > 0 ? (
                    <div className="space-y-3">
                        {activeMissions.map((mission) => (
                            <div
                                key={mission.id}
                                onClick={() => navigate(`/mission/${mission.id}`)}
                                className="glass p-6 rounded-[2.5rem] border-white/5 active:scale-[0.97] transition-all cursor-pointer hover:bg-white/[0.02]"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-slate-800 rounded-2xl flex items-center justify-center border border-white/5 text-slate-400">
                                            <Package size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-white text-sm uppercase tracking-tight">Mission #{mission.id}</h4>
                                            <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter ${getStatusColor(mission.status)}`}>
                                                {getStatusLabel(mission.status)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-orange-500 font-black text-lg tracking-tighter">{mission.delivery_fee} <small className="text-[10px]">DH</small></p>
                                    </div>
                                </div>

                                <div className="space-y-3 border-t border-white/5 pt-4 mt-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-600"></div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase truncate">DE: {mission.store_name}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                                        <p className="text-[10px] font-black text-white uppercase truncate">VERS: {mission.customer_name}</p>
                                    </div>
                                </div>

                                <div className="mt-5 flex justify-end">
                                    <div className="flex items-center gap-1 text-[9px] font-black text-orange-500 uppercase tracking-widest">
                                        Ouvrir la mission <ChevronRight size={14} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="glass p-16 rounded-[3rem] border-dashed border-2 border-white/5 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 bg-slate-900 rounded-[2rem] flex items-center justify-center mb-4 text-slate-700">
                            <ClipboardList size={32} />
                        </div>
                        <p className="text-slate-500 font-black text-[10px] uppercase tracking-widest leading-relaxed">Aucune mission en cours.<br />Vérifiez le Radar pour de nouvelles tâches.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Missions;
