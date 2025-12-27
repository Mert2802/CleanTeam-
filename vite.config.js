import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig(({ command }) => {
  const useHttps = command === 'serve' && process.env.VITE_DEV_HTTPS === 'true'

  return {
    base: command === 'serve' ? '/' : '/CleanTeam-/',
    plugins: [react(), ...(useHttps ? [basicSsl()] : [])],
    server: {
      https: useHttps,
      host: true,
    },
  }
})
