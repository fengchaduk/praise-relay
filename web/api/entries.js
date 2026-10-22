// Vercel 함수로 돌아가는 /api/entries예요. 약속은 api 폴더의 Spring 서버와 같고, 저장은 Supabase Postgres에 해요.
import postgres from 'postgres'

const MAX_BODY_BYTES = 8 * 1024
const NAME_MAX = 40
const MESSAGE_MAX = 500

let sql
let ready

// Supabase 연동이 넣어 주는 POSTGRES_URL을 써요. 연결 풀(pgbouncer)이라 prepare는 꺼요.
function db() {
  if (!sql) {
    const raw = process.env.POSTGRES_URL || process.env.DATABASE_URL
    if (!raw) throw new Error('POSTGRES_URL 환경 변수가 없어요.')
    const url = new URL(raw)
    url.search = ''
    sql = postgres(url.toString(), { ssl: 'require', prepare: false, max: 1 })
    ready = sql`
      CREATE TABLE IF NOT EXISTS entries (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        name text NOT NULL,
        message text NOT NULL,
        recipient text,
        created_at timestamptz NOT NULL DEFAULT now()
      )`.catch((error) => {
      sql = undefined
      throw error
    })
  }
  return ready.then(() => sql)
}

// 한 인스턴스에 요청이 동시에 오면 postgres는 한 연결에 쿼리를 겹쳐 보내는데,
// Supabase 연결 풀(트랜잭션 모드)은 겹친 쿼리에 답하지 않아 멈춰요. 그래서 한 번에 하나씩 보내요.
let queue = Promise.resolve()

function query(run) {
  const result = queue.then(() => db()).then(run)
  queue = result.catch(() => {})
  return result
}

function toEntry(row) {
  return {
    id: row.id,
    name: row.name,
    message: row.message,
    to: row.recipient,
    created_at: new Date(row.created_at).toISOString(),
  }
}

class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// 오류 문장은 화면에 그대로 보이니 JSON 키 대신 화면 이름표로 쓰고, 받침에 맞춰 조사를 붙여요.
function particle(word, withFinal, withoutFinal) {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  const hasFinal = code >= 0 && code <= 11171 && code % 28 !== 0
  return word + (hasFinal ? withFinal : withoutFinal)
}

function optionalText(value, label, max) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') {
    throw new ApiError(400, `${particle(label, '은', '는')} 글자로 보내 주세요.`)
  }
  const text = value.trim()
  if ([...text].length > max) {
    throw new ApiError(400, `${particle(label, '은', '는')} ${max}자까지 쓸 수 있어요.`)
  }
  return text === '' ? null : text
}

function requiredText(value, label, max) {
  const text = optionalText(value, label, max)
  if (text === null) throw new ApiError(400, `${particle(label, '을', '를')} 적어 주세요.`)
  return text
}

// 본문을 직접 읽어서 415, 413, 깨진 JSON, 문자열 아닌 값을 약속대로 걸러요.
export function readEntry(contentType, bytes) {
  const type = (contentType || '').split(';')[0].trim().toLowerCase()
  if (type !== 'application/json') {
    throw new ApiError(415, 'Content-Type은 application/json이어야 해요.')
  }
  if (bytes.length > MAX_BODY_BYTES) throw new ApiError(413, '본문이 8KiB를 넘어요.')
  let value
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch {
    throw new ApiError(400, 'JSON 형식이 깨졌어요.')
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'JSON 객체로 보내 주세요.')
  }
  return {
    name: requiredText(value.name, '칭찬하는 사람', NAME_MAX),
    message: requiredText(value.message, '칭찬 한마디', MESSAGE_MAX),
    to: optionalText(value.to, '칭찬받는 사람', NAME_MAX),
  }
}

// 본문은 9KiB까지만 읽어요. 그보다 크면 어차피 413이에요.
async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    chunks.push(chunk)
    size += chunk.length
    if (size > MAX_BODY_BYTES) break
  }
  return Buffer.concat(chunks)
}

export async function handle(method, contentType, readBytes) {
  try {
    if (method === 'GET') {
      const rows = await query((sql) => sql`
        SELECT id, name, message, recipient, created_at FROM entries ORDER BY id DESC LIMIT 200`)
      return [200, { entries: rows.map(toEntry) }]
    }
    if (method === 'POST') {
      const { name, message, to } = readEntry(contentType, await readBytes())
      const [row] = await query((sql) => sql`
        INSERT INTO entries (name, message, recipient) VALUES (${name}, ${message}, ${to})
        RETURNING id, name, message, recipient, created_at`)
      return [201, { entry: toEntry(row) }]
    }
    return [405, { error: '이 주소에서 쓸 수 없는 요청 방식이에요.' }]
  } catch (error) {
    if (error instanceof ApiError) return [error.status, { error: error.message }]
    console.error(error)
    return [500, { error: '서버에서 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.' }]
  }
}

// Web 방식(export GET)은 Vercel에서 응답 스트림이 닫히지 않아, 응답을 직접 끝내는 Node 방식으로 써요.
export default async function handler(req, res) {
  const [status, body] = await handle(req.method, req.headers['content-type'], () => readBody(req))
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}
