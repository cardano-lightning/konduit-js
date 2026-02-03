import { createRouter, createWebHistory } from "vue-router";

import * as store from "./store";

import AddChannelPage from "./views/AddChannelPage.vue";
import CreatePage from "./views/CreatePage.vue";
import EditCardanoConnectorURLPage from "./views/EditCardanoConnectorURLPage.vue";
import HomePage from "./views/HomePage.vue";
import LaunchPage from "./views/LaunchPage.vue";
import PayPage from "./views/PayPage.vue";
import SettingsPage from "./views/SettingsPage.vue";
import WalletPage from "./views/WalletPage.vue";

const routes = [
  { name: "add-channel",
    path: "/add-channel",
    component: AddChannelPage,
    meta: { title: "Add Channel" },
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
    meta: { title: "Cardano Connector" },
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
    meta: { title: "Wallet" },
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
