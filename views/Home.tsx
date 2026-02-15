
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Bell, ShieldAlert, Navigation, Package, ChevronRight, MapPin, AlertCircle } from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';
import { Order, OrderStatus } from '../types';
import { supabase } from '../services/supabaseClient';
import { setDriverOffline } from '../services/driverService';
import { detectMultiStores } from '../services/multiStoreService';

const Home: React.FC = () => {
  const [isOnline, setIsOnline] = useState(() => localStorage.getItem('vta_online') === 'true');
  const [activeMissions, setActiveMissions] = useState<any[]>([]);
  const [incomingMission, setIncomingMission] = useState<Order | null>(null);
  const [driverInfo, setDriverInfo] = useState<{ id: string, name: string, phone: string } | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const navigate = useNavigate();

  // Refs for background tracking
  const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // 2. Gestion Silencieuse du Suivi (Localisation + Session)
  useEffect(() => {
    if (isOnline && driverInfo?.id) {
      // Démarrer le suivi de localisation toutes les 10 secondes
      const startTracking = async () => {
        // Premier update immédiat
        updateLocation();

        trackingIntervalRef.current = setInterval(() => {
          updateLocation();
        }, 10000); // 10 secondes
      };

      startTracking();
    } else {
      // Arrêter le suivi si offline
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
        trackingIntervalRef.current = null;
      }
    }

    return () => {
      if (trackingIntervalRef.current) clearInterval(trackingIntervalRef.current);
    };
  }, [isOnline, driverInfo?.id]);

  const updateLocation = async () => {
    if (!driverInfo?.id) return;

    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000
      });

      if (position) {
        await supabase
          .from('drivers')
          .update({
            last_lat: position.coords.latitude,
            last_lng: position.coords.longitude
          })
          .eq('id', driverInfo.id);

        console.log("Tracking: Position mise à jour", position.coords.latitude, position.coords.longitude);
      }
    } catch (err) {
      console.error("Tracking: Erreur récupération GPS", err);
    }
  };

  // 3. Persistance du statut En Ligne (LocalStorage + Supabase)
  const toggleOnline = async (status: boolean) => {
    if (!driverInfo?.phone) return;

    setIsSyncing(true);

    try {
      if (status) {
        // --- DEMANDE DE PERMISSIONS ---
        try {
          // Permission Localisation
          const locPerm = await Geolocation.requestPermissions();
          console.log("Localisation Status:", locPerm.location);

          // Permission Caméra (Média)
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach(t => t.stop());
          console.log("Caméra Status: OK");
        } catch (perr) {
          console.warn("Permissions non accordées:", perr);
          setErrorStatus("GPS et Caméra sont indispensables pour travailler.");
        }

        // GO ONLINE: Créer une session de connexion
        const { data: sessionData } = await supabase
          .from('driver_online_sessions')
          .insert([{
            driver_id: driverInfo.id,
            driver_phone: driverInfo.phone,
            start_time: new Date().toISOString()
          }])
          .select()
          .single();

        if (sessionData) {
          localStorage.setItem('vta_session_id', sessionData.id);
        }

        // Mise à jour du statut global
        localStorage.setItem('vta_online', 'true');
        setIsOnline(true);

        await supabase
          .from('drivers')
          .update({ status: 'available' })
          .eq('phone', driverInfo.phone);
      } else {
        // GO OFFLINE: Utiliser le service centralisé
        await setDriverOffline();
        setIsOnline(false);
      }
    } catch (err) {
      console.error("Erreur toggle online:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // 4. Surveillance des commandes (Radar)
  useEffect(() => {
    if (!isOnline || !driverInfo?.phone) {
      setActiveMissions([]);
      setIncomingMission(null);
      return;
    }

    const fetchAllMissions = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, status, store_name, delivery_fee, items, assigned_driver_id, is_archived, customer_name, phone')
        .eq('is_archived', false)
        .or(`assigned_driver_id.eq.${driverInfo.id},assigned_driver_id.eq.${driverInfo.name},assigned_driver_id.eq.${driverInfo.phone},assigned_driver_id.ilike.${driverInfo.name}`);

      if (error) {
        console.error("Erreur récupération missions:", error);
        return;
      }

      if (data) {
        const myMissions = data.filter(o => {
          const status = String(o.status || "").toLowerCase();

          // 1. FILTRAGE STRICT : SEULS CES STATUTS SONT VISIBLES DANS LE RADAR
          const visibleStatuses = [
            // Pour l'affichage "Inaccessible" (Bloqué)
            'waiting', 'en attente', 'pending',
            'verification', 'vérification',

            // Pour l'affichage "Accessible" (Traitement)
            'treatment', 'at_store', 'accepted', 'traitement',
            'assigned',
            'delivering', 'progression', 'en course'
          ];

          return visibleStatuses.includes(status);
        });

        // Enrichir chaque mission avec les données multi-magasins
        const enrichedMissions = myMissions.map(mission => {
          let items = [];
          let multiStoreData = null;

          // Parser les items si disponibles
          if (mission.items) {
            try {
              items = typeof mission.items === 'string'
                ? JSON.parse(mission.items)
                : mission.items;

              if (Array.isArray(items) && items.length > 0) {
                multiStoreData = detectMultiStores(items);
              }
            } catch (e) {
              console.error('Erreur parsing items pour mission', mission.id, e);
            }
          }

          return {
            ...mission,
            items,
            multiStoreData
          };
        });

        setActiveMissions(enrichedMissions);
      }
    };

    fetchAllMissions();

    const channelId = `radar-${driverInfo.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          setTimeout(() => fetchAllMissions(), 500);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOnline, driverInfo?.id]);

  // 5. SON ET VIBRATION POUR NOUVELLES MISSIONS
  // Base64 d'un son de notification (Ding)
  const NOTIFICATION_SOUND = "data:audio/mp3;base64,//uQRAAAAWMSLwUIYAAsYkXgoQwAEaYLWfkWgAI0wWs/ItAAAG1ineAAA0gAAAB5IAGEp6Q3Zexu0qIFJ8hXzW9tJ+5X3/y//8/7/9/9/9//9//9////9//9//9//9///9////9//9//9//9/4iAAAG1ineAAA0gAAAB5IAGEp6Q3Zexu0qIFJ8hXzW9tJ+5X3/y//8/7/9/9/9//9//9////9//9//9//9///9////9//9//9//9/4iAAAG1ineAAA0gAAAB5IAGEp6Q3Zexu0qIFJ8hXzW9tJ+5X3/y//8/7/9/9/9//9//9////9//9//9//9///9////9//9//9//9/4iAAAG1ineAAA0gAAAB5IAGEp6Q3Zexu0qIFJ8hXzW9tJ+5X3/y//8/7/9/9/9//9//9////9//9//9//9///9////9//9//9//9/4iAAAG1ineAAA0gAAAB5IAGEp6Q3Zexu0qIFJ8hXzW9tJ+5X3/y//8/7/9/9/9//9//9////9//9//9//9///9////9//9//9//9/4iAAAG1ineAAA0gAAAB5IAGEp6Q3Zexu0qIFJ8hXzW9tJ+5X3/y//8/7/9/9/9//9//9////9//9//9//9///9////9//9//9//9/4iAAAG1ineAAA0gAAAB5IAGEp6Q3Zexu0qIFJ8hXzW9tJ+5X3/y//8/7/9/9/9//9//9////9//9//9//9///9////9//9//9//9/4iAAAG1ineAAA0gAAAB5IAGEp6Q3Zexu0qIFJ8hXzW9tJ+5X3/y//8/7/9/9/9//9//9////9//9//9//9///9////9//9//9//9/4iAAAG1ineAAA0gAAAB5IAGEp6Q3Zexu0qIFJ8hXzW9tJ+5X3/y//8/7/9/9/9//9//9////9//9//9//9///9////9//9//9//9/4iAAAG1ineAAA0gAAAB5IAGEp6Q3Zexu0qIFJ8hXzW9tJ+5X3/y//8/7/9/9/9//9//9////9//9//9//9///9////9//9//9//9/4iAAAG1ineAAA0gAAAB5IAGEp6Q3Zexu0qIFJ8hXzW9tJ+5X3/y//8/7/9/9/9//9//9////9//9//9//9///9////9//9//9//9/4iAAAG1ineAAA0gAAAB5IAGEp6Q3Zexu0qIFJ8hXzW9tJ+5X3/y//8/7/9/9/9//9//9////9//9//9//9///9////9//9//9//9/4iAAAG1ineAAA0gAAAB5IAGEp6Q3Zexu0qIFJ8hXzW9tJ+5X3/y//8/7/9/9/9//9//9////9//9//9//9///9////9//9//9//9/4iAAA";

  const lastMissionIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (activeMissions.length === 0) {
      lastMissionIds.current.clear();
      return;
    }

    // Identifier les nouvelles missions
    let hasNew = false;
    const currentIds = new Set(activeMissions.map(m => m.id));

    // Si on a plus de missions qu'avant ou des IDs différents
    for (const id of currentIds) {
      if (!lastMissionIds.current.has(id)) {
        hasNew = true;
        break;
      }
    }

    // Si c'est le tout premier chargement (lastMissionIds vide), on ne sonne peut-être pas pour éviter le spam,
    // SAUF si le user veut vraiment savoir ce qui est là. 
    // Généralement on évite au mount initial.
    // MAIS, si le livreur lance l'app, il veut savoir s'il a des trucs.
    // On va dire : si lastMissionIds était vide mais qu'on vient de charger, on sonne.
    // Ou alors on sonne seulement si c'est un AJOUT.

    // Logique choisie : on sonne à chaque fois qu'une NOUVELLE mission apparaît.
    // Pour éviter le spam au refresh, on pourrait vérifier si le composant vient de mounter.
    // On va utiliser un ref 'isMounted' pour le premier run.

    if (hasNew) {
      // Jouer le son
      try {
        const audio = new Audio(NOTIFICATION_SOUND);
        audio.play().catch(e => console.warn("Audio play blocked", e));

        // Vibration (si supporté)
        if (navigator.vibrate) {
          navigator.vibrate([500, 200, 500]); // Vibre-Pause-Vibre
        }
      } catch (err) {
        console.error("Erreur notification", err);
      }
    }

    // Mettre à jour la ref
    lastMissionIds.current = currentIds;

  }, [activeMissions]);

  const handleAcceptMission = async (orderId: string) => {
    setErrorStatus(null);

    // 1. D'abord vérifier le statut réel de la commande
    const { data: currentOrder } = await supabase
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .maybeSingle();

    if (currentOrder) {
      if (currentOrder) {
        const s = String(currentOrder.status).toLowerCase();
        // Bloquer l'accès si en vérification ou en attente
        if (['verification', 'vérification', 'waiting', 'en attente', 'pending'].includes(s)) {
          setErrorStatus("ACCÈS REFUSÉ : La commande est en attente ou en vérification.");
          return;
        }
      }
    }

    // 2. Tenter l'acceptation (Mise à jour vers 'treatment')
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('orders')
      .update({
        status: 'treatment',
        status_history: [{ status: 'Acceptée par Livreur', time: now }]
      })
      .eq('id', orderId);

    if (error) {
      console.error("Erreur acceptation mission:", error);
      // Message plus clair pour l'utilisateur
      if (error.message.includes('order_status')) {
        setErrorStatus(`Erreur : Le statut 'treatment' n'est pas autorisé par la base.`);
      } else {
        setErrorStatus(`Erreur DB (${error.code}) : ${error.message}`);
      }
      return;
    }
    setIncomingMission(null);
    navigate(`/mission/${orderId}`);
  };

  const getStatusLabel = (status: string) => {
    const s = String(status).toLowerCase();
    if (s === 'at_store' || s === 'traitement' || s === 'accepted' || s === 'assigned') return 'TRAITEMENT';
    if (s === 'delivering' || s === 'progression' || s === 'en course') return 'EN LIVRAISON';
    return s.toUpperCase();
  };

  return (
    <div className="min-h-screen pb-32 pt-8 px-4 flex flex-col items-center bg-[#0F172A]">
      <header className="w-full flex justify-between items-center mb-10">
        <div className="flex items-center gap-3">
          <img src="/LOGO.png" className="w-10 h-10 object-contain" alt="Logo" />
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
            {errorStatus && (
              <div className="glass bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                <ShieldAlert className="text-red-500 shrink-0 mt-0.5" size={18} />
                <div className="flex-1">
                  <p className="text-red-500 text-[10px] font-black uppercase leading-tight">{errorStatus}</p>
                  <button onClick={() => setErrorStatus(null)} className="text-[8px] text-white/50 underline mt-2 uppercase font-black">Fermer</button>
                </div>
              </div>
            )}

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
                    if (['verification', 'vérification', 'waiting', 'en attente', 'pending'].includes(s)) {
                      setErrorStatus("La commande est en attente ou en vérification.");
                      return;
                    }

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
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[7px] px-2 py-0.5 rounded-full font-black bg-white/5 text-slate-400 uppercase tracking-tighter">{getStatusLabel(mission.status)}</span>
                        <p className="text-slate-500 text-[9px] font-black uppercase truncate max-w-[100px]">{mission.store_name}</p>
                        {mission.multiStoreData?.isMultiStore && (
                          <span className="text-[7px] px-2 py-0.5 rounded-full font-black bg-blue-500/20 text-blue-400 uppercase tracking-tighter border border-blue-500/30">
                            🏪 {mission.multiStoreData.storeCount} MAGASINS
                          </span>
                        )}
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
