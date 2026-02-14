# 🧪 DONNÉES DE TEST - SYSTÈME MULTI-MAGASINS

## 🎯 Objectif
Ce fichier contient des données de test prêtes à l'emploi pour tester le système multi-magasins dans l'application livreur.

---

## 📦 TEST 1 : Commande 2 Magasins (Pizza + Pharmacie)

### JSON à insérer dans `orders.items`
```json
[
  {
    "productName": "Pizza Margherita",
    "storeName": "Pizza House",
    "quantity": 1,
    "price": 50,
    "note": "Bien cuite, sans oignons",
    "image_base64": null
  },
  {
    "productName": "Coca Cola 33cl",
    "storeName": "Pizza House",
    "quantity": 2,
    "price": 10,
    "note": null,
    "image_base64": null
  },
  {
    "productName": "Doliprane 1000mg",
    "storeName": "Pharmacie Al Amal",
    "quantity": 1,
    "price": 15,
    "note": null,
    "image_base64": null
  },
  {
    "productName": "Masques FFP2",
    "storeName": "Pharmacie Al Amal",
    "quantity": 1,
    "price": 25,
    "note": "Boîte de 10",
    "image_base64": null
  }
]
```

### SQL d'insertion (Supabase)
```sql
-- Créer la commande
INSERT INTO orders (
  customer_name,
  phone,
  delivery_lat,
  delivery_lng,
  total_products,
  delivery_fee,
  total_final,
  payment_method,
  status,
  assigned_driver_id,
  items,
  store_name,
  category_name
) VALUES (
  'Ahmed Mohamed',
  '+212612345678',
  34.265,
  -6.585,
  100,
  15,
  115,
  'cash',
  'assigned',
  'DRIVER_ID_ICI', -- Remplacer par l'ID du livreur
  '[
    {"productName":"Pizza Margherita","storeName":"Pizza House","quantity":1,"price":50,"note":"Bien cuite"},
    {"productName":"Coca Cola 33cl","storeName":"Pizza House","quantity":2,"price":10},
    {"productName":"Doliprane 1000mg","storeName":"Pharmacie Al Amal","quantity":1,"price":15},
    {"productName":"Masques FFP2","storeName":"Pharmacie Al Amal","quantity":1,"price":25,"note":"Boîte de 10"}
  ]'::jsonb,
  'MULTI', -- Pour compatibilité
  'food'
);
```

### Résultat Attendu
- **Home** : Badge "🏪 2 MAGASINS"
- **ActiveMission** : 
  - Card 1 : Pizza House (2 items, 70 DH)
  - Card 2 : Pharmacie Al Amal (2 items, 40 DH)

---

## 📦 TEST 2 : Commande 3 Magasins (Restaurant + Supermarché + Pharmacie)

### JSON
```json
[
  {
    "productName": "Tacos Poulet",
    "storeName": "FastFood Express",
    "quantity": 2,
    "price": 35,
    "note": "Sauce blanche",
    "image_base64": null
  },
  {
    "productName": "Lait 1L",
    "storeName": "Carrefour Market",
    "quantity": 3,
    "price": 8,
    "note": null,
    "image_base64": null
  },
  {
    "productName": "Pain de mie",
    "storeName": "Carrefour Market",
    "quantity": 1,
    "price": 12,
    "note": null,
    "image_base64": null
  },
  {
    "productName": "Amoxicilline",
    "storeName": "Pharmacie Centrale",
    "quantity": 1,
    "price": 45,
    "note": "Avec ordonnance",
    "image_base64": null
  }
]
```

### SQL
```sql
INSERT INTO orders (
  customer_name,
  phone,
  delivery_lat,
  delivery_lng,
  total_products,
  delivery_fee,
  total_final,
  payment_method,
  status,
  assigned_driver_id,
  items
) VALUES (
  'Fatima Zahra',
  '+212623456789',
  34.270,
  -6.590,
  131,
  20,
  151,
  'transfer',
  'assigned',
  'DRIVER_ID_ICI',
  '[
    {"productName":"Tacos Poulet","storeName":"FastFood Express","quantity":2,"price":35,"note":"Sauce blanche"},
    {"productName":"Lait 1L","storeName":"Carrefour Market","quantity":3,"price":8},
    {"productName":"Pain de mie","storeName":"Carrefour Market","quantity":1,"price":12},
    {"productName":"Amoxicilline","storeName":"Pharmacie Centrale","quantity":1,"price":45,"note":"Avec ordonnance"}
  ]'::jsonb
);
```

### Résultat Attendu
- **Home** : Badge "🏪 3 MAGASINS"
- **ActiveMission** : 
  - Card 1 : FastFood Express (1 item, 70 DH)
  - Card 2 : Carrefour Market (2 items, 36 DH)
  - Card 3 : Pharmacie Centrale (1 item, 45 DH)

---

## 📦 TEST 3 : Commande Mono-Magasin (Vérification compatibilité)

### JSON
```json
[
  {
    "productName": "Pizza 4 Fromages",
    "storeName": "Pizza House",
    "quantity": 1,
    "price": 60,
    "note": null,
    "image_base64": null
  },
  {
    "productName": "Salade César",
    "storeName": "Pizza House",
    "quantity": 1,
    "price": 30,
    "note": "Sans croûtons",
    "image_base64": null
  }
]
```

