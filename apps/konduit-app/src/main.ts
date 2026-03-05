import { createApp } from "vue";
import router from "./router";
import App from "./App.vue";
import Toastification from "vue-toastification";
import { Notifications } from "./composables/notifications";

// Application level styles are defined in the `App.vue` file
createApp(App)
  .use(router)
  .use(Toastification, {
    maxToasts: 1,
    newestOnTop: true,
    position: "top-center",
    // Good for styling testing:
    // timeout: 500000,
    toastClassName: "cl-toast",
    // transition: "fade",
    transition: "Vue-Toastification__bounce",
  })
  .use(Notifications)
  .mount('#app');


