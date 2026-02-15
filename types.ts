
export enum OrderStatus {
  ASSIGNED = 'assigned',
  AT_STORE = 'treatment',
  DELIVERING = 'delivering',
  COMPLETED = 'delivered',
  CANCELLED = 'cancelled'
}

// ============ NOUVEAUX TYPES POUR MULTI-MAGASINS ============

// Item de commande avec informations du magasin
export interface CartItem {
  productName?: string;
  storeName?: string;        // Nom du magasin pour cet item (PEUT ÊTRE DIFFÉRENT pour chaque item!)
  quantity: number;
  price?: number;
  note?: string;
  image_base64?: string;
  product?: any;             // Objet produit complet (optionnel)
}

// Informations d'un magasin
export interface StoreInfo {
  id?: string;
  name: string;
  lat?: number;
  lng?: number;
  mapsUrl?: string;
  delivery_time_min?: number;
}

// Groupement d'items par magasin
export interface StoreGroup {
  storeName: string;
  storeInfo?: StoreInfo;
  items: CartItem[];
  totalItems: number;
  totalPrice?: number;       // Somme des prix des items de ce magasin
}

// Détection multi-magasins
export interface MultiStoreDetection {
  isMultiStore: boolean;
  storeCount: number;
  storeNames: string[];
  storeGroups: StoreGroup[];
}

// ============ INTERFACE ORDER ÉTENDUE ============

export interface Order {
  id: string;
  type: 'PHARMACIE' | 'GASTRONOMIE' | 'SHOPPING' | 'COURSES';
  storeName: string;         // Pour compatibilité avec ancien système
  storeAddress: string;
  clientName: string;
  clientAddress: string;
  clientPhone: string;
  distance: string;
  earnings: number;
  clientRequestText: string;
  prescriptionImageUrl?: string;
  status: OrderStatus;
  notes?: string;
  totalProducts?: number;
  paymentMethod?: string;
  statusHistory?: any[];

  // NOUVEAUX CHAMPS POUR MULTI-MAGASINS
  items?: CartItem[];                    // Items parsés de la commande
  multiStoreData?: MultiStoreDetection;  // Données multi-magasins calculées
  store_invoice_base64?: string;         // Photo de la facture magasin
}
