-- Optimisation des performances pour l'application Livreur
-- A exécuter dans l'éditeur SQL de Supabase

-- Index pour accélérer la récupération des commandes par livreur
CREATE INDEX IF NOT EXISTS idx_orders_assigned_driver_id ON public.orders(assigned_driver_id);

-- Index pour filtrer rapidement par statut (évite de scanner toute la table)
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- Index pour les commandes archivées (très utilisé dans les filtres)
CREATE INDEX IF NOT EXISTS idx_orders_is_archived ON public.orders(is_archived);

-- Index combiné optionnel pour la requête la plus fréquente (non archivé + assigné)
CREATE INDEX IF NOT EXISTS idx_orders_active_driver_search ON public.orders(assigned_driver_id, is_archived);
