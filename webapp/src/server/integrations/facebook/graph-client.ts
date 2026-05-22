import axios from 'axios'

const FACEBOOK_GRAPH_VERSION = 'v19.0'
const FACEBOOK_GRAPH_BASE_URL = `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}`

export function graphUrl(path: string): string {
  const normalized = path.startsWith('/') ? path.slice(1) : path
  return `${FACEBOOK_GRAPH_BASE_URL}/${normalized}`
}

export async function graphGet<T>(path: string, params: Record<string, string | number | boolean>) {
  return axios.get<T>(graphUrl(path), { params })
}

export async function graphDelete(path: string, params: Record<string, string | number | boolean>) {
  return axios.delete(graphUrl(path), { params })
}

export { FACEBOOK_GRAPH_VERSION }
