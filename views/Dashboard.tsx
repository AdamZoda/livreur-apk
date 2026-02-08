
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { TrendingUp, PackageCheck, Wallet, History, AlertCircle, XCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({ totalEarnings: 0, count: 0 });
  const [history, setHistory] = useState<any[]>([]);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Identifiants du livreur (Identique à Home.tsx pour cohérence)
  const driverId = localStorage.getItem('vta_driver_id') || "";
  const driverPhone = localStorage.getItem('vta_phone') || "";
  const driverName = localStorage.getItem('vta_driver_name') || "";

  useEffect(() => {
    const fetchStats = async () => {
      if (!driverId && !driverPhone && !driverName) {
        setLoading(false);
        return;
      }

      setLoading(true);
      // On ne prend que les commandes non archivées pour les stats actives
      const { data: allOrders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (allOrders) {
        // 1. Filtrer les commandes appartenant à ce livreur
        const myOrders = allOrders.filter(o => {
          const assignedTo = String(o.assigned_driver_id || "").toLowerCase().trim();
          return assignedTo === driverId.toLowerCase() ||
            assignedTo === driverPhone.toLowerCase() ||
            assignedTo === driverName.toLowerCase();
        });

        // 2. Séparer les commandes terminées (Historique)
        // AJOUT : On ne montre que les succès, et on cache les 'refusé', 'annulé' ou 'indisponible'
        const finishedOrders = myOrders.filter(o => {
          const s = String(o.status || "").toLowerCase();
          const isSuccess = ['delivered', 'completed', 'livrée', 'terminée'].includes(s);
          return isSuccess; // On ne garde que les succès pour le livreur
        });

        // 3. Calculer les statistiques
        const successfulOrders = finishedOrders.filter(o => {
          const s = String(o.status).toLowerCase();
          return s === 'delivered' || s === 'completed' || s === 'livrée' || s === 'terminée';
        });

        const total = successfulOrders.reduce((acc, curr) => acc + Number(curr.delivery_fee || 0), 0);

        setStats({
          totalEarnings: total,
          count: successfulOrders.length
        });

        setHistory(finishedOrders.slice(0, 15)); // Top 15 dernières courses

        // 4. Graphique
        const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        const groupings: any = {};
        successfulOrders.forEach(o => {
          const d = new Date(o.created_at).getDay();
          const dayName = days[d];
          groupings[dayName] = (groupings[dayName] || 0) + Number(o.delivery_fee || 0);
        });

        const chartData = days.map(d => ({ name: d, amount: groupings[d] || 0 }));
        const mondayFirst = [...chartData.slice(1), chartData[0]];
        setDailyData(mondayFirst);
      }
      setLoading(false);
    };

    fetchStats();
  }, [driverId, driverPhone, driverName]);

  const getStatusIcon = (status: string) => {
    const s = String(status).toLowerCase();
    if (['delivered', 'completed', 'livrée', 'terminée'].includes(s)) return <CheckCircle2 size={16} className="text-green-500" />;
    if (['cancelled', 'refused', 'refusée', 'indisponible', 'fermé'].includes(s)) return <XCircle size={16} className="text-red-500" />;
    return <AlertCircle size={16} className="text-slate-400" />;
  };

  const getStatusColor = (status: string) => {
    const s = String(status).toLowerCase();
    if (['delivered', 'completed', 'livrée', 'terminée'].includes(s)) return 'text-green-500';
    if (['cancelled', 'refused', 'refusée', 'indisponible', 'fermé'].includes(s)) return 'text-red-500';
    return 'text-slate-400';
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-white font-black bg-[#0F172A] uppercase tracking-widest">Analyse en cours...</div>;

  return (
    <div className="pb-32 pt-10 px-6 space-y-8 bg-[#0F172A] min-h-screen">
      <header className="space-y-1">
        <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Performances</h1>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Tableau de Bord Livreur</p>
      </header>

      {/* Main Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass p-6 rounded-[2rem] border-white/5 flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute -top-2 -right-2 w-12 h-12 bg-orange-500/10 rounded-full blur-xl"></div>
          <Wallet className="text-orange-500 mb-3" size={24} />
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Gains Totaux</span>
          <span className="text-2xl font-black text-white">{stats.totalEarnings} <small className="text-xs text-orange-500">DH</small></span>
        </div>
        <div className="glass p-6 rounded-[2rem] border-white/5 flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute -top-2 -right-2 w-12 h-12 bg-green-500/10 rounded-full blur-xl"></div>
          <PackageCheck className="text-green-500 mb-3" size={24} />
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Courses</span>
          <span className="text-2xl font-black text-white">{stats.count}</span>
        </div>
      </div>

      {/* Chart */}
      <div className="glass p-6 rounded-[2.5rem] border-white/5">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2 mb-8">
          <TrendingUp size={14} className="text-orange-500" /> Revenus de la Semaine
        </h3>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyData}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 10, fontWeight: 900 }} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ backgroundColor: '#0F172A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }} />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                {dailyData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.amount > 0 ? '#F97316' : '#1E293B'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* History List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-2">
          <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
            <History size={16} className="text-orange-500" /> Historique Interactif
          </h3>
        </div>

        <div className="space-y-3">
          {history.length > 0 ? history.map((order) => {
            const statusLabel = String(order.status).toUpperCase();
            return (
              <div
                key={order.id}
                onClick={() => navigate('/mission/' + order.id)}
                className="glass p-5 rounded-[2rem] border-white/5 flex justify-between items-center active:scale-95 transition-all cursor-pointer hover:bg-white/[0.02]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-800/50 rounded-2xl flex items-center justify-center border border-white/5">
                    {getStatusIcon(order.status)}
                  </div>
                  <div>
                    <h4 className="font-black text-white text-sm uppercase max-w-[120px] truncate">{order.store_name || "Mission"}</h4>
                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-0.5">
                      #{order.id} • {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-white text-lg">+{order.delivery_fee} <small className="text-[10px] text-orange-500">DH</small></div>
                  <div className={`text-[8px] font-black uppercase tracking-widest ${getStatusColor(order.status)}`}>{statusLabel}</div>
                </div>
              </div>
            )
          }) : (
            <div className="glass p-10 rounded-[2rem] border-dashed border-2 border-white/5 flex flex-col items-center justify-center text-center opacity-40">
              <p className="text-slate-500 font-black text-[10px] uppercase tracking-widest">Historique vide</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
