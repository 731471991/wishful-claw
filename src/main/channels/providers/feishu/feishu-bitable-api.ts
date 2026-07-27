import { request } from './feishu-http'

/** Auth headers provider — returns { Authorization: 'Bearer xxx' } */
export type AuthHeadersProvider = () => Promise<Record<string, string>>

/**
 * Feishu Bitable (多维表格) API client.
 * Extracted from FeishuApi for single-responsibility.
 */
export class FeishuBitableApi {
  constructor(private authHeaders: AuthHeadersProvider) {}

  async listApps(pageSize = 50, pageToken?: string): Promise<unknown> {
    const headers = await this.authHeaders()
    const tokenParam = pageToken ? `&page_token=${encodeURIComponent(pageToken)}` : ''
    const res = await request(
      'GET',
      `/open-apis/bitable/v1/apps?page_size=${pageSize}${tokenParam}`,
      headers
    )
    const data = JSON.parse(res.body)
    if (data.code !== 0) {
      throw new Error(`Feishu listBitableApps failed: ${data.msg}`)
    }
    return data.data
  }

  async listTables(appToken: string, pageSize = 100, pageToken?: string): Promise<unknown> {
    const headers = await this.authHeaders()
    const tokenParam = pageToken ? `&page_token=${encodeURIComponent(pageToken)}` : ''
    const encoded = encodeURIComponent(appToken)
    const res = await request(
      'GET',
      `/open-apis/bitable/v1/apps/${encoded}/tables?page_size=${pageSize}${tokenParam}`,
      headers
    )
    const data = JSON.parse(res.body)
    if (data.code !== 0) {
      throw new Error(`Feishu listBitableTables failed: ${data.msg}`)
    }
    return data.data
  }

  async listFields(
    appToken: string,
    tableId: string,
    pageSize = 200,
    pageToken?: string
  ): Promise<unknown> {
    const headers = await this.authHeaders()
    const tokenParam = pageToken ? `&page_token=${encodeURIComponent(pageToken)}` : ''
    const app = encodeURIComponent(appToken)
    const table = encodeURIComponent(tableId)
    const res = await request(
      'GET',
      `/open-apis/bitable/v1/apps/${app}/tables/${table}/fields?page_size=${pageSize}${tokenParam}`,
      headers
    )
    const data = JSON.parse(res.body)
    if (data.code !== 0) {
      throw new Error(`Feishu listBitableFields failed: ${data.msg}`)
    }
    return data.data
  }

  async getRecords(
    appToken: string,
    tableId: string,
    options?: { pageSize?: number; pageToken?: string; filter?: string }
  ): Promise<unknown> {
    const headers = await this.authHeaders()
    const app = encodeURIComponent(appToken)
    const table = encodeURIComponent(tableId)
    const pageSize = options?.pageSize ?? 50
    const pageToken = options?.pageToken
      ? `&page_token=${encodeURIComponent(options.pageToken)}`
      : ''
    const filter = options?.filter ? `&filter=${encodeURIComponent(options.filter)}` : ''
    const res = await request(
      'GET',
      `/open-apis/bitable/v1/apps/${app}/tables/${table}/records?page_size=${pageSize}${pageToken}${filter}`,
      headers
    )
    const data = JSON.parse(res.body)
    if (data.code !== 0) {
      throw new Error(`Feishu getBitableRecords failed: ${data.msg}`)
    }
    return data.data
  }

  async createRecords(
    appToken: string,
    tableId: string,
    records: unknown[]
  ): Promise<unknown> {
    const headers = await this.authHeaders()
    const app = encodeURIComponent(appToken)
    const table = encodeURIComponent(tableId)
    const body = JSON.stringify({ records })
    const res = await request(
      'POST',
      `/open-apis/bitable/v1/apps/${app}/tables/${table}/records`,
      headers,
      body
    )
    const data = JSON.parse(res.body)
    if (data.code !== 0) {
      throw new Error(`Feishu createBitableRecords failed: ${data.msg}`)
    }
    return data.data
  }

  async updateRecords(
    appToken: string,
    tableId: string,
    records: unknown[]
  ): Promise<unknown> {
    const headers = await this.authHeaders()
    const app = encodeURIComponent(appToken)
    const table = encodeURIComponent(tableId)
    const body = JSON.stringify({ records })
    const res = await request(
      'PUT',
      `/open-apis/bitable/v1/apps/${app}/tables/${table}/records`,
      headers,
      body
    )
    const data = JSON.parse(res.body)
    if (data.code !== 0) {
      throw new Error(`Feishu updateBitableRecords failed: ${data.msg}`)
    }
    return data.data
  }

  async deleteRecords(
    appToken: string,
    tableId: string,
    recordIds: string[]
  ): Promise<unknown> {
    const headers = await this.authHeaders()
    const app = encodeURIComponent(appToken)
    const table = encodeURIComponent(tableId)
    const body = JSON.stringify({ record_ids: recordIds })
    const res = await request(
      'POST',
      `/open-apis/bitable/v1/apps/${app}/tables/${table}/records/batch_delete`,
      headers,
      body
    )
    const data = JSON.parse(res.body)
    if (data.code !== 0) {
      throw new Error(`Feishu deleteBitableRecords failed: ${data.msg}`)
    }
    return data.data
  }
}
