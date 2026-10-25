import type { App, ComputedRef } from 'vue'
import { ref, computed, isRef } from 'vue'
import { useRouter, type RouteLocationRaw, type Router } from 'vue-router'

const historyStack = ref<string[]>([])
let installed = false

export const appBackPlugin = {
  install(app: App) {
    if (installed) return
    installed = true

    const router = app.config.globalProperties.$router as Router | undefined
    if (!router) {
      console.warn('appBackPlugin: Router not found on app instance')
      return
    }

    router.afterEach((to, from) => {
      if (to.fullPath !== from.fullPath) {
        historyStack.value.push(from.fullPath)
        if (historyStack.value.length > 20) historyStack.value.shift()
      }
    })

    window.addEventListener('popstate', () => {
      if (historyStack.value.length) historyStack.value.pop()
    })
  }
}

const isExternal = (to: RouteLocationRaw): boolean =>
  typeof to === 'string' && /^https?:\/\//i.test(to)

export type AppBack = {
  handleClick: (e: MouseEvent) => void;
  href: ComputedRef<string>;
  goBack: () => void;
}

export function useAppBack(
  fallback: RouteLocationRaw | null | ComputedRef<RouteLocationRaw | null> = null
): AppBack {
  const router = useRouter()
  if (!router) {
    throw new Error('useAppBack() must be called inside <script setup> after router is installed')
  }

  const fallbackRef = computed(() => isRef(fallback) ? fallback.value : fallback);

  const goBack = () => {
    if (fallbackRef.value === null || historyStack.value.length > 0) {
      router.back()
    } else if (isExternal(fallbackRef.value)) {
      window.location.assign(fallbackRef.value as string)
    } else {
      router.push(fallbackRef.value)
    }
  };

  const handleClick = (e: MouseEvent) => {
    e.preventDefault()
    goBack();
  }

  const href = computed((): string => {
    if (historyStack.value.length > 0) {
      return historyStack.value[historyStack.value.length - 1]!;
    }
    const fb = fallbackRef.value
    if (fb === null) return '#'
    return isExternal(fb) ? (fb as string) : router.resolve(fb).href
  })

  return { goBack, handleClick, href }
}

