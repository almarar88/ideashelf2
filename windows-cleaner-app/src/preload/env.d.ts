import type { CleanShelfApi } from './index'

declare global {
  interface Window {
    api: CleanShelfApi
  }
}
