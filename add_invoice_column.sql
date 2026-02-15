-- SQL pour ajouter la colonne de la photo de facture magasin
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS store_invoice_base64 text;

-- Mettre à jour les permissions si nécessaire (généralement incluses dans les policies existantes pour UPDATE)
-- Exemple de verification :
-- create policy "Enable update for drivers" on orders for update using (true) with check (true);
