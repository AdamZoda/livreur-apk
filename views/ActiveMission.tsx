
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Navigation,
  Phone,
  Store,
  User,
  Info,
  ZoomIn,
  Package,
  Wallet,
  Clock,
  Image as ImageIcon,
  AlertCircle,
  QrCode,
  Zap,
  X,
  Map,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { supabase } from '../services/supabaseClient';
import * as CapGeo from '@capacitor/geolocation';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import { analyzeOrder, generateMultiStoreRoute } from '../services/multiStoreService';

const ActiveMission: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [showImageZoom, setShowImageZoom] = useState<{ url: string, title: string } | null>(null);
  const [showTextDetail, setShowTextDetail] = useState<{ title: string, note?: string } | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isRejected, setIsRejected] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const toggleFacingMode = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      await scannerRef.current.stop();
    }
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const handleReportProblem = () => {
    navigate('/support', {
      state: {
        orderId: id,
        preFill: `PROBLÈME SIGNALÉ : Commande #${id}\n`
      }
    });
  };

  // 1. Demande de permissions globales au chargement
  useEffect(() => {
    const requestPermissions = async () => {
      try {
        // Permission Localisation
        await CapGeo.Geolocation.requestPermissions();
        // Permission Caméra
        await navigator.mediaDevices.getUserMedia({ video: true })
          .then(stream => stream.getTracks().forEach(t => t.stop()));
      } catch (err) {
        console.warn("Certaines permissions ont été refusées:", err);
      }
    };
    requestPermissions();
  }, []);

  const formatBase64 = (str: string | null) => {
    if (!str) return null;
    if (str.startsWith('data:image')) return str;
    return `data:image/png;base64,${str}`;
  };

  useEffect(() => {
    const fetchOrder = async () => {
      if (!id) return;
      setLoading(true);
      const { data } = await supabase.from('orders').select('*').eq('id', id).maybeSingle();

      if (data) {
        const s = String(data.status).toLowerCase();
        const terminalStatuses = [
          'refused', 'refusée', 'refusé', 'refus', 'rejected', 'refuse',
          'indisponible', 'indispo', 'indisponibe', 'cancelled', 'annulée', 'annulé', 'fermé',
          'delivered', 'livrée', 'completed'
        ];

        // Si la commande est déjà annulée/refusée avant d'ouvrir, on dégage
        if (terminalStatuses.includes(s)) {
          navigate('/mission');
          return;
        }

        // Parser les items
        let parsedItems: any[] = [];
        if (data.items) {
          try {
            parsedItems = typeof data.items === 'string' ? JSON.parse(data.items) : data.items;
            parsedItems = Array.isArray(parsedItems) ? parsedItems : [];
          } catch (e) {
            console.error('Erreur parsing items:', e);
            parsedItems = [];
          }
        }

        // Analyser et enrichir avec les données multi-magasins
        const multiStoreData = await analyzeOrder(data);

        setOrder({
          ...data,
          prescriptionImageUrl: formatBase64(data.prescription_base64),
          receiptImageUrl: formatBase64(data.payment_receipt_base64),
          items: parsedItems,
          multiStoreData
        });

        setItems(parsedItems);

        if (['at_store', 'traitement', 'assigned', 'pending', 'waiting'].includes(s)) setCurrentStep(1);
        else if (s === 'delivering' || s === 'progression' || s === 'picked_up') setCurrentStep(2);
        else if (s === 'delivered' || s === 'livrée' || s === 'completed') setCurrentStep(3);
        else setCurrentStep(1);
      }
      setLoading(false);
    };

    fetchOrder();

    // ABONNEMENT TEMPS RÉEL : Si l'admin refuse la commande pendant que le livreur regarde
    const channelId = `order-watch-${id}-${Date.now()}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        (payload) => {
          console.log("Active Mission Update:", payload);
          const newStatus = String(payload.new.status).toLowerCase();

          // Mise à jour locale immédiate de l'ordre pour éviter le décalage
          setOrder((prev: any) => ({ ...prev, ...payload.new }));

          const terminalStatuses = [
            'refused', 'refusée', 'refusé', 'refus', 'rejected', 'refuse',
            'indisponible', 'indispo', 'indisponibe', 'cancelled', 'annulée', 'annulé', 'fermé'
          ];
          const successStatuses = ['delivered', 'livrée', 'completed'];

          if (terminalStatuses.includes(newStatus)) {
            setIsRejected(true);
          } else if (successStatuses.includes(newStatus)) {
            // Si c'est livré par l'admin, on quitte juste la page proprement
            setTimeout(() => navigate('/mission'), 1500);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, navigate]);

  // Si rejeté, on redirige après 3 secondes
  useEffect(() => {
    if (isRejected) {
      const timer = setTimeout(() => {
        navigate('/mission');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isRejected, navigate]);

  // Action de passage à l'étape suivante (mise à jour DB)
  const performStatusUpdate = async (nextStatusDB: string, label: string) => {
    if (!order) return false;

    // Mise à jour de l'historique
    const newHistory = [...(order.status_history || []), {
      status: label,
      time: new Date().toISOString()
    }];

    const { data, error } = await supabase
      .from('orders')
      .update({
        status: nextStatusDB,
        status_history: newHistory
      })
      .eq('id', id)
      .select();

    if (error) {
      console.error("Erreur statut:", error);
      // Fallback au cas où le champ status_history ne supporte pas l'append direct
      const { data: retryData, error: retryError } = await supabase
        .from('orders')
        .update({ status: nextStatusDB })
        .eq('id', id)
        .select();

      if (!retryError && retryData) {
        setOrder((prev: any) => ({ ...prev, status: nextStatusDB }));
        setCurrentStep(currentStep + 1);
        return true;
      }
      setUpdateError(`Erreur (${error.code}) : ${error.message}.`);
      return false;
    }

    setOrder((prev: any) => ({ ...prev, status: nextStatusDB, status_history: newHistory }));
    setCurrentStep(currentStep + 1);
    return true;
  };

  const handleNextStep = async () => {
    setUpdateError(null);

    if (currentStep === 1) {
      // Étape 1 : Passer en progression (Utilisation de l'Enum OrderStatus)
      await performStatusUpdate(OrderStatus.DELIVERING, 'PROGRESSION');
    }
    else if (currentStep === 2) {
      // Étape 2 : SCAN QR CODE SANS BOUTONS INTERMÉDIAIRES
      setIsScannerOpen(true);
    }
    else {
      navigate('/');
    }
  };

  // QR SCANNER LOGIC (Auto-Start et Maintien ouvert)
  useEffect(() => {
    let isMounted = true;

    const startScanner = async () => {
      if (!isScannerOpen || !order?.id) return;

      const html5QrCode = new Html5Qrcode("reader");
      scannerRef.current = html5QrCode;

      try {
        await html5QrCode.start(
          { facingMode: facingMode },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decodedText) => {
            const cleanText = decodedText.trim().toUpperCase();
            const expectedMessage = `CONFIRM-ORDER-ID-${order.id}`;

            if (cleanText === expectedMessage) {
              if (scannerRef.current && scannerRef.current.isScanning) {
                await scannerRef.current.stop();
                scannerRef.current = null;
              }
              if (isMounted) {
                setIsScannerOpen(false);
                const success = await performStatusUpdate(OrderStatus.COMPLETED, 'LIVRÉE');
                if (success) {
                  const driverId = localStorage.getItem('vta_driver_id');
                  if (driverId) {
                    const { data: dData } = await supabase.from('drivers').select('delivery_count').eq('id', driverId).single();
                    const newCount = (dData?.delivery_count || 0) + 1;
                    await supabase.from('drivers').update({ delivery_count: newCount }).eq('id', driverId);
                  }
                }
              }
            }
          },
          () => { } // Silent scan failures
        );
      } catch (err) {
        console.error("Scanner Error:", err);
        if (isMounted) {
          setUpdateError("Erreur caméra ou scanner.");
          setIsScannerOpen(false);
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(e => console.warn(e));
      }
    };
  }, [isScannerOpen, order?.id, facingMode]);

  const handleNavigate = (address: string, lat?: number, lng?: number) => {
    if (lat && lng) {
      // Navigation précise par coordonnées GPS (X, Y)
      window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
    } else {
      // Navigation classique par nom d'adresse
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-white font-black bg-[#0F172A] uppercase tracking-widest">Sécurisation...</div>;
  if (!order) return <div className="min-h-screen flex items-center justify-center text-white font-black bg-[#0F172A]">ORDRE INTROUVABLE</div>;

  if (isRejected) {
    return (
      <div className="fixed inset-0 z-[500] bg-red-600 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
        <div className="w-24 h-24 bg-white/20 rounded-[2rem] flex items-center justify-center mb-8 animate-bounce">
          <X size={48} className="text-white" />
        </div>
        <h1 className="text-4xl font-black text-white uppercase tracking-tighter mb-4">Mission <br />Rejetée</h1>
        <p className="text-white/80 font-black uppercase text-xs tracking-widest leading-loose">
          Cette commande a été annulée ou refusée.<br />Redirection immédiate...
        </p>
        <div className="mt-12 w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="pb-32 pt-6 px-4 min-h-screen bg-[#0F172A]">
      <header className="flex justify-between items-start mb-6 px-2">
        <div className="space-y-1">
          <h2 className="text-xl font-black uppercase tracking-tighter text-white font-serif italic">Mission <span className="text-orange-500">#{order.id}</span></h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">
            <Clock size={10} className="inline mr-1 mb-0.5" />
            {order.created_at ? new Date(order.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Heure inconnue'}
          </p>
        </div>
        <div className="bg-orange-500/10 text-orange-500 px-4 py-1.5 rounded-full text-[9px] font-black border border-orange-500/20 uppercase tracking-widest text-center min-w-[100px]">
          {currentStep === 1 ? 'TRAITEMENT' : currentStep === 2 ? 'PROGRESSION' : 'LIVRÉE'}
        </div>
      </header>


      {/* Progress Stepper */}
      <div className="flex justify-between mb-10 px-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex flex-col items-center gap-2 flex-1 relative">
            {s < 3 && <div className={`absolute top-5 left-1/2 w-full h-[2px] ${currentStep > s ? 'bg-orange-500' : 'bg-slate-800'}`}></div>}
            <div className={`z-10 w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 transition-all ${currentStep >= s ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/10' : 'bg-slate-900 border-slate-700 text-slate-600'}`}>
              {currentStep > s ? <CheckCircle2 size={18} /> : s}
            </div>
            <span className={`text-[7px] font-black uppercase tracking-tighter ${currentStep >= s ? 'text-white' : 'text-slate-600'}`}>
              {s === 1 ? 'Traitement' : s === 2 ? 'Progression' : 'Livrée'}
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        {updateError && (
          <div className="glass bg-red-500/20 border border-red-500/30 p-4 rounded-2xl flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-red-500 shrink-0" size={20} />
              <p className="text-red-500 text-[10px] font-black uppercase leading-tight flex-1">{updateError}</p>
            </div>
            {updateError.includes("caméra") && (
              <button
                onClick={handleNextStep}
                className="bg-red-500 text-white text-[9px] font-black py-2 px-4 rounded-xl uppercase tracking-widest active:scale-95 transition-all self-end"
              >
                Réessayer l'accès
              </button>
            )}
          </div>
        )}

        {/* Finances et Paiement */}
        <div className="grid grid-cols-1 gap-4">
          <div className="glass p-6 rounded-[2.5rem] border-white/10 bg-gradient-to-br from-orange-500/10 to-transparent relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-10"><Wallet size={80} /></div>
            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mb-4 flex items-center gap-2">
              <Zap size={14} className="text-orange-500" /> Résumé Financier
            </h3>

            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Articles</span>
                <span className="text-lg font-black text-white">
                  {order.multiStoreData?.storeGroups?.reduce((acc: number, g: any) => acc + (g.totalPrice || 0), 0) || order.total_products || 0}
                  <small className="text-[10px] ml-1">Dh</small>
                </span>
              </div>
              <div className="flex flex-col border-x border-white/5 px-4">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Service</span>
                <span className="text-lg font-black text-white">
                  {order.delivery_fee || 15}
                  <small className="text-[10px] ml-1">Dh</small>
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[8px] font-black text-orange-500 uppercase tracking-widest">A ENCAISSER</span>
                <span className="text-2xl font-black text-orange-500">
                  {order.total_final || ((order.total_products || 0) + (order.delivery_fee || 15))}
                  <small className="text-xs ml-1">Dh</small>
                </span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${order.payment_method === 'cash' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                <span className="text-[10px] font-black text-white uppercase tracking-widest">
                  Paiement: {order.payment_method === 'cash' ? 'CASH (ESPÈCES)' : 'VIREMENT / TRANSFERT'}
                </span>
              </div>
              {order.payment_method === 'transfer' && order.rib && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(order.rib || '');
                    alert('RIB copié !');
                  }}
                  className="text-[9px] font-black text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20 uppercase active:scale-95 transition-all"
                >
                  Copier RIB
                </button>
              )}
            </div>

            {order.payment_method === 'transfer' && order.rib && (
              <div className="mt-3 p-3 bg-blue-500/5 rounded-xl border border-blue-500/10">
                <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-1">RIB pour virement :</p>
                <p className="text-[11px] text-blue-400 font-mono font-bold break-all uppercase">{order.rib}</p>
              </div>
            )}
          </div>
        </div>

        {/* Note de Livraison */}
        {order.text_order_notes && (
          <div className="glass p-6 rounded-[2.5rem] border-white/5 bg-blue-500/5">
            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mb-2 flex items-center gap-2">
              <Info size={14} className="text-blue-500" /> Instructions de Livraison
            </h3>
            <p className="text-sm text-white font-medium italic leading-relaxed">"{order.text_order_notes}"</p>
          </div>
        )}

        {/* Itinéraire de Mission */}
        <div className="glass p-6 rounded-[2.5rem] border-white/5 space-y-6 bg-gradient-to-b from-white/5 to-transparent">
          <div className="flex justify-between items-center mb-2 px-1">
            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Étapes de livraison</h3>
            {order.multiStoreData?.isMultiStore && (
              <button
                onClick={() => {
                  const url = generateMultiStoreRoute(
                    order.multiStoreData.storeGroups,
                    order.delivery_lat,
                    order.delivery_lng
                  );
                  if (url) window.open(url, '_blank');
                }}
                className="flex items-center gap-2 text-[9px] font-black text-orange-500 bg-orange-500/10 px-3 py-1.5 rounded-full border border-orange-500/20 uppercase animate-pulse"
              >
                <Map size={12} /> Itinéraire Global
              </button>
            )}
          </div>

          {/* Points de Collecte (Magasins) */}
          {order.multiStoreData?.isMultiStore ? (
            order.multiStoreData.storeGroups.map((group: any, idx: number) => (
              <div key={idx} className="flex items-start gap-4 p-1">
                <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex flex-col items-center justify-center text-orange-500 shadow-inner relative">
                  <Store size={18} />
                  <span className="text-[8px] font-black absolute -top-1 -right-1 bg-orange-500 text-white w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#0F172A]">{idx + 1}</span>
                </div>
                <div className="flex-1">
                  <h4 className="text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Collecte {idx + 1}</h4>
                  <p className="font-black text-white text-sm uppercase leading-tight line-clamp-2">{group.storeName}</p>
                </div>
                <button
                  onClick={() => handleNavigate(
                    group.storeName,
                    group.storeInfo?.lat,
                    group.storeInfo?.lng
                  )}
                  className="p-4 bg-slate-800 rounded-2xl text-white active:scale-90 transition-transform shadow-lg"
                >
                  <Navigation size={18} />
                </button>
              </div>
            ))
          ) : (
            <div className="flex items-start gap-4 p-1">
              <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-500 shadow-inner"><Store size={22} /></div>
              <div className="flex-1">
                <h4 className="text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Point A (Magasin)</h4>
                <p className="font-black text-white text-sm uppercase">{order.store_name}</p>
              </div>
              <button onClick={() => handleNavigate(order.store_name)} className="p-4 bg-slate-800 rounded-2xl text-white active:scale-90 transition-transform"><Navigation size={18} /></button>
            </div>
          )}

          {/* Point Final (Client) */}
          <div className="flex items-start gap-4 p-1 border-t border-white/5 pt-6">
            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 shadow-inner bg-gradient-to-br from-blue-500/20 to-transparent"><User size={22} /></div>
            <div className="flex-1">
              <h4 className="text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Destination Finale</h4>
              <p className="font-black text-white text-sm uppercase">{order.customer_name}</p>
            </div>
            <div className="flex gap-2">
              <a href={`tel:${order.phone}`} className="p-4 bg-green-500/10 text-green-500 rounded-2xl active:scale-90 transition-transform border border-green-500/20"><Phone size={18} /></a>
              <button onClick={() => handleNavigate(order.customer_name, order.delivery_lat, order.delivery_lng)} className="p-4 bg-slate-800 rounded-2xl text-white active:scale-90 transition-transform shadow-lg"><Navigation size={18} /></button>
            </div>
          </div>
        </div>

        {/* ============ SECTION PANIER / MAGASINS ============ */}
        {order.multiStoreData?.storeGroups && order.multiStoreData.storeGroups.length > 0 && (
          <div className="glass rounded-[2rem] border-white/10 overflow-hidden bg-gradient-to-br from-blue-500/5 to-purple-500/5">
            {/* Header */}
            <div className="bg-blue-500/10 p-5 border-b border-blue-500/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <Store size={20} className="text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-white tracking-tight">
                    {order.multiStoreData.isMultiStore ? "🏪 MULTI-MAGASINS" : "🛒 DÉTAILS DU PANIER"}
                  </h3>
                  <p className="text-[9px] text-blue-400 font-black uppercase tracking-widest">
                    {order.multiStoreData.isMultiStore
                      ? `${order.multiStoreData.storeCount} magasins à visiter`
                      : "Articles à récupérer"}
                  </p>
                </div>
              </div>
              {/* Bouton itinéraire optimisé */}
              <button
                onClick={() => {
                  const routeUrl = generateMultiStoreRoute(
                    order.multiStoreData?.storeGroups || [],
                    order.delivery_lat,
                    order.delivery_lng
                  );
                  if (routeUrl) {
                    window.open(routeUrl, '_blank');
                  }
                }}
                className="p-3 bg-blue-500/20 rounded-xl text-blue-400 active:scale-90 transition-transform border border-blue-500/30"
              >
                <Map size={18} />
              </button>
            </div>

            {/* Liste des magasins */}
            <div className="p-4 space-y-4">
              {order.multiStoreData.storeGroups.map((group, idx) => (
                <div
                  key={idx}
                  className="glass rounded-2xl border-white/10 overflow-hidden"
                >
                  {/* En-tête du magasin */}
                  <div className="bg-white/5 p-4 border-b border-white/5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center text-orange-500 font-black text-sm shrink-0">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-black text-white text-sm uppercase truncate">
                            {group.storeName}
                          </h4>
                          <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-1">
                            {group.totalItems} article{group.totalItems > 1 ? 's' : ''} à récupérer
                            {group.totalPrice && group.totalPrice > 0 && (
                              <span className="ml-2 text-orange-400">• {group.totalPrice.toFixed(2)} DH</span>
                            )}
                          </p>
                        </div>
                      </div>
                      {/* Bouton Maps pour ce magasin */}
                      {group.storeInfo?.lat && group.storeInfo?.lng && (
                        <button
                          onClick={() => handleNavigate(
                            group.storeName,
                            group.storeInfo?.lat,
                            group.storeInfo?.lng
                          )}
                          className="p-3 bg-slate-800 rounded-xl text-white active:scale-90 transition-transform shrink-0"
                        >
                          <Navigation size={16} />
                        </button>
                      )}
                    </div>

                    {/* Coordonnées GPS */}
                    {group.storeInfo?.lat && group.storeInfo?.lng && (
                      <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
                        <div className="text-[8px] text-slate-500 font-mono bg-slate-900/50 px-2 py-1 rounded">
                          📍 {group.storeInfo.lat.toFixed(6)}, {group.storeInfo.lng.toFixed(6)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Liste des items de ce magasin */}
                  {group.items.length > 0 && (
                    <div className="p-4 space-y-2">
                      {group.items.map((item, itemIdx) => (
                        <div
                          key={itemIdx}
                          onClick={() => setShowTextDetail({ title: item.productName || 'Produit', note: item.note })}
                          className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/5 active:bg-white/10 transition-colors cursor-pointer"
                        >
                          {/* Image du produit si disponible */}
                          {item.image_base64 && (
                            <div className="relative shrink-0">
                              <img
                                src={formatBase64(item.image_base64)}
                                className="w-12 h-12 rounded-lg object-cover border border-white/10"
                                alt={item.productName || 'Produit'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowImageZoom({ url: formatBase64(item.image_base64)!, title: item.productName || "Produit" });
                                }}
                              />
                              <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-1 border border-[#0F172A]">
                                <ZoomIn size={8} className="text-white" />
                              </div>
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-white text-xs font-black uppercase truncate">
                                {item.quantity}x {item.productName || 'Produit'}
                              </p>
                              {item.price && item.price > 0 && (
                                <span className="text-orange-400 text-xs font-black shrink-0">
                                  {(item.price * item.quantity).toFixed(2)} DH
                                </span>
                              )}
                            </div>

                            {/* Note spécifique pour cet item */}
                            {item.note && (
                              <p className="text-[10px] text-blue-400 italic mt-1 leading-tight line-clamp-1">
                                📝 "{item.note}"
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* JUSTIFICATIFS */}
        {(order.prescription_base64 || order.payment_receipt_base64) && (
          <div className="glass rounded-[2rem] border-white/10 overflow-hidden">
            <div className="bg-white/5 p-4 border-b border-white/5 flex items-center gap-2 px-6">
              <ImageIcon size={16} className="text-orange-500" />
              <span className="text-[10px] font-black uppercase text-white tracking-widest">Justificatifs Client</span>
            </div>
            <div className="p-4 grid grid-cols-1 gap-4">
              {order.prescription_base64 && (
                <img src={order.prescriptionImageUrl} className="w-full h-44 object-cover rounded-2xl border border-white/5" onClick={() => setShowImageZoom({ url: order.prescriptionImageUrl, title: "Ordonnance" })} />
              )}
              {order.payment_receipt_base64 && (
                <img src={order.receiptImageUrl} className="w-full h-44 object-cover rounded-2xl border border-white/5" onClick={() => setShowImageZoom({ url: order.receiptImageUrl, title: "Reçu" })} />
              )}
            </div>
          </div>
        )}

        {/* MAIN ACTION BUTTON */}
        <button onClick={handleNextStep} className="w-full py-6 rounded-3xl bg-orange-500 text-white font-black text-xl shadow-[0_20px_50px_rgba(249,115,22,0.4)] active:scale-95 transition-all uppercase tracking-tighter flex items-center justify-center gap-3">
          {currentStep === 1 && "PASSER EN PROGRESSION"}
          {currentStep === 2 && (
            <>
              <QrCode size={24} />
              SCANNER POUR LIVRER
            </>
          )}
          {currentStep === 3 && "MISSION TERMINÉE"}
        </button>

        {/* SIGNALER UN PROBLÈME */}
        <button
          onClick={handleReportProblem}
          className="w-full py-4 mt-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 font-black text-[10px] uppercase tracking-[0.2em] active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <AlertTriangle size={14} />
          Signaler un Problème
        </button>
      </div>

      {/* QR SCANNER FULLSCREEN OVERLAY */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-[300] bg-slate-950 flex flex-col p-6 animate-in slide-in-from-bottom duration-300">
          <div className="flex justify-between items-center mb-10">
            <div className="space-y-1">
              <h3 className="text-white font-black uppercase text-lg tracking-tighter">Confirmation Client</h3>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Scannez le code du client pour valider</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={toggleFacingMode}
                className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-white active:bg-white/10"
              >
                <RotateCcw size={20} />
              </button>
              <button
                onClick={() => setIsScannerOpen(false)}
                className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-white"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-start pt-10">
            <div id="reader" className="w-full max-w-sm rounded-[2rem] overflow-hidden border-2 border-orange-500/50 shadow-[0_0_50px_rgba(249,115,22,0.2)] bg-black"></div>

            <div className="mt-12 text-center space-y-4 px-10">
              <p className="text-slate-600 text-[9px] font-black uppercase tracking-widest italic pt-4">Alignez le QR Code dans le cadre ci-dessus</p>
              <button onClick={toggleFacingMode} className="text-orange-500 font-black text-[10px] uppercase underline tracking-widest">Tourner la caméra</button>
            </div>
          </div>
        </div>
      )}

      {showImageZoom && (
        <div className="fixed inset-0 z-[500] bg-black/95 p-6 flex flex-col animate-in fade-in duration-300" onClick={() => setShowImageZoom(null)}>
          <div className="flex justify-between items-center mb-6">
            <span className="text-white font-black uppercase text-[10px] tracking-[0.3em] font-serif italic">{showImageZoom.title}</span>
            <button className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white"><X size={20} /></button>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <img src={showImageZoom.url} className="max-w-full max-h-[80vh] object-contain rounded-[2.5rem] shadow-[0_30px_60px_rgba(0,0,0,0.5)] border border-white/5" />
          </div>
          <div className="mt-6 text-center">
            <p className="text-white/40 text-[9px] font-black uppercase tracking-[0.4em]">Tapez n'importe où pour fermer</p>
          </div>
        </div>
      )}

      {showTextDetail && (
        <div className="fixed inset-0 z-[500] bg-[#0F172A]/95 p-8 flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-300" onClick={() => setShowTextDetail(null)}>
          <div className="glass w-full max-w-sm p-8 rounded-[3rem] border-white/10 bg-slate-900/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-5"><Package size={120} /></div>

            <h3 className="text-orange-500 font-black text-[10px] uppercase tracking-[0.4em] mb-4">Détails de l'article</h3>
            <h2 className="text-white font-black text-2xl uppercase tracking-tighter leading-tight mb-8 font-serif italic border-b border-orange-500/20 pb-4">
              {showTextDetail.title}
            </h2>

            <div className="space-y-4">
              <span className="text-slate-500 font-black text-[9px] uppercase tracking-widest block">Note ou Instruction :</span>
              <p className="text-white text-lg font-medium italic leading-relaxed bg-white/5 p-6 rounded-3xl border border-white/5 shadow-inner">
                {showTextDetail.note ? `"${showTextDetail.note}"` : "Aucune instruction spécifique."}
              </p>
            </div>

            <button className="w-full mt-10 py-5 bg-orange-500 rounded-2xl text-white font-black uppercase text-xs tracking-widest active:scale-95 transition-all">
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveMission;
