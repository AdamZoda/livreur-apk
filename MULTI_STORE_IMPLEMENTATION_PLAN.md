# 📋 PLAN D'IMPLÉMENTATION - SYSTÈME MULTI-MAGASINS

## 🎯 OBJECTIF
Mettre à jour l'application livreur pour supporter les commandes multi-magasins tout en conservant la compatibilité avec les commandes mono-magasin existantes.

## 📊 ANALYSE DE L'EXISTANT

### Base de Données Actuelle
- Table `orders` : Contient `store_name` (ancien système mono-magasin)
- Table `order_items` : Contient `store_name` par item (nouveau système multi-magasins)
- Table `stores` : Contient les coordonnées GPS (`lat`, `lng`) et `maps_url`

### Architecture Actuelle de l'APK
- **types.ts** : Définition de l'interface `Order` (simple, mono-magasin)
- **Home.tsx** : Liste des missions assignées au livreur
- **ActiveMission.tsx** : Vue détaillée d'une mission
- **Missions.tsx** : Historique des missions

## 🔧 MODIFICATIONS À EFFECTUER

### 1️⃣ **MISE À JOUR DES TYPES** (`types.ts`)

#### Types à ajouter :
```typescript
// Item avec informations du magasin
export interface CartItem {
  productName: string;
  storeName?: string;        // Magasin de cet item
  quantity: number;
  price: number;
  note?: string;
  image_base64?: string;
}

// Informations d'un magasin
export interface StoreInfo {
  name: string;
  lat?: number;
  lng?: number;
  mapsUrl?: string;
  phone?: string;
}

// Groupement d'items par magasin
export interface StoreGroup {
  storeName: string;
  storeInfo?: StoreInfo;
  items: CartItem[];
  totalItems: number;
}

// Détection multi-magasins
export interface MultiStoreDetection {
  isMultiStore: boolean;
  storeCount: number;
  storeNames: string[];
  storeGroups: StoreGroup[];
}
```

#### Interface Order à étendre :
```typescript
export interface Order {
  // ... champs existants ...
  items?: CartItem[];              // Items parsés
  multiStoreData?: MultiStoreDetection;  // Données multi-magasins calculées
}
```

### 2️⃣ **CRÉATION D'UN SERVICE MULTI-MAGASINS** (`services/multiStoreService.ts`)

Fonctions à créer :
- `detectMultiStores(items: CartItem[]): MultiStoreDetection`
- `fetchStoreInfo(storeName: string): Promise<StoreInfo | null>`
- `enrichStoreGroups(groups: StoreGroup[]): Promise<StoreGroup[]>`

### 3️⃣ **MISE À JOUR DE HOME.TSX**

#### Badge Multi-Magasins
- Détecter si une mission contient plusieurs magasins
- Afficher un badge "🏪 MULTI-MAGASINS (X)" si applicable

#### Modifications :
```tsx
// Dans la carte de mission
{mission.multiStoreData?.isMultiStore && (
  <span className="badge-multi-stores">
    🏪 MULTI-MAGASINS ({mission.multiStoreData.storeCount})
  </span>
)}
```

### 4️⃣ **REFONTE D'ACTIVEMISSION.TSX**

#### Sections à ajouter :

1. **Détection et enrichissement au chargement**
   - Parser les items de la commande
   - Détecter les magasins multiples
   - Enrichir avec les infos GPS de la table `stores`

2. **Section "Magasins à visiter"**
   - Liste de tous les magasins
   - Pour chaque magasin :
     - Nom
     - Coordonnées GPS
     - Bouton "Ouvrir Maps"
     - Liste des items à récupérer

3. **Section "Items par magasin"**
   - Groupement visuel par magasin
   - Affichage des quantités et notes

#### Structure UI proposée :
```tsx
{/* MAGASINS À VISITER */}
{order.multiStoreData?.isMultiStore && (
  <div className="stores-section">
    <h3>🏪 MAGASINS À VISITER ({order.multiStoreData.storeCount})</h3>
    {order.multiStoreData.storeGroups.map((group, idx) => (
      <div key={idx} className="store-card">
        <div className="store-header">
          <span>{idx + 1}️⃣ {group.storeName}</span>
          <span>{group.totalItems} items</span>
        </div>
        {group.storeInfo && (
          <div className="store-location">
            📍 {group.storeInfo.lat}, {group.storeInfo.lng}
            <button onClick={() => handleNavigate(
              group.storeName, 
              group.storeInfo.lat, 
              group.storeInfo.lng
            )}>
              🗺️ OUVRIR MAPS
            </button>
          </div>
        )}
        <div className="items-list">
          {group.items.map((item, i) => (
            <div key={i} className="item-row">
              {item.quantity}x {item.productName} ({item.price} DH)
              {item.note && <p>📝 {item.note}</p>}
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
)}
```

