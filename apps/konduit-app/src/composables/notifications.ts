import * as logs from "./notifications/logs";
import { useRouter, type RouteLocationRaw, type Router } from "vue-router";
import { type Plugin, type App } from "vue";
import { useToast, TYPE, type ToastInterface } from "vue-toastification";

export function useNotifications(_router: Router | null = null, _toast: ToastInterface | null = null) {
  const router: Router = (() => {
    if(_router) return _router;
    return useRouter();
  })();
  const toast: ToastInterface = (() => {
    if(_toast) return _toast;
    return useToast();
  })();
  function success(message: string) {
    logs.archive(message, 'success');
    toast(message, {
        type: TYPE.SUCCESS
    });
  }

  function redirectSuccess(message: string, route: RouteLocationRaw) {
    logs.push(message, 'success');
    router.push(route);
  }

  function warn(message: string) {
    logs.archive(message, 'warning');
    toast(message, {
        type: TYPE.WARNING
    });
  }

  function redirectWarn(message: string, route: RouteLocationRaw) {
    logs.push(message, 'warning');
    router.push(route);
  }

  function error(message: string) {
    logs.archive(message, 'error');
    toast(message, {
        type: TYPE.ERROR
    });
  }

  function redirectError(message: string, route: RouteLocationRaw) {
    logs.push(message, 'error');
    router.push(route);
  }

  function info(message: string) {
    logs.archive(message, 'info');
    toast(message, {
        type: TYPE.INFO
    });
  }

  function redirectInfo(message: string, route: RouteLocationRaw) {
    logs.push(message, 'info');
    router.push(route);
  }

  return {
    success,
    redirectSuccess,
    warn,
    redirectWarn,
    error,
    redirectError,
    info,
    redirectInfo
  };
}


export const Notifications: Plugin = {
  install(app: App) {
    // Dependency checks (optional but good practice)
    if (!app.config.globalProperties.$router) {
      throw new Error('NotificationsPlugin requires Vue Router to be installed first.');
    }
    const router = app.config.globalProperties.$router as Router;

    // Not sure why I can not access the toast instance this way
    // if (!app.config.globalProperties.$toast) { // Assuming Toast adds this; adjust if needed
    //   console.log(app.config.globalProperties);
    //   throw new Error('NotificationsPlugin requires Vue Toastification to be installed first.');
    // }
    // Workaround:
    const toast = useToast();

    router.afterEach((_to, _from) => {
      while (!logs.isEmpty()) {
        const entry = logs.pop();
        if (entry) {
          let toastType: TYPE;
          switch (entry.type) {
            case 'success':
              toastType = TYPE.SUCCESS;
              break;
            case 'warning':
              toastType = TYPE.WARNING;
              break;
            case 'error':
              toastType = TYPE.ERROR;
              break;
            case 'debug':
              toastType = TYPE.DEFAULT;
              break;
            case 'info':
            default:
              toastType = TYPE.INFO;
              break;
          }
          toast(entry.message, {
            type: toastType
          });
        }
      }
    });
    const notifications = useNotifications(router, toast);

    // Optional: Provide the composable for injection (e.g., inject('notifications') in components)
    app.provide('notifications', notifications);

    // Optional: Add global method, e.g., this.$notify.success(msg) in components
    app.config.globalProperties.$notify = notifications;
  },
};

