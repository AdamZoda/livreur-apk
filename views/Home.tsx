
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Bell, ShieldAlert, Navigation, Package, ChevronRight, MapPin, AlertCircle } from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { supabase } from '../services/supabaseClient';

const Home: React.FC = () => {
  const [isOnline, setIsOnline] = useState(() => localStorage.getItem('vta_online') === 'true');
  const [activeMissions, setActiveMissions] = useState<any[]>([]);
  const [incomingMission, setIncomingMission] = useState<Order | null>(null);
  const [driverInfo, setDriverInfo] = useState<{ id: string, name: string, phone: string } | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const navigate = useNavigate();

  // 1. Charger les infos du livreur
  useEffect(() => {
    const loadDriver = async () => {
      const phone = localStorage.getItem('vta_phone') || "";
      let id = localStorage.getItem('vta_driver_id') || "";
      let name = localStorage.getItem('vta_driver_name') || "";

      if (phone && (!id || !name)) {
        const { data } = await supabase.from('drivers').select('*').eq('phone', phone).maybeSingle();
        if (data) {
          id = data.id;
          name = data.full_name;
          localStorage.setItem('vta_driver_id', id);
          localStorage.setItem('vta_driver_name', name);
        }
      }
      setDriverInfo({ id, name, phone });
    };
    loadDriver();
  }, []);

  // 2. Persistance du statut En Ligne (LocalStorage + Supabase)
  const toggleOnline = async (status: boolean) => {
    if (!driverInfo?.phone) return;

    setIsSyncing(true);
    // On met à jour LocalStorage pour que ça reste même après un refresh
    localStorage.setItem('vta_online', status ? 'true' : 'false');
    setIsOnline(status);

    // On met à jour la base de donnée pour que l'admin et le profil voient le changement
    await supabase
      .from('drivers')
      .update({ status: status ? 'available' : 'offline' })
      .eq('phone', driverInfo.phone);

    setIsSyncing(false);
  };

  // 3. Surveillance des commandes (Radar)
  useEffect(() => {
    if (!isOnline || !driverInfo?.phone) {
      setActiveMissions([]);
      setIncomingMission(null);
      return;
    }

    const fetchAllMissions = async () => {
      // OPTIMISATION : On ne récupère que les missions assignées au livreur (ID, Nom ou Téléphone)
      // Cela évite de télécharger toute la base de données inutilement
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('is_archived', false)
        .or(`assigned_driver_id.eq.${driverInfo.id},assigned_driver_id.eq.${driverInfo.name},assigned_driver_id.eq.${driverInfo.phone},assigned_driver_id.ilike.${driverInfo.name}`);

      if (error) {
        console.error("Erreur récupération missions:", error);
        return;
      }

      if (data) {
        // Le filtrage côté serveur a déjà fait le gros du travail
        // On garde quand même le filtre de statut pour exclure les terminés/annulés de l'affichage "Actif"
        const myMissions = data.filter(o => {
          const status = String(o.status || "").toLowerCase();
          const terminalStatuses = [
            'delivered', 'completed', 'livrée', 'terminée',
            'refused', 'refusée', 'refusé', 'refus', 'rejected', 'refuse',
            'indisponible', 'indispo', 'indisponibe', 'cancelled', 'annulée', 'annulé', 'fermé'
          ];
          const isTerminal = terminalStatuses.includes(status);

          return !isTerminal;
        });

        setActiveMissions(myMissions);
      }
    };

    fetchAllMissions();

    // ABONNEMENT TEMPS RÉEL OPTIMISÉ
    const channelId = `radar-${driverInfo.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          // On écoute tout changement sur la table orders, mais le fetchAllMissions filtrera
          // Idéalement on filtrerait ici aussi, mais les filtres realtime sont limités
        },
        (payload) => {
          console.log("Radar Realtime Update:", payload);
          // Petite latence pour laisser le temps à la DB de propager si besoin
          setTimeout(() => fetchAllMissions(), 500);
        }
      )
      .subscribe((status, err) => {
        if (err) console.error("Realtime Subscription Error:", err);
        console.log("Radar Subscription Status:", status);
      });

    return () => {
      console.log("Cleaning up Radar subscription...");
      supabase.removeChannel(channel);
    };
  }, [isOnline, driverInfo?.id]); // On surveille l'id pour la stabilité

  const handleAcceptMission = async (orderId: string) => {
    setErrorStatus(null);
    const { error } = await supabase
      .from('orders')
      .update({ status: OrderStatus.AT_STORE })
      .eq('id', orderId);

    if (error) {
      console.error("Erreur acceptation mission:", error);
      setErrorStatus(`Erreur DB (${error.code}) : ${error.message}`);
      return;
    }
    setIncomingMission(null);
    navigate(`/mission/${orderId}`);
  };

  const getStatusLabel = (status: string) => {
    const s = String(status).toLowerCase();
    if (s === 'at_store' || s === 'traitement' || s === 'accepted') return 'TRAITEMENT';
    if (s === 'delivering' || s === 'progression' || s === 'picked_up') return 'PROGRESSION';
    return s.toUpperCase();
  };

  return (
    <div className="min-h-screen pb-32 pt-8 px-4 flex flex-col items-center bg-[#0F172A]">
      <header className="w-full flex justify-between items-center mb-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center font-black shadow-lg">V</div>
          <div>
            <h1 className="text-xl font-black text-white leading-none tracking-tighter italic font-serif">VEETAA</h1>
            <p className="text-orange-500 text-[9px] font-black uppercase tracking-[0.2em]">Dispatcher</p>
          </div>
        </div>
        <div className="flex items-center gap-3 glass px-4 py-2 rounded-full border border-white/5">
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="text-[10px] font-black uppercase text-white tracking-widest">{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
        </div>
      </header>

      {!isOnline ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-8 text-center px-6">
          <div className="w-24 h-24 bg-slate-900 rounded-[2rem] flex items-center justify-center border border-white/5 shadow-2xl">
            <Zap className="text-slate-700" size={40} />
          </div>
          <button
            disabled={isSyncing}
            onClick={() => toggleOnline(true)}
            className="bg-orange-500 text-white font-black px-12 py-5 rounded-3xl shadow-[0_20px_40px_rgba(249,115,22,0.3)] text-lg uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
          >
            {isSyncing ? "CONNEXION..." : "Activer le Radar"}
          </button>
        </div>
      ) : (
        <div className="w-full flex flex-col gap-8">
          <div className="w-full flex flex-col items-center justify-center py-6">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-orange-500/20 rounded-full animate-ping duration-[2500ms]"></div>
              <div className="relative w-28 h-28 bg-orange-500/5 rounded-full flex items-center justify-center border border-white/5">
                <Bell className="text-orange-500 animate-bounce" size={32} />
              </div>
            </div>
            <h2 className="text-white font-black text-lg tracking-tight uppercase">Recherche en cours...</h2>
            <p className="text-slate-600 text-[9px] font-black uppercase tracking-[0.4em] mt-1 italic">{driverInfo?.name || 'SYNC...'}</p>
          </div>

          <div className="w-full space-y-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-2 flex justify-between items-center">
              <span>Missions Actives</span>
              <span className="bg-white/5 px-2 py-0.5 rounded text-white font-serif">{activeMissions.length}</span>
            </h3>

            <div className="grid grid-cols-1 gap-3">
              {activeMissions.length > 0 ? activeMissions.map((mission) => (
                <div
                  key={mission.id}
                  onClick={() => {
                    const s = String(mission.status).toLowerCase();
                    if (['assigned', 'pending', 'en attente', 'waiting'].includes(s)) {
                      handleAcceptMission(mission.id);
                    } else {
                      navigate(`/mission/${mission.id}`);
                    }
                  }}
                  className="glass p-5 rounded-[2rem] border-white/5 flex justify-between items-center active:scale-[0.98] transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center"><Package size={22} /></div>
                    <div className="space-y-1">
                      <h4 className="font-black text-white text-[11px] uppercase tracking-tight">MISSION #{mission.id}</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-[7px] px-2 py-0.5 rounded-full font-black bg-white/5 text-slate-400 uppercase tracking-tighter">{getStatusLabel(mission.status)}</span>
                        <p className="text-slate-500 text-[9px] font-black uppercase truncate max-w-[100px]">{mission.store_name}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-white text-lg tracking-tighter">{mission.delivery_fee}<small className="text-[9px] ml-0.5">DH</small></p>
                  </div>
                </div>
              )) : (
                <div className="glass p-12 rounded-[2rem] border-white/5 border-dashed border-2 flex flex-col items-center justify-center text-center opacity-30">
                  <p className="text-slate-500 font-black text-[9px] uppercase tracking-widest">Aucune course à proximité</p>
                </div>
              )}
            </div>
          </div>

          <button
            disabled={isSyncing}
            onClick={() => toggleOnline(false)}
            className="w-full py-5 rounded-3xl bg-white/5 border border-white/10 text-slate-500 font-black text-[10px] uppercase tracking-[0.3em] mt-4 active:scale-95 transition-all disabled:opacity-50"
          >
            {isSyncing ? "DÉCONNEXION..." : "Passer hors ligne"}
          </button>
        </div>
      )}

    </div>
  );
};

export default Home;