### 5️⃣ **COMPATIBILITÉ AVEC L'ANCIEN SYSTÈME**

Pour les commandes mono-magasin existantes :
- Si `order.items` est vide ou null → utiliser `order.store_name` (ancien système)
- Si `order.items` contient un seul magasin → affichage simple
- Si `order.items` contient plusieurs magasins → affichage multi-magasins

#### Fonction de détection universelle :
```typescript
function getOrderStoreData(order: any): MultiStoreDetection {
  // Essayer avec order.items
  if (order.items && Array.isArray(order.items) && order.items.length > 0) {
    return detectMultiStores(order.items);
  }
  
  // Fallback : ancien système (order.store_name)
  if (order.store_name) {
    return {
      isMultiStore: false,
      storeCount: 1,
      storeNames: [order.store_name],
      storeGroups: [{
        storeName: order.store_name,
        items: [],
        totalItems: 0
      }]
    };
  }
  
  // Aucune donnée
  return {
    isMultiStore: false,
    storeCount: 0,
    storeNames: [],
    storeGroups: []
  };
}
```

## 📱 COMPOSANTS UI À CRÉER

### 1. `StoreGroupCard.tsx`
Badge de magasin avec localisation et bouton Maps

### 2. `MultiStoreTimeline.tsx`
Checklist visuelle des magasins à visiter

### 3. `ItemsByStoreList.tsx`
Liste groupée des produits par magasin

## 🎨 AMÉLIORATIONS UX SUGGÉRÉES

### Carte Interactive (Phase 2 - Optionnel)
- Afficher tous les points (magasins + client) sur une carte
- Tracer l'itinéraire optimal
- Indication des distances et temps estimés

### Checklist de Récupération
```tsx
<div className="checklist">
  {storeGroups.map(group => (
    <div className="checklist-item">
      ☐ {group.storeName} ({group.totalItems} items)
    </div>
  ))}
  ☐ LIVRAISON CLIENT
</div>
```

## ✅ CHECKLIST DE MISE EN ŒUVRE

### Phase 1 : Backend Preparation
- [ ] Vérifier que `order_items` contient bien `store_name` pour chaque item
- [ ] S'assurer que la table `stores` a `lat`, `lng`, `maps_url`

### Phase 2 : Types et Services
- [ ] Mettre à jour `types.ts` avec les nouvelles interfaces
- [ ] Créer `services/multiStoreService.ts`
- [ ] Tester les fonctions de détection

### Phase 3 : Interface Home
- [ ] Ajouter badge multi-magasins dans `Home.tsx`
- [ ] Tester affichage liste des missions

### Phase 4 : Interface ActiveMission
- [ ] Ajouter section "Magasins à visiter"
- [ ] Ajouter groupement des items par magasin
- [ ] Enrichir avec GPS depuis table `stores`
- [ ] Tester navigation Maps

### Phase 5 : Tests
- [ ] Test commande 1 magasin (ancien système)
- [ ] Test commande 1 magasin (nouveau système)
- [ ] Test commande 2 magasins
- [ ] Test commande 5+ magasins
- [ ] Test sans données GPS
- [ ] Test navigation Maps

## 🚀 PRIORITÉS

1. **HAUTE** : Détection multi-magasins et affichage basique
2. **MOYENNE** : Enrichissement GPS et boutons Maps
3. **BASSE** : Carte interactive et optimisation d'itinéraire

## 📝 NOTES IMPORTANTES

- **CONSERVER** toutes les fonctionnalités actuelles
- **NE PAS CASSER** la compatibilité avec les anciennes commandes
- **TESTER** systématiquement chaque modification
- **DOCUMENTER** les changements pour maintenance future

---

**Date de création** : 2026-02-14
**Version** : 1.0
**Statut** : En cours d'implémentation
