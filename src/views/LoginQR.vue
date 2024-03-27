<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>Welcome to SmartCare!</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="background" :fullscreen="true">
      <ion-col style="justify-content: center; align-items: center">
        <ion-row style="justify-content: center">
          <img
            src="../images/QrcodeImage.jpg"
            alt="qrcode"
            style="padding: 5%; border-radius: 30px"
          />
        </ion-row>
        <ion-card>
          <ion-row style="justify-content: center"
            ><ion-text style="padding-top: 5%"
              >Press the button below to scan QR-Code</ion-text
            ></ion-row
          >
          <ion-row
            style="margin-top: 10%; margin-bottom: 10%; justify-content: center"
          >
            <ion-button
              style="width: 200px"
              @click="loginFunc"
              v-show="!scannerActive"
              ><ion-icon slot="start" :icon="cameraOutline"></ion-icon>Open
              Camera</ion-button
            >
            <ion-button @click="stopLoginFunc" v-show="scannerActive"
              >Hide Scanner</ion-button
            >
          </ion-row>
          <ion-row style="justify-content: center">
            <ion-toast
              :is-open="isOpen"
              :message="errorMessage"
              :duration="5000"
              @didDismiss="setOpen(false)"
            >
            </ion-toast>
          </ion-row>
        </ion-card>
      </ion-col>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonImg,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonRow,
  IonCol,
  IonText,
  IonIcon,
  IonToast,
  IonCard,
} from "@ionic/vue";
import { BarcodeScanner } from "@capacitor-community/barcode-scanner";
import { onMounted, ref } from "vue";
import router from "@/router";
import { authenticateUser, reAuthenticateUser } from "@/Network/api";
import { Preferences } from "@capacitor/preferences";
import { cameraOutline } from "ionicons/icons";

const scannerActive = ref(false);
const errorMessage = ref("");
const isOpen = ref(false);
const setOpen = (state: boolean) => {
  isOpen.value = state;
};

onMounted(async () => {
  const { value } = await Preferences.get({ key: "authToken" });

  if (value) {
    const authResponse = await reAuthenticateUser(value);
    if (authResponse.success) {
      console.log(value);
      await router.push("/home");
    } else {
      await Preferences.remove({ key: "authToken" });
    }
  }
});

const loginFunc = async () => {
  console.log("Preparing for login");

  const status = await BarcodeScanner.checkPermission({ force: true });
  if (status.granted) {
    document.body.classList.add("scanner-active");
    scannerActive.value = true;
    try {
      await BarcodeScanner.hideBackground();
      const result = await BarcodeScanner.startScan();

      if (result.hasContent) {
        console.log(`QR Content: ${result.content}`);
        const authResponse = await authenticateUser(result.content);
        if (authResponse.success) {
          await router.push("/home");
        } else {
          errorMessage.value = authResponse.message;
        }
      } else {
        console.log("No QR content detected");
      }
    } catch (error) {
      console.error("An error occurred during the scan", error);
      errorMessage.value = "An error occurred. Please try again";
      setOpen(true);
    } finally {
      scannerActive.value = false;
      document.body.classList.remove("scanner-active");
      await BarcodeScanner.showBackground();
      await BarcodeScanner.stopScan();
    }
  } else {
    console.log("Camera Permission Denied");
    errorMessage.value = "Camera permission was denied by user";
    setOpen(true);
  }
};

const stopLoginFunc = async () => {
  scannerActive.value = false;
  document.body.classList.remove("scanner-active");
  await BarcodeScanner.showBackground();
  await BarcodeScanner.stopScan();
};
</script>

<style>
ion-content {
  --background: #faf9f5;
}
ion-list {
  --background: #faf9f5;
}
ion-card {
  --background: #ffffff;
  --color: #3e3e41;
}

ion-button {
  --background: #3e3e41;
  --color: #faf9f5;
}

ion-page {
  --background: #faf9f5;
}
</style>
