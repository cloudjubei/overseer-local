/*
Generic Fetch JSON provider
- Supports dynamic services configured with a URL (service.config.url)
- Fetches JSON and stores it. Useful for future-proof expansion without wiring code.
*/

import https from 'https'
import http from 'http'

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    try {
      const lib = url.startsWith('https') ? https : http
      const req = lib.get(url, (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}`))
          res.resume()
          return
        }
        let data = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            resolve(parsed)
          } catch (e) {
            reject(e)
          }
        })
      })
      req.on('error', reject)
    } catch (e) {
      reject(e)
    }
  })
}

export function createFetchJsonProvider(store) {
  return {
    id: 'fetch-json',
    update: async (service) => {
      const url = service?.config?.url
      if (!url) throw new Error('Missing service.config.url')
      const data = await fetchJson(url)
      store.setServiceData(service.id, { updatedAt: new Date().toISOString(), data })
      return true
    },
    getData: async (service) => {
      return store.getServiceData(service.id) || null
    },
  }
}
