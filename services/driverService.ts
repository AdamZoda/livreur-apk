
import { supabase } from './supabaseClient';

export const setDriverOffline = async () => {
    const driverId = localStorage.getItem('vta_driver_id');
    const driverPhone = localStorage.getItem('vta_phone');
    const sessionId = localStorage.getItem('vta_session_id');

    if (!driverPhone) return;

    try {
        // 1. Update session end time if exists
        if (sessionId) {
            await supabase
                .from('driver_online_sessions')
                .update({ end_time: new Date().toISOString() })
                .eq('id', sessionId);
            localStorage.removeItem('vta_session_id');
        }

        // 2. Update driver status
        await supabase
            .from('drivers')
            .update({ status: 'offline' })
            .eq('phone', driverPhone);

        // 3. Update local storage
        localStorage.setItem('vta_online', 'false');
        console.log("Driver set to offline successfully");
    } catch (error) {
        console.error("Error setting driver offline:", error);
    }
};
