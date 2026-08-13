const { initAuthCreds, BufferJSON, makeCacheableSignalKeyStore, proto } = require('@whiskeysockets/baileys');
const pino = require('pino');

async function useSupabaseAuthState(supabase, sessionName) {
    const logger = pino({ level: 'silent' });
    
    const writeData = async (data, key) => {
        try {
            const jsonString = JSON.stringify(data, BufferJSON.replacer);
            const { error } = await supabase.from('baileys_auth_state').upsert(
                { session: sessionName, key: key, data: JSON.parse(jsonString) },
                { onConflict: 'session, key' }
            );
            if (error) console.error(`[supabaseAuthState] Error saving ${key}:`, error);
        } catch (e) {
            console.error(`[supabaseAuthState] Error serializing ${key}:`, e);
        }
    };

    const readData = async (key) => {
        try {
            const { data, error } = await supabase.from('baileys_auth_state')
                .select('data')
                .eq('session', sessionName)
                .eq('key', key)
                .maybeSingle();

            if (error) {
                console.error(`[supabaseAuthState] Error reading ${key}:`, error);
                return null;
            }
            if (data && data.data) {
                // Supabase returns a parsed JSON object. We stringify it back to use BufferJSON.reviver
                return JSON.parse(JSON.stringify(data.data), BufferJSON.reviver);
            }
            return null;
        } catch (e) {
            console.error(`[supabaseAuthState] Error deserializing ${key}:`, e);
            return null;
        }
    };

    const removeData = async (key) => {
        try {
            const { error } = await supabase.from('baileys_auth_state')
                .delete()
                .eq('session', sessionName)
                .eq('key', key);
            if (error) console.error(`[supabaseAuthState] Error deleting ${key}:`, error);
        } catch (e) {
            console.error(`[supabaseAuthState] Error removing ${key}:`, e);
        }
    };

    let creds = await readData('creds');
    if (!creds) {
        creds = initAuthCreds();
        await writeData(creds, 'creds');
    }

    return {
        state: {
            creds,
            keys: makeCacheableSignalKeyStore(
                {
                    get: async (type, ids) => {
                        const data = {};
                        await Promise.all(
                            ids.map(async (id) => {
                                let value = await readData(`${type}-${id}`);
                                if (type === 'app-state-sync-key' && value) {
                                    value = proto.Message.AppStateSyncKeyData.fromObject(value);
                                }
                                data[id] = value;
                            })
                        );
                        return data;
                    },
                    set: async (data) => {
                        const tasks = [];
                        for (const category in data) {
                            for (const id in data[category]) {
                                const value = data[category][id];
                                const key = `${category}-${id}`;
                                if (value) {
                                    tasks.push(writeData(value, key));
                                } else {
                                    tasks.push(removeData(key));
                                }
                            }
                        }
                        await Promise.all(tasks);
                    }
                },
                logger
            )
        },
        saveCreds: () => {
            return writeData(creds, 'creds');
        }
    };
}

module.exports = { useSupabaseAuthState };
