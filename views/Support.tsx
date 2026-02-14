
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LifeBuoy,
    Send,
    ChevronLeft,
    Clock,
    CheckCircle2,
    HelpCircle,
    MessageSquare,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    User,
    Shield
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';

const Support: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [description, setDescription] = useState((location.state as any)?.preFill || '');
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Chat States
    const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
    const [messages, setMessages] = useState<{ [key: string]: any[] }>({});
    const [replyText, setReplyText] = useState('');
    const [sendingReply, setSendingReply] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const driverPhone = localStorage.getItem('vta_phone') || "";
    const driverId = localStorage.getItem('vta_driver_id') || "";
    const driverName = localStorage.getItem('vta_driver_name') || "";

    useEffect(() => {
        fetchTickets();
    }, [driverPhone]);

    useEffect(() => {
        if (expandedTicketId) {
            fetchMessages(expandedTicketId);
            scrollToBottom();

            // Real-time subscription for messages
            const channel = supabase
                .channel(`ticket-${expandedTicketId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'support_messages',
                        filter: `ticket_id=eq.${expandedTicketId}`
                    },
                    (payload) => {
                        setMessages(prev => ({
                            ...prev,
                            [expandedTicketId]: [...(prev[expandedTicketId] || []), payload.new]
                        }));
                        scrollToBottom();
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [expandedTicketId]);

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const fetchTickets = async () => {
        if (!driverPhone) {
            setLoading(false);
            return;
        }

        const { data, error } = await supabase
            .from('support_tickets')
            .select('*')
            .eq('driver_phone', driverPhone)
            .order('created_at', { ascending: false });

        if (data) {
            setTickets(data);
        }
        setLoading(false);
    };

    const fetchMessages = async (ticketId: string) => {
        const { data, error } = await supabase
            .from('support_messages')
            .select('*')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true });

        if (data) {
            setMessages(prev => ({
                ...prev,
                [ticketId]: data
            }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!description.trim()) return;

        setSubmitting(true);
        setMessage(null);

        try {
            const { data, error } = await supabase
                .from('support_tickets')
                .insert([{
                    driver_id: driverId,
                    driver_name: driverName,
                    driver_phone: driverPhone,
                    description: description.trim(),
                    status: 'open'
                }])
                .select();

            if (error) throw error;

            setMessage({ type: 'success', text: 'Ticket envoyé avec succès !' });
            setDescription('');
            fetchTickets();

            // Optionally auto-open the new ticket
            if (data && data[0]) {
                setExpandedTicketId(data[0].id);
            }
        } catch (err: any) {
            console.error("Erreur lors de l'envoi du ticket:", err);
            setMessage({ type: 'error', text: "Erreur lors de l'envoi du ticket. Veuillez réessayer." });
        } finally {
            setSubmitting(false);
        }
    };

    const handleSendReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyText.trim() || !expandedTicketId) return;

        setSendingReply(true);
        try {
            const { error } = await supabase
                .from('support_messages')
                .insert([{
                    ticket_id: expandedTicketId,
                    sender_type: 'driver',
                    message: replyText.trim()
                }]);

            if (error) throw error;
            setReplyText('');
            // The message will be added via subscription
        } catch (err: any) {
            console.error("Erreur lors de l'envoi du message:", err);
        } finally {
            setSendingReply(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const s = status.toLowerCase();
        switch (s) {
            case 'open':
                return (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 text-orange-500 border border-orange-500/20">
                        <Clock size={12} strokeWidth={3} />
                        <span className="text-[10px] font-black uppercase tracking-wider">Ouvert</span>
                    </div>
                );
            case 'in_progress':
                return (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                        <HelpCircle size={12} strokeWidth={3} />
                        <span className="text-[10px] font-black uppercase tracking-wider">En cours</span>
                    </div>
                );
            case 'resolved':
                return (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
                        <CheckCircle2 size={12} strokeWidth={3} />
                        <span className="text-[10px] font-black uppercase tracking-wider">Résolu</span>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="pb-32 pt-6 px-6 min-h-screen bg-[#0F172A] space-y-8">
            {/* Custom Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/profile')}
                    className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-white border border-white/10 active:scale-90 transition-all"
                >
                    <ChevronLeft size={20} />
                </button>
                <div className="flex flex-col">
                    <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Support Client</h1>
                    <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.3em]">Aide & Assistance</p>
                </div>
            </div>

            {/* Submit New Ticket */}
            <div className="glass p-6 rounded-[2.5rem] border-white/5 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                        <MessageSquare size={16} />
                    </div>
                    <h2 className="text-xs font-black text-white uppercase tracking-widest">Nouveau Ticket</h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Décrivez votre problème ici..."
                        className="w-full bg-slate-900/50 border border-white/10 rounded-2xl p-4 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-orange-500/50 min-h-[100px] transition-all"
                        required
                    />

                    {message && (
                        <div className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-bold uppercase tracking-wider ${message.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                            {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                            {message.text}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={submitting || !description.trim()}
                        className="w-full bg-orange-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                    >
                        {submitting ? (
                            <span className="animate-pulse">ENVOI EN COURS...</span>
                        ) : (
                            <>
                                <Send size={18} />
                                ENVOYER LE TICKET
                            </>
                        )}
                    </button>
                </form>
            </div>

            {/* List Previous Tickets */}
            <div className="space-y-4">
                <div className="flex justify-between items-center px-2">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                        <LifeBuoy size={14} className="text-orange-500" /> Vos Tickets Récents
                    </h3>
                    <span className="bg-white/5 px-2 py-0.5 rounded text-[10px] font-black text-white">{tickets.length}</span>
                </div>

                <div className="space-y-3">
                    {loading ? (
                        <div className="p-8 text-center text-slate-600 text-[10px] font-black uppercase tracking-widest animate-pulse">
                            Chargement de vos tickets...
                        </div>
                    ) : tickets.length > 0 ? (
                        tickets.map((ticket) => {
                            const isExpanded = expandedTicketId === ticket.id;
                            const ticketMessages = messages[ticket.id] || [];

                            return (
                                <div
                                    key={ticket.id}
                                    className={`glass rounded-[2rem] border-white/5 overflow-hidden transition-all duration-300 ${isExpanded ? 'ring-1 ring-orange-500/30' : ''}`}
                                >
                                    {/* Ticket Header/Summary */}
                                    <div
                                        onClick={() => setExpandedTicketId(isExpanded ? null : ticket.id)}
                                        className="p-5 cursor-pointer active:bg-white/5 transition-colors"
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="space-y-1">
                                                <p className="text-[8px] text-slate-500 font-black uppercase tracking-[0.2em]">
                                                    #{ticket.id.slice(0, 8)} • {new Date(ticket.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {getStatusBadge(ticket.status || 'open')}
                                                {isExpanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                                            </div>
                                        </div>
                                        <p className={`text-sm text-slate-300 font-medium leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                                            {ticket.description}
                                        </p>
                                    </div>

                                    {/* Chat Section */}
                                    {isExpanded && (
                                        <div className="border-t border-white/5 bg-slate-950/30 flex flex-col h-[400px]">
                                            {/* Messages Area */}
                                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                                {/* Initial Description as first message */}
                                                <div className="flex flex-col items-start max-w-[85%]">
                                                    <div className="bg-slate-800 rounded-2xl rounded-tl-none p-3 border border-white/5">
                                                        <p className="text-xs text-slate-300">{ticket.description}</p>
                                                    </div>
                                                    <span className="text-[8px] text-slate-600 font-bold uppercase mt-1 ml-1">Livreur (Original)</span>
                                                </div>

                                                {ticketMessages.map((msg: any) => (
                                                    <div
                                                        key={msg.id}
                                                        className={`flex flex-col ${msg.sender_type === 'driver' ? 'items-end' : 'items-start'} max-w-[85%] ${msg.sender_type === 'driver' ? 'ml-auto' : ''}`}
                                                    >
                                                        <div className={`p-3 rounded-2xl border ${msg.sender_type === 'driver'
                                                            ? 'bg-orange-500/10 border-orange-500/20 rounded-tr-none'
                                                            : 'bg-indigo-500/10 border-indigo-500/20 rounded-tl-none'
                                                            }`}>
                                                            <p className="text-xs text-slate-200">{msg.message}</p>
                                                        </div>
                                                        <div className="flex items-center gap-1 mt-1 px-1">
                                                            {msg.sender_type === 'driver' ? <User size={8} className="text-orange-500" /> : <Shield size={8} className="text-indigo-500" />}
                                                            <span className={`text-[8px] font-bold uppercase ${msg.sender_type === 'driver' ? 'text-orange-500' : 'text-indigo-500'}`}>
                                                                {msg.sender_type === 'driver' ? 'Livreur' : 'Admin'} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                                <div ref={messagesEndRef} />
                                            </div>

                                            {/* Input Area */}
                                            <form onSubmit={handleSendReply} className="p-4 bg-slate-900/50 border-t border-white/5 flex gap-2">
                                                <input
                                                    type="text"
                                                    value={replyText}
                                                    onChange={(e) => setReplyText(e.target.value)}
                                                    placeholder="Répondre..."
                                                    className="flex-1 bg-slate-950/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500/50"
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={sendingReply || !replyText.trim()}
                                                    className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center active:scale-90 transition-all disabled:opacity-50"
                                                >
                                                    {sendingReply ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={16} />}
                                                </button>
                                            </form>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <div className="glass p-10 rounded-[2rem] border-dashed border-2 border-white/5 flex flex-col items-center justify-center text-center opacity-40">
                            <p className="text-slate-500 font-black text-[9px] uppercase tracking-widest">Aucun ticket pour le moment</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Support;
