        // BLE UUIDs from the Arduino code
        const FALL_SERVICE_UUID = '19b10000-0000-537e-4f6c-d104768a1214';
        const FALL_CHARACTERISTIC_UUID = '19b10000-1111-537e-4f6c-d104768a1214';

        // Telegram configuration
        const BOT_TOKEN = '7795056451:AAEeJD6Dg7s1WL2hB8JeSNCMZdtqOZNcMaM';
        const CHAT_ID = '-4600073095'; // We'll add this once you get it
        
        
        let fallCharacteristic = null;
        let device = null;
        let isConnected = false;
        let alarmSound = document.getElementById('alarmSound');
        let soundEnabled = document.getElementById('soundEnabled');

        const connectBtn = document.getElementById('connectBtn');
        const resetAlarmBtn = document.getElementById('resetAlarmBtn');
        const statusDiv = document.getElementById('status');

        connectBtn.addEventListener('click', handleConnectionClick);
        resetAlarmBtn.addEventListener('click', resetAlarm);

       async function sendTelegramAlert(message) {
            // Encode il messaggio per l'URL
            const encodedMessage = encodeURIComponent(message);
            const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodedMessage}&parse_mode=HTML`;
            
            try {
                // Usando l'approccio con URL parameters invece che POST
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.error('Telegram API error:', await response.text());
                    throw new Error('Failed to send Telegram notification');
                }
                
                console.log('Telegram notification sent successfully');
            } catch (error) {
                console.error('Error sending Telegram notification:', error);
            }
        }

        
        async function handleConnectionClick() {
            if (isConnected) {
                await disconnectDevice();
            } else {
                await connectToDevice();
            }
        }

        async function disconnectDevice() {
            if (device && device.gatt.connected) {
                await device.gatt.disconnect();
            }
            stopAlarm();
            handleDisconnection();
        }

        function playAlarm() {
            if (soundEnabled.checked) {
                alarmSound.currentTime = 0;
                alarmSound.play().catch(e => console.log('Audio play failed:', e));
            }
        }

        function stopAlarm() {
            alarmSound.pause();
            alarmSound.currentTime = 0;
        }

        async function connectToDevice() {
            try {
                device = await navigator.bluetooth.requestDevice({
                    filters: [{ name: 'Man Down' }],
                    optionalServices: [FALL_SERVICE_UUID]
                });

                statusDiv.textContent = 'Connecting...';
                
                const server = await device.gatt.connect();
                const service = await server.getPrimaryService(FALL_SERVICE_UUID);
                fallCharacteristic = await service.getCharacteristic(FALL_CHARACTERISTIC_UUID);

                await fallCharacteristic.startNotifications();
                fallCharacteristic.addEventListener('characteristicvaluechanged', handleAlarmChange);

                statusDiv.textContent = 'Status: Connected';
                statusDiv.className = 'connected';
                connectBtn.textContent = 'Disconnect';
                isConnected = true;

                device.addEventListener('gattserverdisconnected', handleDisconnection);

                const connectionMessage = 
`🟢 <b>DISPOSITIVO CONNESSO</b>

⏰ ${new Date().toLocaleString('it-IT')}
✅ Sistema attivo e pronto al monitoraggio`;
        
        await sendTelegramAlert(connectionMessage);
                
            } catch (error) {
                console.error('Error:', error);
                statusDiv.textContent = `Error: ${error.message}`;
                handleDisconnection();
            }
        }

        function handleAlarmChange(event) {
            const value = event.target.value.getUint8(0);
            const timestamp = new Date().toLocaleString('it-IT');
            switch(value) {
                case 0x00:
                    statusDiv.textContent = 'Status: Connected - No Alarm';
                    statusDiv.className = 'connected';
                    resetAlarmBtn.style.display = 'none';
                    stopAlarm();
                    const okMessage = `
✅ <b>La persona sta bene</b> ✅

Il sistema sta monitorando lo stato della persona`;
                    sendTelegramAlert(okMessage);
                    break;
                case 0x01:
                    statusDiv.textContent = 'Status: Fall Detected!';
                    statusDiv.className = 'alarm';
                    resetAlarmBtn.style.display = 'block';
                    playAlarm();
                    const fallMessage = `
🚨 <b>ATTENZIONE: Rilevata Caduta!</b>
                    
⏰ <i>Ora</i>: ${new Date().toLocaleString('it-IT')}
📍 <i>Posizione</i>: Non disponibile
ℹ️ <i>Stato</i>: In attesa di conferma recupero
                    
<i>Il sistema sta monitorando il recupero della persona. Se non viene rilevato un recupero entro 60 secondi, verrà attivato l'allarme di emergenza.</i>`;
                    sendTelegramAlert(fallMessage);
                    break;
                    
                case 0x02:
                    statusDiv.textContent = 'Status: ALARM - MAN DOWN!';
                    statusDiv.className = 'alarm';
                    resetAlarmBtn.style.display = 'none';
                    playAlarm();
                    const emergencyMessage = `
🚨🚨 <b>EMERGENZA GRAVE: PERSONA A TERRA!</b>
                    
⏰ <i>Ora</i>: ${new Date().toLocaleString('it-IT')}
📍 <i>Posizione</i>: Non disponibile
❗️ <i>Stato</i>: Richiesto intervento immediato
                    
La persona non si è rialzata dopo la caduta. È necessario un intervento immediato!`;
                    sendTelegramAlert(emergencyMessage);
                    break;
            }
        }

       async function resetAlarm() {
            if (!fallCharacteristic || !isConnected) {
                console.error('Device not connected');
                statusDiv.textContent = 'Error: Device not connected';
                handleDisconnection();
                return;
            }
        
            try {
                // Invia il comando di reset
                await fallCharacteristic.writeValue(new Uint8Array([0x00]));
                
                // Aggiorna lo stato dell'interfaccia
                statusDiv.textContent = 'Status: Connected - No Alarm';
                statusDiv.className = 'connected';
                resetAlarmBtn.style.display = 'none';
                stopAlarm();
            } catch (error) {
                console.error('Error resetting alarm:', error);
                statusDiv.textContent = `Error: ${error.message}`;
                handleDisconnection();
            }
        }

        function handleDisconnection() {
            stopAlarm();
            const disconnectionMessage =`
🔴 <b>DISPOSITIVO DISCONNESSO</b>

⚠️ Il monitoraggio è stato interrotto`;
            sendTelegramAlert(disconnectionMessage);
            statusDiv.textContent = 'Status: Disconnected';
            statusDiv.className = 'disconnected';
            connectBtn.textContent = 'Connect Device';
            resetAlarmBtn.style.display = 'none';
            isConnected = false;
            fallCharacteristic = null;
            device = null;
        }

        // Check Web Bluetooth API support
        if (!navigator.bluetooth) {
            statusDiv.textContent = 'Web Bluetooth API is not supported in this browser';
            connectBtn.disabled = true;
        }

