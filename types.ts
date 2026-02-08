
export enum OrderStatus {
  ASSIGNED = 'ASSIGNED',
  AT_STORE = 'AT_STORE',
  PICKED_UP = 'PICKED_UP',
  DELIVERING = 'DELIVERING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
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
