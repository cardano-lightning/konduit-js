<script setup lang="ts">
import Hr from "../components/Hr.vue";
import { SquareDot, SquareArrowOutUpRight } from "lucide-vue-next";
import SquareArrowInUpRight from "../components/icons/SquareArrowInUpRight.vue";
import Card from "../components/Card.vue";
import MainContainer from "../components/MainContainer.vue";
import TheHeader from "../components/TheHeader.vue";
import { useRouter } from "vue-router";

const router = useRouter();
</script>

<template>
  <MainContainer>
    <TheHeader />
    <div id="cards">
      <div id="preamble">Choose how to fund your channel—let's get you set up!</div>
      <Hr />
      <Card
        :action="() => router.push({
          name: 'channel-open-embedded-wallet-top-up',
          query: router.currentRoute.value.query.redirectTo ? { redirectTo: router.currentRoute.value.query.redirectTo } : undefined,
        })"
        :title="'Embedded wallet'"
        :variant="'neutral'"
      >
        <template #icon>
          <SquareArrowInUpRight />
        </template>
        A handy in-app wallet for quick channel management.<br />One extra top up needed and you're ready!
      </Card>
      <Card
        :title="'Browser wallet'"
        :variant="'neutral'"
        :disabled="true"
      >
        <template #icon>
          <SquareDot />
        </template>
        Connect a wallet from this browser for seamless funding.
      </Card>
      <Card
        :title="'External wallet'"
        :variant="'neutral'"
        :disabled="true"
      >
        <template #icon>
          <SquareArrowOutUpRight />
        </template>
        Use external browser wallet via a simple sharing page and fund the channel from there.
      </Card>
    </div>
  </MainContainer>
</template>

<style scoped>
#cards {
  display: flex;
  flex-direction: column;
  gap: var(--data-listing-gap);
}
#preamble {
  text-align: center;
}
</style>

