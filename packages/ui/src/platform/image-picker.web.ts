// Web shim to avoid importing expo-image-picker which crashes in Vite without full Expo Web setup
export const MediaTypeOptions = { Images: 'Images' };

export const launchImageLibraryAsync = async (options: any) => {
    console.log("Triggering Web File Picker");
    
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
            const file = e.target.files[0];
            if (file) {
                const uri = URL.createObjectURL(file);
                resolve({
                    canceled: false,
                    assets: [{ uri, file }] // Pass the file object too
                });
            } else {
                resolve({ canceled: true, assets: [] });
            }
        };
        input.click();
    });
};
