
export enum OrderStatus {
  ASSIGNED = 'assigned',
  AT_STORE = 'at_store', // Correction: DB attend 'at_store'
  PICKED_UP = 'picked_up',
  DELIVERING = 'delivering',
  COMPLETED = 'delivered', // Correction: DB attend 'delivered'
  CANCELLED = 'cancelled'
}

export interface Order {
  id: string;
  type: 'PHARMACIE' | 'GASTRONOMIE' | 'SHOPPING' | 'COURSES';
  storeName: string;
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
}
