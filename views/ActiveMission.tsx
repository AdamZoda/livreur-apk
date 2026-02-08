
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
  X
} from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { supabase } from '../services/supabaseClient';
import { Html5QrcodeScanner } from 'html5-qrcode';

const ActiveMission: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [showImageZoom, setShowImageZoom] = useState<{ url: string, title: string } | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isRejected, setIsRejected] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

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

        setOrder({
          ...data,
          prescriptionImageUrl: formatBase64(data.prescription_base64),
          receiptImageUrl: formatBase64(data.payment_receipt_base64)
        });

        if (data.items) {
          try {
            const parsedItems = typeof data.items === 'string' ? JSON.parse(data.items) : data.items;
            setItems(Array.isArray(parsedItems) ? parsedItems : []);
          } catch (e) { setItems([]); }
        }

        if (s === 'at_store' || s === 'traitement') setCurrentStep(1);
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
  const performStatusUpdate = async (nextStatusDB: string, nextLabelFR: string) => {
    const now = new Date().toISOString();
    const history = Array.isArray(order?.status_history) ? order.status_history : [];
    const newHistory = [...history, { status: nextLabelFR, time: now }];

    // On prépare l'objet de mise à jour
    // Si status_history cause l'erreur 400, on pourra l'isoler
    const updateData: any = {
      status: nextStatusDB,
      status_history: newHistory
    };

    const { data, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) {
      console.error("Erreur DB détaillée:", error);
      // Tentative de repli sans l'historique si c'est lui qui pose problème
      if (error.code === '42703' || error.message.includes('status_history')) {
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
      }
      setUpdateError(`Erreur (${error.code}) : ${error.message}. Vérifiez que la valeur '${nextStatusDB}' est autorisée.`);
      return false;
    }

    if (!data || data.length === 0) {
      setUpdateError("Aucune modification effectuée. Commande peut-être déjà mise à jour.");
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
      // Étape 2 : Marquer comme livrée -> SCAN QR CODE OBLIGATOIRE
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop()); // On arrête le stream juste après le test
        setIsScannerOpen(true);
      } catch (err) {
        console.error("Erreur Caméra:", err);
        setUpdateError("Accès caméra refusé. Vous devez autoriser la caméra pour valider la livraison.");
      }
    }
    else {
      navigate('/');
    }
  };

  // QR SCANNER LOGIC
  useEffect(() => {
    if (isScannerOpen) {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );

      scanner.render((decodedText) => {
        // Le code attendu doit être un message précis incluant l'ID
        const cleanText = decodedText.trim().toUpperCase();
        const expectedMessage = `CONFIRM-ORDER-ID-${order.id}`;

        if (cleanText === expectedMessage) {
          scanner.clear();
          setIsScannerOpen(false);
          performStatusUpdate(OrderStatus.COMPLETED, 'LIVRÉE');
        } else {
          setUpdateError(`Code Invalide. Attendu: CONFIRM-ORDER-ID-${order.id}`);
          // On laisse le scanner ouvert pour réessayer
        }
      }, (error) => {
        // On ignore les erreurs de scan continu
      });

      scannerRef.current = scanner;
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(e => console.error(e));
      }
    };
  }, [isScannerOpen]);

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
      <header className="flex justify-between items-center mb-6 px-2">
        <h2 className="text-xl font-black uppercase tracking-tighter text-white font-serif italic">Missions <span className="text-orange-500">#{order.id}</span></h2>
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

        {/* Info Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="glass p-5 rounded-[2rem] border-white/5 flex flex-col items-center text-center">
            <Wallet size={20} className="text-orange-500 mb-2" />
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Articles</span>
            <span className="text-xl font-black text-white">{order.total_products || 0} Dh</span>
          </div>
          <div className="glass p-5 rounded-[2rem] border-white/5 flex flex-col items-center text-center">
            <Info size={20} className="text-blue-500 mb-2" />
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Paiement</span>
            <span className="text-xs font-black text-white uppercase">{order.payment_method || 'Cash'}</span>
          </div>
        </div>

        {/* Note Client */}
        {order.text_order_notes && (
          <div className="glass p-6 rounded-3xl border-white/5 bg-blue-500/5">
            <p className="text-sm text-white/90 leading-relaxed italic px-1 font-medium leading-tight">"{order.text_order_notes}"</p>
          </div>
        )}

        {/* Contacts */}
        <div className="glass p-6 rounded-[2.5rem] border-white/5 space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-500 shadow-inner"><Store size={22} /></div>
            <div className="flex-1">
              <h4 className="text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Point A (Magasin)</h4>
              <p className="font-black text-white text-sm uppercase">{order.store_name}</p>
            </div>
            <button onClick={() => handleNavigate(order.store_name)} className="p-4 bg-slate-800 rounded-2xl text-white active:scale-90 transition-transform"><Navigation size={18} /></button>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 shadow-inner"><User size={22} /></div>
            <div className="flex-1">
              <h4 className="text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Point B (Client)</h4>
              <p className="font-black text-white text-sm uppercase">{order.customer_name}</p>
            </div>
            <div className="flex gap-2">
              <a href={`tel:${order.phone}`} className="p-4 bg-green-500/10 text-green-500 rounded-2xl active:scale-90 transition-transform"><Phone size={18} /></a>
              <button onClick={() => handleNavigate(order.customer_name, order.delivery_lat, order.delivery_lng)} className="p-4 bg-slate-800 rounded-2xl text-white active:scale-90 transition-transform"><Navigation size={18} /></button>
            </div>
          </div>
        </div>

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
      </div>

      {/* QR SCANNER FULLSCREEN OVERLAY */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-[300] bg-slate-950 flex flex-col p-6 animate-in slide-in-from-bottom duration-300">
          <div className="flex justify-between items-center mb-10">
            <div className="space-y-1">
              <h3 className="text-white font-black uppercase text-lg tracking-tighter">Confirmation Client</h3>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Scannez le code du client pour valider</p>
            </div>
            <button
              onClick={() => {
                if (scannerRef.current) scannerRef.current.clear();
                setIsScannerOpen(false);
              }}
              className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-white"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-start pt-10">
            <div id="reader" className="w-full max-w-sm rounded-[2rem] overflow-hidden border-2 border-orange-500/50 shadow-[0_0_50px_rgba(249,115,22,0.2)] bg-black"></div>

            <div className="mt-12 text-center space-y-4 px-10">
              <p className="text-slate-600 text-[9px] font-black uppercase tracking-widest italic pt-4">Alignez le QR Code dans le cadre ci-dessus</p>
            </div>
          </div>
        </div>
      )}

      {showImageZoom && (
        <div className="fixed inset-0 z-[200] bg-black p-6 flex flex-col" onClick={() => setShowImageZoom(null)}>
          <div className="flex justify-between items-center mb-6">
            <span className="text-white font-black uppercase text-[10px] tracking-widest">{showImageZoom.title}</span>
            <button className="text-white font-black text-xl">X</button>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <img src={showImageZoom.url} className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveMission;
