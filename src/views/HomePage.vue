<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>SmartCare</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <ion-button @click="startScan">Scan for Devices</ion-button>

      <ion-list>
        <ion-item v-for="device in simplifiedDevices" :key="device.id" class="device-item">
          <ion-label>
            <div class="device-info">
              <ion-text>Device: {{ device.name }}</ion-text>
              <ion-text v-if="device.status">Status: Active</ion-text>
              <ion-text v-if="!device.status">Status: Inactive</ion-text>
              <ion-text>Signal Strength: {{ device.signalStrength }}</ion-text>
              <ion-button v-if="device.status" color="danger" @click="haltDataCollection(device.id)">Halt
                Collection</ion-button>
              <ion-button v-if="!device.status" color="primary" @click="startDataCollection(device.id)">Start
                Collection</ion-button>
            </div>
          </ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-page>
</template>


<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { IonButton, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/vue';
import { BleClient, ScanResult } from '@capacitor-community/bluetooth-le';
import axiosInstance from '../axios';

const simplifiedDevices = ref<SimplifiedDevice[]>([]);
const discoveredDevices = ref<ScanResult[]>([]);

const serviceUUIDs = {
  pulseOximeterService: '00001822-0000-1000-8000-00805f9b34fb', //For pulse Oximeter advertising devices
  heartRateService: '0000180d-0000-1000-8000-00805f9b34fb', //For heartrate advertising devices
};


const characteristicUUIDs = {
  oxygenCharacteristic: '00002a5f-0000-1000-8000-00805f9b34fb', // For Pulse Oximeter Service
  heartRateMeasurementCharacteristic: '00002a37-0000-1000-8000-00805f9b34fb', // For Heart Rate Service
};

onMounted(async () => {
  try {
    await BleClient.initialize();
  } catch (error) {
    console.log(error)
  }
});

const startScan = async () => {
  try {
    const scanDuration = 10 * 1000;

    const connectedDevices = simplifiedDevices.value.filter(device => device.status);

    await BleClient.requestLEScan({
      services: [serviceUUIDs.pulseOximeterService, serviceUUIDs.heartRateService],
    }, (result) => {
      const deviceExistsInSimplified = simplifiedDevices.value.find(device => device.id === result.device.deviceId);
      const deviceIsConnected = deviceExistsInSimplified && deviceExistsInSimplified.status;

      if (deviceIsConnected) return;

      const newSimplifiedDevice: SimplifiedDevice = {
        id: result.device.deviceId,
        name: result.localName || result.device.name || "Unknown BLE Device",
        signalStrength: calculateSignalStrength(result.rssi ?? -100),
        status: false
      };

      if (deviceExistsInSimplified) {
        simplifiedDevices.value = simplifiedDevices.value.map(device => device.id === newSimplifiedDevice.id ? newSimplifiedDevice : device);
      } else {
        simplifiedDevices.value.push(newSimplifiedDevice);
      }

      const indexInDiscovered = discoveredDevices.value.findIndex(device => device.device.deviceId === result.device.deviceId);
      if (indexInDiscovered !== -1) {
        discoveredDevices.value[indexInDiscovered] = result;
      } else {
        discoveredDevices.value.push(result);
      }
    });

    setTimeout(async () => {
      await BleClient.stopLEScan();
      connectedDevices.forEach(connectedDevice => {
        if (!simplifiedDevices.value.some(device => device.id === connectedDevice.id)) {
          simplifiedDevices.value.push(connectedDevice);
        }
      });
    }, scanDuration);

  } catch (error) {
    console.error("Error starting BLE scan", error);
  }
};



const startDataCollection = async (deviceId: string) => {
  const device = discoveredDevices.value.find(d => d.device.deviceId === deviceId);
  const simpleDevice = simplifiedDevices.value.find(d => d.id === deviceId);
  if (!device) {
    console.error("Device not found");
    return;
  }

  if (device.device.name) {
    if (!simpleDevice?.status) {
      if (device.device.name.startsWith("Polar H10")) {
        await startPolarH10DataCollection(deviceId);
        markDeviceAsConnected(deviceId)
      } else if (device.device.name.startsWith("Nonin")) {
        await startNoninDataCollection(deviceId);
        markDeviceAsConnected(deviceId)
      } else {
        console.error("Unsupported device type");
      }
    }
  }
};

const startPolarH10DataCollection = async (deviceId: string) => {
  try {
    await BleClient.connect(deviceId);
    await BleClient.startNotifications(
      deviceId,
      serviceUUIDs.heartRateService,
      characteristicUUIDs.heartRateMeasurementCharacteristic,
      (value) => {
        const heartRate = parseHeartRate(value)
        console.log("POLAR:" + heartRate + " Device id:" + deviceId)

        sendHeartRateData(heartRate);

      }
    );
  } catch (error) {
    console.error("Error during Polar H10 data collection", error);
  }
};

function sendHeartRateData(heartrate: number): void {
  const postData = JSON.stringify({
    user_id: 1,
    device_id: 1,
    created_at: new Date().toISOString(),
    heartrate: heartrate,
  });

  axiosInstance.post('heartrates/', postData, {
    headers: {
      "Content-Type": "application/json"
    }
  })
    .then(response => {
      // Handle successful response
      console.log('Heart rate data submitted successfully:', response.data);
    })
    .catch(error => {
      // Handle error
      console.error('Error submitting heart rate data:', error);
    });
}

const startNoninDataCollection = async (deviceId: string) => {
  try {
    await BleClient.connect(deviceId);
    await BleClient.startNotifications(
      deviceId,
      serviceUUIDs.pulseOximeterService,
      characteristicUUIDs.oxygenCharacteristic,
      (value) => {
        const spo2 = parseSFLOAT(value, 1);
        const pulseRate = parseSFLOAT(value, 3);
        console.log(`NONIN: Parsed SpO2: ${spo2.toFixed(1)}%, Pulse Rate: ${pulseRate.toFixed(0)} BPM`);

        sendHeartRateData(pulseRate);
        
      }
    );
  } catch (error) {
    console.error("Error during Nonin data collection", error);
  }
};

const haltDataCollection = async (deviceId: string) => {
  const servicesToCancel = [serviceUUIDs.pulseOximeterService, serviceUUIDs.heartRateService];
  try {
    for (const serviceUUID of servicesToCancel) {
      await BleClient.stopNotifications(deviceId, serviceUUID, characteristicUUIDs.oxygenCharacteristic).catch((e) => console.log(`Service ${serviceUUID} not supported or no subscription found:`, e));
      await BleClient.stopNotifications(deviceId, serviceUUID, characteristicUUIDs.heartRateMeasurementCharacteristic).catch((e) => console.log(`Service ${serviceUUID} not supported or no subscription found:`, e));
    }
    markDeviceAsDisconnected(deviceId)
    console.log(`Data collection halted for device ${deviceId}`);
  } catch (error) {
    console.error(`Error halting data collection for device ${deviceId}:`, error);
  }
};


const parseSFLOAT = (dataView: any, index: number) => {
  const buffer = new Uint8Array(dataView.buffer);
  const exp = buffer[index + 1] >> 4;
  const exponent = exp > 7 ? exp - 16 : exp;

  let mantissa = ((buffer[index + 1] & 0x0F) << 8) | buffer[index];
  if (mantissa >= 0x0800) {
    mantissa = -((0x0FFF + 1) - mantissa);
  }

  return mantissa * Math.pow(10, exponent);
};

const parseHeartRate = (data: DataView): number => {
  const byteArray = new Uint8Array(data.buffer);

  const flags = byteArray[0];
  let index = 1;

  let heartRate: number;
  if (flags & 0x01) {
    heartRate = byteArray[index] | (byteArray[index + 1] << 8);
    index += 2;
  } else {
    heartRate = byteArray[index];
    index += 1;
  }
  return heartRate;
};

const markDeviceAsConnected = (deviceId: string) => {
  simplifiedDevices.value = simplifiedDevices.value.map(device => {
    if (device.id === deviceId) {
      return { ...device, status: true };
    }
    return device;
  });
}

const markDeviceAsDisconnected = (deviceId: string) => {
  simplifiedDevices.value = simplifiedDevices.value.map(device => {
    if (device.id === deviceId) {
      return { ...device, status: false }
    }
    return device;
  })
}


const calculateSignalStrength = (rssi: number): string => {
  if (rssi > -50) {
    return "Strong";
  } else if (rssi > -70) {
    return "Moderate";
  } else {
    return "Weak";
  }
}

interface SimplifiedDevice {
  id: string;
  name: string;
  signalStrength: string;
  status: boolean;
}

</script>

<style>
.device-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  /* Adjust the gap size as needed */
}
</style>





//const HEART_RATE_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
//const BATTERY_SERVICE = '0000180f-0000-1000-8000-00805f9b34fb';
//const HEART_RATE_MEASUREMENT_CHARACTERISTIC = '00002a37-0000-1000-8000-00805f9b34fb';


const onDisconnect = (deviceId: string) => {
console.log(`Device ${deviceId} disconnected`);
};


const startOAuth = () => {
window.location.href = 'https://localhost:8080/auth/polar';
}

const startFitbitAuth = () => {
window.location.href = 'https://localhost:8080/auth/fitbit'
}

const startWithingsAuth = () => {
window.location.href = 'https://localhost:8080/auth/withings'
}
