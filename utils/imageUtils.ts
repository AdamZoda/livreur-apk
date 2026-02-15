
/**
 * Compresse une image Base64 (ou URL) en recalculant sa taille et sa qualité.
 * @param base64Str La chaîne Base64 originale (ou URL blob)
 * @param maxWidth Largeur maximale (défaut 1024px)
 * @param quality Qualité JPEG (0 à 1, défaut 0.7)
 * @returns Une promesse qui résout vers la nouvelle chaîne Base64 compressée
 */
export const compressImage = (base64Str: string, maxWidth = 1024, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Calculer les nouvelles dimensions en gardant le ratio
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error("Impossible de créer le contexte Canvas"));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            // Convertir en JPEG avec la qualité demandée
            // Le format JPEG est beaucoup plus léger que PNG pour les photos
            const newBase64 = canvas.toDataURL('image/jpeg', quality);
            resolve(newBase64);
        };
        img.onerror = (err) => reject(err);
    });
};
