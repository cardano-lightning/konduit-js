import { createRouter, createWebHistory, type RouteLocationNormalized } from "vue-router";

import * as store from "./store";

import ChannelDetailsPage from "./views/ChannelDetailsPage.vue";
import ChannelListPage from "./views/ChannelListPage.vue";
import ChannelOnChainPage from "./views/ChannelOnChainPage.vue";
import ChannelOpenEmbeddedWalletTopUpPage from "./views/ChannelOpenEmbeddedWalletTopUpPage.vue";
import ChannelOpenWalletSelectPage from "./views/ChannelOpenWalletSelectPage.vue";
import ChannelOpenWithEmbeddedWalletPage from "./views/ChannelOpenWithEmbeddedWalletPage.vue";
import ChannelPaymentsPage from "./views/ChannelPaymentsPage.vue";
import CreatePage from "./views/CreatePage.vue";
import EditCardanoConnectorURLPage from "./views/EditCardanoConnectorURLPage.vue";
import HomePage from "./views/HomePage.vue";
import LaunchPage from "./views/LaunchPage.vue";
import PayPage from "./views/PayPage.vue";
import SettingsPage from "./views/SettingsPage.vue";
import WalletPage from "./views/WalletPage.vue";
import { Channel, ChannelTag } from "@konduit/konduit-consumer/channel";
import { err, ok } from "neverthrow";

const channelRouteProps = (route: RouteLocationNormalized) => ({
  channel: route.meta.channel as Channel,
});

const resolveChannelFromTag = async (to: RouteLocationNormalized) => {
  const urlTag: string | string[] | undefined = to.params.tag;
  const possibleChannel: Channel | null = typeof urlTag !== "string"
    ? null
    : ChannelTag.jsonCodec
        .deserialise(urlTag)
        .andThen((channelTag) => {
          const possibleChannel = store.channels.value.find((c: Channel) =>
            ChannelTag.ord.areEqual(c.channelTag, channelTag),
          );
          if (!possibleChannel) return err(`No channel found with tag ${urlTag}`);
          return ok(possibleChannel);
        })
        .match(
          (channel) => channel,
          (_err) => null,
        );

  if (possibleChannel === null)
    return "/channels"; // or { name: 'channels-list' }

  // Attach the fully resolved object — view will receive it directly
  to.meta.channel = possibleChannel;
  return true;
};

const routes = [
  {
    name: "channel-list",
    path: "/channels",
    component: ChannelListPage,
    meta: { title: "Channels" },
  },
  { name: "channel-open-wallet-select",
    path: "/channels/open-channel/wallet-selection",
    component: ChannelOpenWalletSelectPage,
    meta: { title: "Funding Wallet" },
  },
  { name: "channel-open-embedded-wallet-top-up",
    path: "/channels/open-channel/embedded-wallet/top-up",
    component: ChannelOpenEmbeddedWalletTopUpPage,
    meta: { title: "Embedded wallet" },
  },
  { name: "channel-open-with-embedded-wallet",
    path: "/channels/open-channel/embedded-wallet",
    component: ChannelOpenWithEmbeddedWalletPage,
    meta: { title: "Open channel" },
  },
  {
    name: "channel-details",
    path: "/channels/:tag",
    props: channelRouteProps,
    beforeEnter: resolveChannelFromTag,
    component: ChannelDetailsPage,
    meta: { title: "Channel" },
  },
  {
    name: "channel-payments",
    path: "/channels/:tag/payments",
    props: channelRouteProps,
    beforeEnter: resolveChannelFromTag,
    component: ChannelPaymentsPage,
    meta: { title: "History" },
  },
  {
    name: "channel-on-chain",
    path: "/channels/:tag/on-chain",
    props: channelRouteProps,
    beforeEnter: resolveChannelFromTag,
    component: ChannelOnChainPage,
    meta: { title: "On-chain" },
  },
  {
    name: "create",
    path: "/create",
    component: CreatePage,
    meta: { title: "Create" },
  },
  {
    name: "edit-cardano-connector-url",
    path: "/settings/edit/cardano-connector-url",
    component: EditCardanoConnectorURLPage,
    meta: { title: "Cardano connector" },
  },
  {
    name: "home",
    path: "/",
    component: HomePage,
    meta: { title: "Konduit" },
  },
  {
    name: "launch",
    path: "/launch",
    component: LaunchPage,
    meta: { title: "Launch" },
  },
  {
    name: "pay",
    path: "/pay",
    component: PayPage,
    meta: { title: "Pay" },
  },
  {
    name: "settings",
    path: "/settings",
    component: SettingsPage,
    meta: { title: "Settings" },
  },
  {
    name: "wallet",
    path: "/wallet",
    component: WalletPage,
    meta: { title: "Embedded wallet" },
  }
];

const router = createRouter({
  history: createWebHistory(
    // @ts-ignore
    import.meta.env.BASE_URL || "http://localhost:5173/",
  ),
  routes,
});

router.beforeEach(async (to, _from) => {
  let initResult = await store.init();
  if (initResult.isErr()) {
    console.error(`Failed to initialize store in router.beforeEach: ${initResult.error}`);
  }

  let launchRouteNames = ["launch", "create"];
  console.log(`Routing to ${to.name as string}, hasWallet: ${store.hasWallet.value}`);
  if (!store.hasWallet.value && !launchRouteNames.includes(to.name as string)) {
    return { name: "launch" }
  }
})

export default router;
