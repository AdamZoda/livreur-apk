/**
 * Service de gestion des commandes multi-magasins
 * 
 * Ce service détecte et enrichit les commandes qui contiennent des items
 * provenant de plusieurs magasins différents.
 */

import { CartItem, StoreInfo, StoreGroup, MultiStoreDetection } from '../types';
import { supabase } from './supabaseClient';

/**
 * Détecte si une commande contient des items de plusieurs magasins
 * et groupe les items par magasin
 */
export function detectMultiStores(items: CartItem[]): MultiStoreDetection {
    if (!items || items.length === 0) {
        return {
            isMultiStore: false,
            storeCount: 0,
            storeNames: [],
            storeGroups: []
        };
    }

    // Extraire tous les noms de magasins uniques
    const storeNamesSet = new Set<string>();
    items.forEach(item => {
        if (item.storeName) {
            storeNamesSet.add(item.storeName);
        }
    });

    const uniqueStoreNames = Array.from(storeNamesSet);

    // Grouper les items par magasin
    const storeGroupsMap = new Map<string, CartItem[]>();

    items.forEach(item => {
        const storeName = item.storeName || 'Magasin Inconnu';

        if (!storeGroupsMap.has(storeName)) {
            storeGroupsMap.set(storeName, []);
        }

        storeGroupsMap.get(storeName)!.push(item);
    });

    // Créer les objets StoreGroup
    const storeGroups: StoreGroup[] = Array.from(storeGroupsMap.entries()).map(([storeName, items]) => {
        const totalPrice = items.reduce((sum, item) => {
            return sum + ((item.price || 0) * item.quantity);
        }, 0);

        return {
            storeName,
            items,
            totalItems: items.length,
            totalPrice
        };
    });

    return {
        isMultiStore: uniqueStoreNames.length > 1,
        storeCount: uniqueStoreNames.length,
        storeNames: uniqueStoreNames,
        storeGroups
    };
}

/**
 * Récupère les informations d'un magasin depuis la base de données
 * (coordonnées GPS, téléphone, etc.)
 */
export async function fetchStoreInfo(storeName: string): Promise<StoreInfo | null> {
    try {
        const { data, error } = await supabase
            .from('stores')
            .select('id, name, lat, lng, maps_url, delivery_time_min')
            .ilike('name', storeName)
            .maybeSingle();

        if (error) {
            console.error(`Erreur récupération infos magasin "${storeName}":`, error);
            return null;
        }

        if (!data) {
            console.warn(`Magasin "${storeName}" non trouvé dans la base de données`);
            return null;
        }

        return {
            id: data.id,
            name: data.name,
            lat: data.lat,
            lng: data.lng,
            mapsUrl: data.maps_url,
            delivery_time_min: data.delivery_time_min
        };
    } catch (err) {
        console.error(`Erreur lors de la récupération du magasin "${storeName}":`, err);
        return null;
    }
}

/**
 * Enrichit les groupes de magasins avec les informations GPS
 * depuis la base de données
 */
export async function enrichStoreGroups(groups: StoreGroup[]): Promise<StoreGroup[]> {
    const enrichedGroups = await Promise.all(
        groups.map(async (group) => {
            const storeInfo = await fetchStoreInfo(group.storeName);

            return {
                ...group,
                storeInfo: storeInfo || undefined
            };
        })
    );

    return enrichedGroups;
}

/**
 * Analyse complète d'une commande pour détecter et enrichir
 * les données multi-magasins
 */
export async function analyzeOrder(order: any): Promise<MultiStoreDetection | null> {
    // Essayer de parser les items si c'est une chaîne JSON
    let items: CartItem[] = [];

    if (order.items) {
        if (typeof order.items === 'string') {
            try {
                items = JSON.parse(order.items);
            } catch (e) {
                console.error('Erreur parsing items:', e);
                return null;
            }
        } else if (Array.isArray(order.items)) {
            items = order.items;
        }
    }

    // Si pas d'items, fallback sur ancien système (order.store_name)
    if (items.length === 0 && order.store_name) {
        const storeInfo = await fetchStoreInfo(order.store_name);

        return {
            isMultiStore: false,
            storeCount: 1,
            storeNames: [order.store_name],
            storeGroups: [{
                storeName: order.store_name,
                storeInfo: storeInfo || undefined,
                items: [],
                totalItems: 0,
                totalPrice: 0
            }]
        };
    }

    // Détecter les magasins multiples
    const detection = detectMultiStores(items);

    // Enrichir avec les infos GPS
    detection.storeGroups = await enrichStoreGroups(detection.storeGroups);

    return detection;
}

/**
 * Générer l'URL Google Maps pour un itinéraire multi-points
 * (tous les magasins + destination client)
 */
export function generateMultiStoreRoute(
    storeGroups: StoreGroup[],
    clientLat?: number,
    clientLng?: number
): string | null {
    // Filtrer les magasins qui ont des coordonnées GPS
    const storesWithGPS = storeGroups.filter(
        group => group.storeInfo?.lat && group.storeInfo?.lng
    );

    if (storesWithGPS.length === 0 && (!clientLat || !clientLng)) {
        return null;
    }

    // Créer les waypoints (points intermédiaires)
    const waypoints = storesWithGPS
        .map(group => `${group.storeInfo!.lat},${group.storeInfo!.lng}`)
        .join('|');

    // Destination finale = client
    const destination = clientLat && clientLng
        ? `${clientLat},${clientLng}`
        : waypoints.split('|').pop(); // Si pas de coordonnées client, dernier magasin

    // Origine = premier magasin
    const origin = waypoints.split('|')[0];

    // Construire l'URL Google Maps avec itinéraire
    const baseUrl = 'https://www.google.com/maps/dir/?api=1';
    const params = new URLSearchParams({
        origin,
        destination: destination!,
        travelmode: 'driving'
    });

    if (storesWithGPS.length > 1) {
        // Retirer le premier point des waypoints (c'est l'origine)
        const intermediateWaypoints = waypoints.split('|').slice(1, -1).join('|');
        if (intermediateWaypoints) {
            params.append('waypoints', intermediateWaypoints);
        }
    }

    return `${baseUrl}&${params.toString()}`;
}