### SQL
```sql
INSERT INTO orders (
  customer_name,
  phone,
  delivery_lat,
  delivery_lng,
  total_products,
  delivery_fee,
  total_final,
  payment_method,
  status,
  assigned_driver_id,
  items,
  store_name
) VALUES (
  'Youssef Alami',
  '+212634567890',
  34.255,
  -6.575,
  90,
  15,
  105,
  'cash',
  'assigned',
  'DRIVER_ID_ICI',
  '[
    {"productName":"Pizza 4 Fromages","storeName":"Pizza House","quantity":1,"price":60},
    {"productName":"Salade César","storeName":"Pizza House","quantity":1,"price":30,"note":"Sans croûtons"}
  ]'::jsonb,
  'Pizza House'
);
```

### Résultat Attendu
- **Home** : PAS de badge multi-magasins (1 seul magasin)
- **ActiveMission** : Section multi-magasins CACHÉE

---

## 📦 TEST 4 : Commande 5 Magasins (Stress Test)

### JSON
```json
[
  {"productName":"Burger","storeName":"McDonald's","quantity":1,"price":40},
  {"productName":"Sushi","storeName":"Tokyo Sushi","quantity":1,"price":80},
  {"productName":"Pain","storeName":"Boulangerie","quantity":2,"price":5},
  {"productName":"Jus d'orange","storeName":"Marjane","quantity":1,"price":15},
  {"productName":"Paracetamol","storeName":"Pharmacie","quantity":1,"price":10}
]
```

### Résultat Attendu
- **Home** : Badge "🏪 5 MAGASINS"
- **ActiveMission** : 5 cartes affichées avec numérotation 1 à 5

---

## 🗄️ VÉRIFIER LES MAGASINS DANS LA BASE

### SQL pour s'assurer que les magasins ont des coordonnées GPS
```sql
-- Vérifier l'existence des magasins de test
SELECT name, lat, lng, maps_url 
FROM stores 
WHERE name IN (
  'Pizza House',
  'Pharmacie Al Amal',
  'FastFood Express',
  'Carrefour Market',
  'Pharmacie Centrale',
  'McDonald''s',
  'Tokyo Sushi',
  'Boulangerie',
  'Marjane',
  'Pharmacie'
);
```

### Si un magasin n'existe pas, l'ajouter :
```sql
-- Exemple : Ajouter Pizza House
INSERT INTO stores (name, category_id, lat, lng, maps_url) 
VALUES (
  'Pizza House',
  'food',
  34.261,
  -6.580,
  'https://www.google.com/maps?q=34.261,-6.580'
);

-- Exemple : Ajouter Pharmacie Al Amal
INSERT INTO stores (name, category_id, lat, lng, maps_url) 
VALUES (
  'Pharmacie Al Amal',
  'pharmacy',
  34.252,
  -6.572,
  'https://www.google.com/maps?q=34.252,-6.572'
);
```

---

## 🧹 NETTOYER LES TESTS

### Supprimer toutes les commandes de test
```sql
DELETE FROM orders WHERE customer_name IN (
  'Ahmed Mohamed',
  'Fatima Zahra',
  'Youssef Alami'
);
```

---

## ✅ CHECKLIST DE TEST

Après avoir inséré les données de test :

### Test 1 : Interface Home
- [ ] Les commandes multi-magasins affichent le badge "🏪 X MAGASINS"
- [ ] Le badge est de couleur bleue
- [ ] Les commandes mono-magasin n'affichent PAS le badge
- [ ] Le nombre de magasins est correct

### Test 2 : Interface ActiveMission
- [ ] La section "MULTI-MAGASINS" apparaît seulement pour commandes multi-magasins
- [ ] Tous les magasins sont listés avec numérotation correcte
- [ ] Les items sont bien groupés par magasin
- [ ] Les prix sont calculés correctement
- [ ] Les coordonnées GPS s'affichent si disponibles
- [ ] Les notes spécifiques aux items s'affichent

### Test 3 : Navigation
- [ ] Bouton Maps de chaque magasin ouvre Google Maps
- [ ] Bouton Itinéraire optimisé (🗺️) ouvre Maps avec waypoints
- [ ] Les coordonnées GPS sont utilisées si disponibles
- [ ] Fallback sur le nom du magasin si pas de GPS

### Test 4 : Performance
- [ ] Chargement rapide même avec 5+ magasins
- [ ] Pas d'erreurs dans la console
- [ ] Interface fluide sans lag

---

## 📱 TESTER SUR L'APK

1. **Build l'APK** :
   ```bash
   npm run build
   npx cap sync
   npx cap open android
   ```

2. **Installer sur device** (Android Studio)

3. **Se connecter** avec compte livreur

4. **Vérifier** que les commandes de test apparaissent

5. **Tester** toutes les fonctionnalités

---

**Date** : 2026-02-14  
**Version** : Test Data v1.0  
**Prêt pour** : Tests utilisateurs
