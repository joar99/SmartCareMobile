<template>
  <ion-content>
    <ion-text v-if="authSuccess">Authorization successful!</ion-text>
    <ion-text v-else>Authorization failed. Please try again.</ion-text>
  </ion-content>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";

const authSuccess = ref(false);

onMounted(() => {
  const route = useRoute();
  // Assuming the backend sends a success flag or similar indicator
  authSuccess.value = route.query.success === 'true';
})
</script>




<style scoped>

</style>