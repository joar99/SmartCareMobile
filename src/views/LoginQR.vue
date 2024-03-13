<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>Welcome To SmartCare</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <ion-button @click="loginFunc" v-show="!scannerActive">Scan QR Code For Login</ion-button>
      <ion-button @click="stopLoginFunc" v-show="scannerActive">Hide Scanner</ion-button>

      <ion-text v-if="errorMessage">{{errorMessage}}</ion-text>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {IonButton, IonContent, IonHeader, IonPage, IonTitle, IonToolbar} from "@ionic/vue";
import {BarcodeScanner} from "@capacitor-community/barcode-scanner";
import {onMounted, ref} from "vue";
import router from "@/router";
import {authenticateUser, reAuthenticateUser} from "@/Network/api";
import {Preferences} from "@capacitor/preferences";



const scannerActive = ref(false);
const errorMessage = ref('');

onMounted(async () => {
  const { value } = await Preferences.get({ key: 'authToken' });

  if (value) {
    const authResponse = await reAuthenticateUser(value);
    if (authResponse.success) {
      console.log(value)
      await router.push('/home');
    } else {
      await Preferences.remove({ key: 'authToken' });
    }
  }
});


const loginFunc = async () => {
  console.log("Preparing for login");

  const status = await BarcodeScanner.checkPermission({ force: true });
  if (status.granted) {
    document.body.classList.add('scanner-active');
    scannerActive.value = true;
    try {
      await BarcodeScanner.hideBackground();
      const result = await BarcodeScanner.startScan();

      if (result.hasContent) {
        console.log(`QR Content: ${result.content}`);
        const authResponse = await authenticateUser(result.content)
        if (authResponse.success) {
          await router.push('/home')
        } else {
          errorMessage.value = authResponse.message
        }
      } else {
        console.log("No QR content detected");
      }
    } catch (error) {
      console.error("An error occurred during the scan", error);
      errorMessage.value = 'An error occurred. Please try again';
    } finally {
      scannerActive.value = false;
      document.body.classList.remove('scanner-active');
      await BarcodeScanner.showBackground();
      await BarcodeScanner.stopScan();
    }
  } else {
    console.log("Camera Permission Denied");
    errorMessage.value = 'Camera Permission Was Denied By User'
  }
};

const stopLoginFunc = async () => {
  scannerActive.value = false
  document.body.classList.remove('scanner-active');
  await BarcodeScanner.showBackground();
  await BarcodeScanner.stopScan();
}


</script>

<style scoped>

</style>