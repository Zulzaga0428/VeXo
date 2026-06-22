// QPay API Helper
const QPAY_API_URL = "https://merchant.qpay.mn/v2"

let cachedToken: { access_token: string; expires_at: number } | null = null

export async function getQPayToken(): Promise<string> {
  // Check if token is still valid (with 5 min buffer)
  if (cachedToken && cachedToken.expires_at > Date.now() + 5 * 60 * 1000) {
    return cachedToken.access_token
  }

  const username = process.env.QPAY_USERNAME
  const password = process.env.QPAY_PASSWORD

  if (!username || !password) {
    throw new Error("QPay credentials not configured")
  }

  const response = await fetch(`${QPAY_API_URL}/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
    },
  })

  if (!response.ok) {
    throw new Error(`QPay auth failed: ${response.status}`)
  }

  const data = await response.json()
  
  // Cache token (expires_in is in seconds)
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
  }

  return data.access_token
}

export interface CreateInvoiceParams {
  amount: number
  description: string
  userId: string
  planType: "credits_10" | "credits_30" | "credits_100"
}

export interface QPayInvoice {
  invoice_id: string
  qr_text: string
  qr_image: string
  urls: Array<{
    name: string
    description: string
    logo: string
    link: string
  }>
}

export async function createInvoice(params: CreateInvoiceParams): Promise<QPayInvoice> {
  const token = await getQPayToken()
  const invoiceCode = process.env.QPAY_INVOICE_CODE

  if (!invoiceCode) {
    throw new Error("QPay invoice code not configured")
  }

  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://vexoai.studio"}/api/payment/callback`

  // Generate short invoice number (max 45 chars)
  const shortUserId = params.userId.slice(0, 8)
  const timestamp = Date.now().toString(36) // base36 for shorter string
  const invoiceNo = `VX${shortUserId}${timestamp}`.slice(0, 45)

  const response = await fetch(`${QPAY_API_URL}/invoice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      invoice_code: invoiceCode,
      sender_invoice_no: invoiceNo,
      invoice_receiver_code: "terminal",
      invoice_description: params.description,
      amount: params.amount,
      callback_url: `${callbackUrl}?user_id=${params.userId}&plan=${params.planType}`,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`QPay invoice creation failed: ${error}`)
  }

  return response.json()
}

export async function checkPayment(invoiceId: string): Promise<{
  paid: boolean
  payment_id?: string
  paid_amount?: number
}> {
  const token = await getQPayToken()

  const response = await fetch(`${QPAY_API_URL}/payment/check`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      object_type: "INVOICE",
      object_id: invoiceId,
      offset: { page_number: 1, page_limit: 100 },
    }),
  })

  if (!response.ok) {
    throw new Error(`QPay payment check failed: ${response.status}`)
  }

  const data = await response.json()
  
  // Check if there are any paid rows
  const paidPayment = data.rows?.find((row: any) => row.payment_status === "PAID")
  
  return {
    paid: !!paidPayment,
    payment_id: paidPayment?.payment_id,
    paid_amount: paidPayment?.payment_amount,
  }
}
