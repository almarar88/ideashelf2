import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  // Vite يبحث عن إعداد PostCSS صعودًا في الشجرة، فيلتقط إعداد تطبيق Next.js
  // في جذر المستودع ويطلب حزمة غير مثبّتة هنا. هذا التطبيق يستعمل CSS عاديًا،
  // فنثبّت إعدادًا فارغًا ونوقف البحث.
  css: { postcss: {} },
  build: { outDir: 'dist', emptyOutDir: true },
  server: { port: 5175, strictPort: true },
})
